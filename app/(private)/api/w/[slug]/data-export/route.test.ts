// POST /api/w/[slug]/data-export (D125): an officer downloads a ZIP with a CSV per table the workspace owns
// (deleted records in their own files), the notices' pictures and a README; no private roster field, no
// key, no session and no Discord id is in any byte of it. A member and another workspace are refused, and
// a workspace gets 3 downloads a day.
import { crc32, inflateRawSync } from "node:zlib";

import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import type { AppContext } from "@/lib/app-context";
import { TEST_ENV, testContext } from "@/lib/app-context.test-helpers";
import type { Db } from "@/lib/db";
import { openTestDb, truncateAll } from "@/lib/db.test-helpers";
import { createSession, SESSION_COOKIE } from "@/lib/private/session";
import { workspaceUsers } from "@/lib/schema";
import { workspaceDataEvents } from "@/lib/schema-retention";
import {
  KEY_MARKER,
  PICTURE,
  PRIVATE_MARKERS,
  SEED_AT,
  seedEverything,
  seedRoster,
  seedWorkspace,
} from "@/lib/workspace-data.test-helpers";

const holder = vi.hoisted(() => ({ ctx: null as AppContext | null }));
vi.mock("@/lib/app-context", async (original) => ({
  ...(await original<typeof import("@/lib/app-context")>()),
  getAppContext: () => holder.ctx,
}));

const route = await import("./route");

const ORIGIN = "https://laptracker.test";
const ID = () => crypto.randomUUID();

let db: Db;
const tokens = { officer: "", member: "", other: "" };

beforeAll(async () => {
  db = await openTestDb();
});
beforeEach(async () => {
  await truncateAll(db);
  const test = testContext(db, TEST_ENV);
  test.clock.now = SEED_AT;
  holder.ctx = test.ctx;
  const nse = await seedWorkspace(db, "nse", 67109944);
  const ogs = await seedWorkspace(db, "ogs", 67111155);
  await seedRoster(db, nse.unionId);
  await seedEverything(db, nse);
  const [member] = await db
    .insert(workspaceUsers)
    .values({ workspaceId: nse.workspaceId, discordUserId: "discord-member", displayName: "Mia" })
    .returning({ id: workspaceUsers.id });
  const session = (ws: number, user: number, tier: "officer" | "member") =>
    createSession(db, ws, user, SEED_AT, null, tier).then((s) => s.token);
  tokens.officer = await session(nse.workspaceId, nse.officer, "officer");
  tokens.member = await session(nse.workspaceId, member?.id ?? 0, "member");
  tokens.other = await session(ogs.workspaceId, ogs.officer, "officer");
});

const post = (token: string, requestId = ID(), lang = "en") =>
  route.POST(
    new Request(`${ORIGIN}/api/w/nse/data-export`, {
      method: "POST",
      headers: {
        origin: ORIGIN,
        "content-type": "application/json",
        cookie: `${SESSION_COOKIE}=${token}; lap_ws_lang=${lang}`,
      },
      body: JSON.stringify({ requestId }),
    }),
    { params: Promise.resolve({ slug: "nse" }) },
  );

/** Every file of a ZIP, unpacked, each checked against its CRC-32. */
function unzip(bytes: Uint8Array): Map<string, Buffer> {
  const b = Buffer.from(bytes);
  const end = b.length - 22;
  const entries = b.readUInt16LE(end + 10);
  let at = b.readUInt32LE(end + 16);
  const files = new Map<string, Buffer>();
  for (let i = 0; i < entries; i += 1) {
    const method = b.readUInt16LE(at + 10);
    const crc = b.readUInt32LE(at + 16);
    const size = b.readUInt32LE(at + 20);
    const nameLength = b.readUInt16LE(at + 28);
    const local = b.readUInt32LE(at + 42);
    const name = b.toString("utf8", at + 46, at + 46 + nameLength);
    const start = local + 30 + b.readUInt16LE(local + 26) + b.readUInt16LE(local + 28);
    const stored = b.subarray(start, start + size);
    const data = method === 8 ? inflateRawSync(stored) : stored;
    expect(crc32(data)).toBe(crc);
    files.set(name, data);
    at += 46 + nameLength + b.readUInt16LE(at + 30) + b.readUInt16LE(at + 32);
  }
  return files;
}

