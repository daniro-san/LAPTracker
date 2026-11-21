import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

import { ADMIN_WEBHOOK, TEST_ENV, testContext } from "./app-context.test-helpers";
import { recordAppError } from "./app-errors";
import { minutes, T0 } from "./collector.test-helpers";
import { openTestDb, truncateAll } from "./db.test-helpers";
import { claimAppErrorAlert } from "./repo/app-errors";
import { appErrors, workspaces } from "./schema";

const db = await openTestDb();
const HOUR = 60 * 60_000;

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
