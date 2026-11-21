// The public pages' shared cache (D143): its JSON text, and INVARIANT cache.write-invalidates-reads, read off
// the source like the OCR routes' check (next.config.test.ts): a write to a table the shared reads use reaches
// a route or page only through a module that calls `publicCache.invalidate()`.
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";

import { describe, expect, it, vi } from "vitest";

import { decode, encode, nextPublicCache } from "./public-cache";

// Next's data cache needs a Next request: a stand-in that keeps what a loader returns and forgets on a tag.
const kept = vi.hoisted(() => new Map<string, unknown>());
vi.mock("next/cache", () => ({
  unstable_cache: (load: () => Promise<unknown>, key: string[]) => async () => {
    const id = key.join("|");
    if (!kept.has(id)) kept.set(id, await load());
    return kept.get(id);
  },
  revalidateTag: () => kept.clear(),
}));

describe("the public cache's JSON text (D143)", () => {
  it("brings a Date back as a Date, and refuses a Map instead of keeping it as {}", () => {
    const at = new Date("2026-11-21T10:00:00Z");
    const value = decode<{ at: Date; rows: { seen: Date | null }[] }>(
      encode({ at, rows: [{ seen: null }, { seen: at }] }),
    );

    expect(value).toEqual({ at, rows: [{ seen: null }, { seen: at }] });
    expect(value.at).toBeInstanceOf(Date);
    expect(() => encode({ names: new Map([[1, "a"]]) })).toThrow(TypeError);
  });
});

describe("a read across an invalidation (D143)", () => {
  it("serves the rows it read once and keeps nothing, so the next view reads the write", async () => {
    let row = "before";
    let release = () => {};
    const slow = new Promise<void>((r) => (release = r));
    const load = async () => {
      const seen = row;
      await slow;
      return seen;
    };

    const across = nextPublicCache.read("race", [], load);
    row = "after";
    nextPublicCache.invalidate();
    release();

    expect(await across).toBe("before");
    expect(await nextPublicCache.read("race", [], load)).toBe("after");
  });
});

const root = resolve(import.meta.dirname, "..");
/** The tables the shared reads (app/_ui/public-reads.ts and the pages that use it) read. */
const TABLES = [
  "dailyRosters",
  "allianceBoard",
  "allianceSnapshots",
  "memberSnapshots",
  "events",
  "snapshots",
  "trackedSets",
  "alliances",
  "playerFrames",
];
const WRITES = new RegExp(String.raw`\.(?:insert|update|delete)\((?:${TABLES.join("|")})\)`);
const INVALIDATES = /publicCache\.invalidate\(\)/;
/** Writers whose rows no shared read ever shows, and why. */
const NEVER_SHOWN: Record<string, string> = {
  "lib/repo/rehearsals.ts#insertRehearsal": "a rehearsal is is_test, never a public event",
  "lib/repo/rehearsals.ts#pruneRehearsals": "deletes rehearsals only",
  "lib/repo/events.ts#setDiscordMessageId":
    "the Discord message ids are never read by a public page",
  "lib/repo/events.ts#claimQuotaCheck": "quota_checked_at is never read by a public page",
};

const sourceFiles = (dir: string): string[] =>
  readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const path = join(dir, e.name);
    if (e.isDirectory()) return sourceFiles(path);
    return /\.tsx?$/.test(e.name) && !/\.test(-helpers)?\.tsx?$/.test(e.name) ? [path] : [];
  });

const modules = [...sourceFiles(join(root, "lib")), ...sourceFiles(join(root, "app"))].map(
  (file) => ({ path: relative(root, file), text: readFileSync(file, "utf8") }),
);

/** Each top-level function or const of a module and its text, up to the next top-level declaration. */
function declarations(text: string): Map<string, string> {
  const out = new Map<string, string>();
  const start =
    /^(?:export\s+)?(?:default\s+)?(?:async\s+)?function\s+(\w+)|^(?:export\s+)?const\s+(\w+)/;
  let name: string | null = null;
  let body: string[] = [];
  for (const line of text.split("\n")) {
    const m = start.exec(line);
    if (m || /^(?:export\s+)?(?:interface|type|class|let)\b/.test(line)) {
      if (name) out.set(name, body.join("\n"));
      name = m ? (m[1] ?? m[2] ?? null) : null;
      body = [];
    }
    if (name) body.push(line);
  }
  if (name) out.set(name, body.join("\n"));
  return out;
}

