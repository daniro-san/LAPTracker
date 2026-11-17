// D105's member tier at the edges: who gets it (a member role, amended 2026-11-17), a blocked member, Sign
// out everyone, a member who became an officer, and a member who lost the role.
import { eq } from "drizzle-orm";
import { beforeAll, beforeEach, describe, expect, it } from "vitest";

import { T0 } from "../collector.test-helpers";
import type { Db } from "../db";
import { openTestDb, truncateAll } from "../db.test-helpers";
import { findWorkspaceBySlug, saveWorkspace, signOutWorkspace } from "../repo/workspaces";
import { workspaceSessions, workspaceUsers } from "../schema";
import { requireBoard, requireWorkspace } from "./access";
import { CHECK_MS } from "./session";
import { jar, location, MEMBER_ID, MEMBER_ROLE, R4, signInWith } from "./sign-in.test-helpers";

let db: Db;
const signIn = (...args: Parameters<typeof signInWith> extends [Db, ...infer R] ? R : never) =>
  signInWith(db, ...args);
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

const workspaceId = async (slug: string) => (await findWorkspaceBySlug(db, slug))?.id ?? 0;

describe("member sessions (D105)", () => {
  it("refuses someone in the server without a member role, and stores nobody", async () => {
    const { step, token } = await signIn("ogs", "guest");
    expect(location(step)).toBe("/w/ogs/no-access?why=no_role");
    expect(token).toBeUndefined();
    expect(await db.select().from(workspaceUsers)).toEqual([]);
  });

  it("with no member role set: the board is closed, officers still get in", async () => {
    const { token: before } = await signIn("ogs", "member");
    await saveWorkspace(db, {
      unionId: 67111155,
      slug: "ogs",
      discordGuildId: "400000000000000001",
      leaderRoleIds: [R4],
    });
    expect(location((await signIn("ogs", "member")).step)).toBe(
      "/w/ogs/no-access?why=board_closed",
    );
    // A member's session from before is not served; its trip through Discord ends it.
    expect(await requireBoard(db, "ogs", jar(before), T0)).toEqual({
      ok: false,
      reason: "expired",
    });
    const officer = await signIn("ogs", "officer");
    expect(location(officer.step)).toBe("/w/ogs");
    expect((await requireWorkspace(db, "ogs", jar(officer.token), T0)).ok).toBe(true);
  });

  it("ends a member's session at the daily re-check once the member role is gone", async () => {
    const { token } = await signIn("ogs", "member");
    const later = new Date(T0.getTime() + CHECK_MS);
    expect(await requireBoard(db, "ogs", jar(token), later)).toEqual({
      ok: false,
      reason: "expired",
    });
    const renewal = await signIn("ogs", "unsorted", later, {}, { session: token ?? "" });
    expect(location(renewal.step)).toBe("/w/ogs/no-access?why=no_role");
    expect(await db.select().from(workspaceSessions)).toEqual([]);
  });

  it("serves a blocked member nothing on the board (D105)", async () => {
    const { token } = await signIn("ogs", "member");
    await db
      .update(workspaceUsers)
      .set({ blocked: true })
      .where(eq(workspaceUsers.discordUserId, MEMBER_ID));
    expect(await requireBoard(db, "ogs", jar(token), T0)).toEqual({ ok: false, reason: "blocked" });
  });

  it("ends member sessions with Sign out everyone (D105)", async () => {
    const { token } = await signIn("ogs", "member");
    expect(await signOutWorkspace(db, await workspaceId("ogs"))).toBe(1);
    expect(await requireBoard(db, "ogs", jar(token), T0)).toEqual({
      ok: false,
      reason: "signed_out",
    });
  });

  it("gives a member who became an officer a new officer session and ends the member one (D105)", async () => {
    const member = await signIn("ogs", "member");
    const later = new Date(T0.getTime() + 3_600_000);
    const officer = await signIn("ogs", "promoted", later, {}, { session: member.token ?? "" });
    expect(location(officer.step)).toBe("/w/ogs");
    expect(officer.token !== undefined && officer.token !== member.token).toBe(true);
    expect((await requireWorkspace(db, "ogs", jar(officer.token), later)).ok).toBe(true);
    expect(await requireBoard(db, "ogs", jar(member.token), later)).toEqual({
      ok: false,
      reason: "signed_out",
    });
    const rows = await db.select().from(workspaceSessions);
    expect(rows.map((r) => r.tier)).toEqual(["officer"]);
  });
});
