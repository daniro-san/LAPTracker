import { readFileSync } from "node:fs";

import { sql } from "drizzle-orm";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";

import { ADMIN_WEBHOOK, TEST_ENV, testContext } from "./app-context.test-helpers";
import { recordAppError } from "./app-errors";
import { minutes, T0 } from "./collector.test-helpers";
import { openTestDb, truncateAll } from "./db.test-helpers";
import { claimAppErrorAlert, insertAppError, purgeOldAppErrors } from "./repo/app-errors";
import { reportError, type Report } from "./report-error";
import { appErrors, workspaces } from "./schema";

const db = await openTestDb();
const HOUR = 60 * 60_000;
const ON = { ...TEST_ENV, VERCEL_ENV: "production", POSTHOG_KEY: "phc_test" };
// Invented values: a photo id, coordinates 98765/54321, a last-online time and a daily tech of 4321.
const AVATAR = "https://phs-image.globallap.com/head/7a1b9c.png";
const LEAKS = ["98765", "54321", "2026-11-20", "4321", "7a1b9c", "globallap"];

/** The $exception events' properties PostHog was sent. */
const exceptions = (posts: { url: string; body: Record<string, unknown> }[]) =>
  posts
    .filter((p) => p.url === "https://us.i.posthog.com/batch/")
    .flatMap((p) => p.body.batch as { event: string; properties: Record<string, unknown> }[])
    .filter((e) => e.event === "$exception")
    .map((e) => e.properties);

beforeEach(async () => {
  await truncateAll(db);
  vi.spyOn(console, "error").mockImplementation(() => {});
});
afterAll(() => vi.restoreAllMocks());