function resolveImport(from: string, spec: string): string | null {
  const base = spec.startsWith("@/")
    ? join(root, spec.slice(2))
    : spec.startsWith(".")
      ? resolve(dirname(join(root, from)), spec)
      : null;
  if (!base) return null;
  const file = [`${base}.ts`, `${base}.tsx`, join(base, "index.ts")].find((f) => existsSync(f));
  return file ? relative(root, file) : null;
}

/** Local name → `module#exported name`, from the module's `import { … } from` lines. */
function importsOf(path: string, text: string): Map<string, string> {
  const out = new Map<string, string>();
  for (const [, names = "", spec = ""] of text.matchAll(
    /import\s+(?:type\s+)?\{([^}]*)\}\s*from\s*"([^"]+)"/g,
  )) {
    const from = resolveImport(path, spec);
    if (!from) continue;
    for (const raw of names.split(",")) {
      const [name, local = name] = raw
        .replace(/^\s*type\s+/, "")
        .trim()
        .split(/\s+as\s+/);
      if (name) out.set(local ?? name, `${from}#${name}`);
    }
  }
  return out;
}

const calls = (body: string, name: string) => new RegExp(String.raw`\b${name}\(`).test(body);

type Decl = {
  key: string;
  body: string;
  module: { path: string; text: string; decls: Map<string, string>; imports: Map<string, string> };
};

/** Every top-level declaration of every module, as `module#name` with its text. */
const decls: Decl[] = modules.flatMap((m) => {
  const module = { ...m, decls: declarations(m.text), imports: importsOf(m.path, m.text) };
  return [...module.decls].map(([name, body]) => ({ key: `${m.path}#${name}`, body, module }));
});

/** Whether `d` calls a writer: one it imports, one of its own module, or the collector's repo object's
 * (createRepo: `repo.startSnapshot(…)`). */
function callsWriter({ body, module: m }: Decl, writers: Set<string>): boolean {
  const repoWriter = (w: string) =>
    w.startsWith("lib/repo/") && new RegExp(String.raw`\.${w.split("#")[1]}\(`).test(body);
  return (
    [...m.imports].some(([local, target]) => writers.has(target) && calls(body, local)) ||
    [...m.decls.keys()].some((own) => writers.has(`${m.path}#${own}`) && calls(body, own)) ||
    (!m.path.startsWith("lib/repo/") && [...writers].some(repoWriter))
  );
}

/**
 * Every function that writes those tables, directly or through another, as `module#name`, and the modules
 * that call one and invalidate. A write is followed up to a module that invalidates; past it, no further.
 * A module counts as invalidating when `publicCache.invalidate()` appears anywhere in it: the scan does not
 * check that the call sits on the same path as the write (the per-writer tests do).
 */
function writePaths() {
  const writes = (d: Decl) =>
    WRITES.test(d.body) &&
    !NEVER_SHOWN[d.key] &&
    (d.key.startsWith("lib/repo/") || !INVALIDATES.test(d.module.text));
  const writers = new Set(decls.filter(writes).map((d) => d.key));
  const invalidating = new Set<string>();
  for (let grew = true; grew;) {
    const found = decls.filter((d) => !writers.has(d.key) && callsWriter(d, writers));
    for (const d of found.filter((f) => INVALIDATES.test(f.module.text)))
      invalidating.add(d.module.path);
    const passing = found.filter((f) => !INVALIDATES.test(f.module.text));
    passing.forEach((d) => writers.add(d.key));
    grew = passing.length > 0;
  }
  return { writers, invalidating };
}

describe("INVARIANT cache.write-invalidates-reads (D143)", () => {
  it("every route and page that writes a table the shared reads use goes through a module that invalidates", () => {
    const { writers, invalidating } = writePaths();

    // A writer in app/ is a route, page or action that writes with no invalidation on its way.
    expect([...writers].filter((w) => w.startsWith("app/"))).toEqual([]);
    // The scan found the writers it is meant to find.
    expect([...invalidating].sort()).toEqual(
      expect.arrayContaining([
        "app/api/alliances/[unionId]/details/route.ts",
        "app/api/daily-read/retry/route.ts",
        "app/api/manual-event/rename/route.ts",
        "app/api/manual-event/route.ts",
        "app/api/manual-event/settings/route.ts",
        "lib/run.ts",
        "lib/tick.ts",
      ]),
    );
  });
});
