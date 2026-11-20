// One session cookie per workspace (D131): which cookie carries a workspace's session, and which one Sign
// out clears. Invented ids only.
import { beforeAll, beforeEach, describe, expect, it } from "vitest";

import { T0 } from "../collector.test-helpers";
import type { Db } from "../db";
import { openTestDb, truncateAll } from "../db.test-helpers";
import { saveWorkspace } from "../repo/workspaces";
import { signOut } from "./access";
import { SESSION_COOKIE, sessionCookieFor, sessionCookieName } from "./session";
import { MEMBER_ROLE, R4, signInWith } from "./sign-in.test-helpers";

let db: Db;
beforeAll(async () => {
  db = await openTestDb();
});
beforeEach(async () => {
  await truncateAll(db);
  await saveWorkspace(db, {
    unionId: 67111155,
    slug: "ogs",
    discordGuildId: "400000000000000001",
    leaderRoleIds: [R4],
    memberRoleIds: [MEMBER_ROLE],
  });
});

/** A browser holding one cookie. */
const holding = (name: string, value: string) => ({
  get: (n: string) => (n === name ? { value } : undefined),
});

describe("the session cookie of a workspace (D131)", () => {
  it("counts the cookie of before D131 only where the workspace has no cookie of its own", () => {
    const holds =
      (...names: string[]) =>
      (n: string) =>
        names.includes(n);
    expect(sessionCookieFor(holds(sessionCookieName("ogs"), SESSION_COOKIE), "ogs")).toBe(
      sessionCookieName("ogs"),
    );
    expect(sessionCookieFor(holds(SESSION_COOKIE, sessionCookieName("nse")), "ogs")).toBe(
      SESSION_COOKIE,
    );
    expect(sessionCookieFor(holds(sessionCookieName("nse")), "ogs")).toBeNull();
  });

  it("signs out under the cookie that carried the session: the workspace's own, or the old one", async () => {
    const own = await signInWith(db, "ogs", "officer");
    expect(await signOut(db, "ogs", holding(sessionCookieName("ogs"), own.token ?? ""), T0)).toBe(
      sessionCookieName("ogs"),
    );
    const old = await signInWith(db, "ogs", "officer");
    expect(await signOut(db, "ogs", holding(SESSION_COOKIE, old.token ?? ""), T0)).toBe(
      SESSION_COOKIE,
    );
  });
});