describe("app-error alert", () => {
  it("alerts once per hour while errors continue", async () => {
    const { ctx, clock, posts } = testContext(db);
    // An error every 5 minutes for 3 hours (36 errors, ≥ 1 s apart so the per-instance limiter
    // lets each one through): alerts at 0, 60 and 120 minutes.
    for (let i = 0; i < 36; i++) {
      clock.now = new Date(T0.getTime() + i * minutes(5));
      await recordAppError(ctx, {
        route: "/api/x",
        kind: "route",
        digest: null,
        error: new Error(),
      });
    }
    expect(posts.filter((p) => p.url === ADMIN_WEBHOOK)).toHaveLength(3);
  });

  it("sends $exception with the workspace and alliance under a workspace's slug, none for an unknown one (issue 452)", async () => {
    await db
      .insert(workspaces)
      .values({ unionId: 67111155, slug: "ogs", discordGuildId: "1", leaderRoleIds: ["2"] });
    const { ctx, posts } = testContext(db, {
      ...TEST_ENV,
      VERCEL_ENV: "production",
      POSTHOG_KEY: "phc_test",
    });
    const sent = () =>
      posts
        .filter((p) => p.url === "https://us.i.posthog.com/batch/")
        .map((p) => (p.body.batch as { properties: Record<string, unknown> }[])[0]?.properties);
    for (const [slug, route] of [
      ["ogs", "/w/[slug]/thefts"],
      ["nope", "/api/w/[slug]/calendar"],
    ] as const) {
      await recordAppError(ctx, {
        route,
        kind: "render",
        digest: null,
        error: new TypeError(),
        slug,
      });
    }
    await vi.waitFor(() => expect(sent()).toHaveLength(2));
    const known = sent().find((p) => p?.route === "/w/[slug]/thefts");
    const unknown = sent().find((p) => p?.route === "/api/w/[slug]/calendar");
    expect(known).toMatchObject({ workspace: "ogs", alliance: "OGs" });
    expect(unknown).not.toHaveProperty("workspace");
    expect(unknown).not.toHaveProperty("alliance");
  });

  it("stores the request's slug in a slug's shape only, for /admin's errors by workspace (D144)", async () => {
    const { ctx, clock } = testContext(db);
    for (const [i, slug] of ["ogs", "Not A Slug!", undefined].entries()) {
      // After the other tests' clocks: the per-instance limiter keeps the last insert's time.
      clock.now = new Date(T0.getTime() + 24 * HOUR + i * minutes(5));
      await recordAppError(ctx, {
        route: "/w/[slug]/thefts",
        kind: "render",
        digest: null,
        error: new Error(),
        ...(slug && { slug }),
      });
    }
    const rows = await db
      .select({ slug: appErrors.workspaceSlug })
      .from(appErrors)
      .orderBy(appErrors.id);
    expect(rows.map((r) => r.slug)).toEqual(["ogs", null, null]);
  });

  it("stores, alerts and sends to PostHog an error with its private roster values replaced (D115, 2026-11-21)", async () => {
    const { ctx, clock, posts } = testContext(db, ON);
    clock.now = new Date(T0.getTime() + 48 * HOUR);
    const parsed = z.object({ x: z.number() }).safeParse({ x: "98765" }, { reportInput: true });
    const error = new Error(
      [
        `Bad row: x=98765 y=54321 last_online_at=2026-11-20T10:00:00Z daily_tech=4321 ${AVATAR}`,
        `{"nick_name":"Invented Bramble","x":98765,"lastOnlineAt":"2026-11-20T10:00:00Z","daily_tech":4321,"avatar_url":"${AVATAR}"}`,
        "Key (union_id, y)=(67111155, 54321) already exists.",
      ].join("\n"),
      { cause: parsed.error },
    );
    await recordAppError(ctx, { route: "/w/[slug]/thefts", kind: "render", digest: null, error });
    await vi.waitFor(() => expect(exceptions(posts)).toHaveLength(1));
    const [row] = await db.select().from(appErrors);
    const stored = JSON.stringify(row?.detail);
    const alert = posts.find((p) => p.url === ADMIN_WEBHOOK)?.content ?? "";
    const [sent] = exceptions(posts);
    for (const text of [stored, alert, JSON.stringify(sent)])
      for (const leak of LEAKS) expect(text).not.toContain(leak);
    // The name is public: /admin/errors keeps it; PostHog never gets it (quoted text is scrubbed).
    expect(JSON.stringify(sent)).not.toContain("Invented Bramble");
    expect(stored).toContain("Bad row: x=… y=… last_online_at=… daily_tech=… …");
    expect(stored).toContain('\\"nick_name\\":\\"Invented Bramble\\"');
    expect(stored).toContain("Key (union_id, y)=(67111155, …) already exists.");
    expect(stored).toContain('\\"path\\": [\\n      \\"x\\"\\n    ]');
    expect(alert).toContain("render Error — Bad row: x=… y=… last_online_at=… daily_tech=… …");
    // PostHog's $exception: the scrubbed message, the frames, not handled for a render error.
    const frame = expect.objectContaining({ platform: "node:javascript", in_app: true });
    expect(sent).toMatchObject({
      $exception_list: [
        {
          type: "Error",
          value: expect.stringContaining("Bad row: x=… y=…"),
          mechanism: { handled: false },
          stacktrace: { type: "raw", frames: expect.arrayContaining([frame]) },
        },
      ],
      kind: "render",
      route: "/w/[slug]/thefts",
      section: "thefts",
    });
  });

  it("keeps a failed query's parameters (an officer's text) out of the row, the alert and PostHog", async () => {
    const { ctx, clock, posts } = testContext(db, ON);
    clock.now = new Date(T0.getTime() + 72 * HOUR);
    // An officer's text of two lines: the second starts like a stack frame.
    const text = "Invented Bramble wrote this notice\nat 8pm in the hall";
    // A real Drizzle failure: "Failed query: … values (now(), $1, null)\nparams: <text>".
    const error = await db
      .execute(sql`insert into app_errors (at, route, message) values (now(), ${text}, null)`)
      .then(() => null)
      .catch((e: unknown) => e);
    expect(String((error as Error).message)).toContain(`params: ${text}`);
    await recordAppError(ctx, {
      route: "/api/w/[slug]/notices",
      kind: "route",
      digest: null,
      error,
    });
    await vi.waitFor(() => expect(exceptions(posts)).toHaveLength(1));
    const [row] = await db.select().from(appErrors);
    const alert = posts.find((p) => p.url === ADMIN_WEBHOOK)?.content ?? "";
    for (const kept of [JSON.stringify(row?.detail), alert, JSON.stringify(exceptions(posts))])
      for (const leak of ["Invented Bramble", "8pm"]) expect(kept).not.toContain(leak);
    expect(row?.detail).toMatchObject({
      message: expect.stringMatching(/^Failed query: insert into app_errors .*\nparams: …$/s),
      // The stack keeps its real frames only.
      stack: expect.stringMatching(/^at .+:\d+:\d+\)?$/m),
    });
  });

  it("sends a handled error to PostHog once, with no row and no alert", async () => {
    const { ctx, posts } = testContext(db, ON);
    reportError(ctx, {
      route: "/api/tick",
      kind: "workspaces.purge_failed",
      error: new TypeError("boom"),
    });
    // Outside a request the send starts at once and posts before its first await: one call, one post.
    expect(exceptions(posts)).toHaveLength(1);
    expect(exceptions(posts)[0]).toMatchObject({
      $exception_list: [{ type: "TypeError", value: "boom", mechanism: { handled: true } }],
      kind: "workspaces.purge_failed",
      route: "/api/tick",
    });
    expect(await db.select().from(appErrors)).toHaveLength(0);
    expect(posts.filter((p) => p.url === ADMIN_WEBHOOK)).toHaveLength(0);
  });

  it("purges rows older than 30 days (D115, 2026-11-21)", async () => {
    const now = new Date(T0.getTime() + 60 * 24 * HOUR);
    for (const days of [31, 29]) {
      const at = new Date(now.getTime() - days * 24 * HOUR);
      await insertAppError(db, { at, route: "/x", digest: null, message: `route Error ${days}` });
    }
    expect(await purgeOldAppErrors(db, now)).toBe(1);
    const rows = await db.select({ message: appErrors.message }).from(appErrors);
    expect(rows).toEqual([{ message: "route Error 29" }]);
  });

  it("gives the claim to exactly one of two concurrent callers", async () => {
    await claimAppErrorAlert(db, T0, HOUR);
    const later = new Date(T0.getTime() + HOUR);
    const claims = await Promise.all([
      claimAppErrorAlert(db, later, HOUR),
      claimAppErrorAlert(db, later, HOUR),
    ]);
    expect(claims.filter(Boolean)).toHaveLength(1);
  });
});