describe("POST /api/w/[slug]/data-export (D125)", () => {
  it("holds a file for every table, deleted records apart, the pictures, and no private field or key", async () => {
    const res = await post(tokens.officer, ID(), "pt-BR");
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("application/zip");
    expect(res.headers.get("content-disposition")).toBe(
      'attachment; filename="nse-data-2026-11-18.zip"',
    );
    const files = unzip(new Uint8Array(await res.arrayBuffer()));
    const tables = [
      "people",
      "member-facts",
      "new-members",
      "name-aliases",
      "calendar-entries",
      "calendar-weeks",
      "garrison-plans",
      "notices",
      "notice-texts",
      "notice-posts",
      "notice-reviews",
      "notice-review-outcomes",
      "notice-pictures",
      "roll-calls",
      "roll-call-marks",
      "roll-call-teams",
      "follow-ups",
      "thefts",
      "theft-steps",
      "theft-attackers",
      "thanks",
      "thanks-taken-down",
      "start-here",
      "screenshot-drafts",
      "alliance-duel-points",
      "screenshot-checks",
      "squads",
      "tracker-key-changes",
      "data-requests",
      "former-members",
      "activity",
    ];
    const deleted = ["new-members", "calendar-entries", "notices", "roll-calls", "thefts"];
    const expected = [
      "README.txt",
      ...tables.map((f) => `${f}.csv`),
      ...deleted.map((f) => `${f}-deleted.csv`),
      "pictures/notice-1.png",
    ];
    expect([...files.keys()].sort()).toEqual(expected.sort());
    expect(files.get("pictures/notice-1.png")).toEqual(Buffer.from(PICTURE));
    const csv = (name: string) => files.get(name)?.toString("utf8") ?? "";
    // UTF-8 with a BOM, names instead of ids, and the README in the officer's language.
    expect(csv("notice-texts.csv").startsWith("\uFEFFid,notice_id,workspace_id")).toBe(true);
    expect(csv("notice-texts.csv")).toContain("Olá, aliança");
    expect(csv("member-facts.csv")).toContain("101,Ana Example,notes");
    expect(csv("member-facts.csv")).toContain("Officer nse");
    expect(csv("thefts.csv").split("\r\n")).toHaveLength(3);
    expect(csv("thefts-deleted.csv").split("\r\n")).toHaveLength(3);
    expect(csv("README.txt")).toContain("Arquivos");
    // No byte of any file: the private roster fields, the sealed key, sessions or Discord ids.
    const all = Buffer.concat([...files.values()]).toString("latin1");
    for (const marker of [
      ...PRIVATE_MARKERS,
      KEY_MARKER,
      "NONCE-MARKER",
      "session-hash",
      "discord-",
    ]) {
      expect(all).not.toContain(marker);
    }
    for (const [name, data] of files) {
      if (!name.endsWith(".csv")) continue;
      const header = data.toString("utf8").slice(1).split("\r\n")[0]?.split(",") ?? [];
      const banned = [
        "x",
        "y",
        "online",
        "last_online_at",
        "avatar_url",
        "ciphertext",
        "token_hash",
      ];
      expect(header.filter((c) => banned.includes(c))).toEqual([]);
    }
  });

  it("refuses a member's session and another workspace's officer, and records nothing", async () => {
    for (const token of [tokens.member, tokens.other, "no-session"]) {
      const res = await post(token);
      expect([res.status, await res.json()]).toEqual([401, { code: "signed_out" }]);
    }
    const lines = await db.select().from(workspaceDataEvents);
    expect(lines.filter((l) => l.action === "download")).toEqual([]);
  });

  it("allows 3 downloads a day per workspace; a repeated request id is not counted again", async () => {
    const first = ID();
    expect((await post(tokens.officer, first)).status).toBe(200);
    expect((await post(tokens.officer, first)).status).toBe(200);
    expect((await post(tokens.officer)).status).toBe(200);
    expect((await post(tokens.officer)).status).toBe(200);
    const fourth = await post(tokens.officer);
    expect([fourth.status, await fourth.json()]).toEqual([429, { code: "rate_limited" }]);
    const lines = await db.select().from(workspaceDataEvents);
    expect(lines.filter((l) => l.action === "download")).toHaveLength(3);
  });
});
