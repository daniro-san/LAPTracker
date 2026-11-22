// POST /api/w/[slug]/calendar (issue 300, D123): an officer's add shows in the week, a whole-entry delete
// takes it out and answers `deleted` (so the page offers Undo), and the same officer's Undo brings it back.
import { randomUUID } from "node:crypto";

import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import type { AppContext } from "@/lib/app-context";
import { testContext } from "@/lib/app-context.test-helpers";
import { T0 } from "@/lib/collector.test-helpers";
import type { Db } from "@/lib/db";
import { openTestDb, truncateAll } from "@/lib/db.test-helpers";
import { requireWorkspace } from "@/lib/private/access";
import { calendarDays } from "@/lib/private/calendar";
import { createSession, SESSION_COOKIE } from "@/lib/private/session";
import { workspaces, workspaceUsers } from "@/lib/schema";

const holder = vi.hoisted(() => ({ ctx: null as AppContext | null }));
vi.mock("@/lib/app-context", async (original) => ({
  ...(await original<typeof import("@/lib/app-context")>()),
  getAppContext: () => holder.ctx,
}));

const { POST } = await import("./route");

const ORIGIN = "https://laptracker.test";
/** A Monday in T0's week (Sat 7 Nov 2026), and its Sunday. */
const DAY = "2026-11-09";
const SUNDAY = "2026-11-15";

let db: Db;
let token = "";
beforeAll(async () => {
  db = await openTestDb();
});
beforeEach(async () => {
  await truncateAll(db);
  const [ws] = await db
    .insert(workspaces)
    .values({ unionId: 67111155, slug: "ogs", discordGuildId: "1", leaderRoleIds: ["2"] })
    .returning({ id: workspaces.id });
  const workspaceId = ws?.id ?? 0;
  const [user] = await db
    .insert(workspaceUsers)
    .values({ workspaceId, discordUserId: "id-ana", displayName: "Ana" })
    .returning({ id: workspaceUsers.id });
  token = (await createSession(db, workspaceId, user?.id ?? 0, T0, null, "officer")).token;
  holder.ctx = testContext(db).ctx;
});

async function send(body: object) {
  const response = await POST(
    new Request(`${ORIGIN}/api/w/ogs/calendar`, {
      method: "POST",
      headers: {
        origin: ORIGIN,
        "content-type": "application/json",
        cookie: `${SESSION_COOKIE}=${token}`,
      },
      body: JSON.stringify(body),
    }),
    { params: Promise.resolve({ slug: "ogs" }) },
  );
  return { status: response.status, json: (await response.json()) as Record<string, unknown> };
}

/** The titles the Calendar shows for the week, as the page reads them. */
async function titles(): Promise<(string | null)[]> {
  const access = await requireWorkspace(db, "ogs", { get: () => ({ value: token }) }, T0);
  if (!access.ok) throw new Error("signed out");
  return (await calendarDays(db, access, DAY, SUNDAY)).map((p) => p.entry.title);
}

describe("POST /api/w/[slug]/calendar", () => {
  it("adds an entry, takes it out of the week on delete, and puts it back on the officer's Undo", async () => {
    const made = await send({
      action: "create",
      entry: { kind: "other", title: "Bear hunt drill", day: DAY, minute: 1200 },
      requestId: randomUUID(),
    });
    expect(made.status).toBe(200);
    expect(await titles()).toEqual(["Bear hunt drill"]);

    const remove = { action: "delete", entry: made.json.id, scope: "all", week: DAY };
    const requestId = randomUUID();
    const deleted = await send({ ...remove, requestId });
    expect(deleted).toEqual({ status: 200, json: { ok: true, deleted: true } });
    expect(await titles()).toEqual([]);

    const undone = await send({ ...remove, requestId, undo: true });
    expect(undone).toEqual({ status: 200, json: { ok: true } });
    expect(await titles()).toEqual(["Bear hunt drill"]);
  });
});