// INVARIANT app-errors.private-redacted, read off the source like the other invariant checks: the stored
// detail, the alert and the PostHog payload all pass the private-field redactor.
describe("one private-field redactor on every error's way out (D115, 2026-11-21)", () => {
  /** A top-level function's code without its comments, from its declaration to the line that closes it. */
  const body = (file: string, name: string) => {
    const text = readFileSync(new URL(file, import.meta.url), "utf8");
    const start = text.search(new RegExp(`^(?:export )?(?:async )?function ${name}\\b`, "m"));
    expect(start, `${name} in ${file}`).toBeGreaterThanOrEqual(0);
    return text
      .slice(start, text.indexOf("\n}\n", start))
      .replace(/\/\*[^]*?\*\//g, "")
      .replace(/^\s*\/\/.*$/gm, "");
  };

  it("redact() passes every string through redactPrivate, and the browser's scrubber does too", () => {
    expect(body("./redact.ts", "scrubString")).toContain("redactPrivate(");
    expect(body("./analytics/sanitise.ts", "scrubMessage")).toContain("redactPrivate(");
  });

  it("appErrorDetail redacts, the alert builder redacts, and every error leaves through them", () => {
    expect(body("./report-error.ts", "appErrorDetail")).toContain("= redact(");
    expect(body("./notify.ts", "appErrorMessage")).toContain("message: redactPrivate(");
    const record = body("./app-errors.ts", "recordAppError");
    for (const call of ["= appErrorDetail(", "appErrorMessage(", "sendException("])
      expect(record).toContain(call);
    expect(body("./report-error.ts", "reportError")).toContain("appErrorDetail(");
    expect(body("./report-error.ts", "sendException")).toContain("message: scrubMessage(");
  });

  // The type is the guard: `pnpm typecheck` fails if any line marked @ts-expect-error stops being an error.
  it("lib/private's report context takes only a listed module and its own code, nothing else (D71)", () => {
    const report = vi.fn<Report>();
    const name: string = "Invented Bramble";
    const error = new Error("boom");
    // @ts-expect-error a free-string kind could carry a member's name
    report(error, { route: "lib/private/read-status.ts", kind: `w.read_status.failed ${name}` });
    report(error, {
      route: "lib/private/read-status.ts",
      kind: "w.read_status.failed",
      // @ts-expect-error an extra key could carry the workspace or a member
      slug: "ogs",
    });
    // @ts-expect-error a code that belongs to another module
    report(error, { route: "lib/private/read-status.ts", kind: "w.webhook.open_failed" });
    report(error, { route: "lib/private/read-status.ts", kind: "w.read_status.failed" });
    expect(report.mock.calls.at(-1)?.[1]).toEqual({
      route: "lib/private/read-status.ts",
      kind: "w.read_status.failed",
    });
  });
});
