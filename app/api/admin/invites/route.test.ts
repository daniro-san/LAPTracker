// POST /api/admin/invites (D130, issue 453): PIN only; the link is answered once and only its hash is kept; a
// new link cancels the alliance's earlier one; approving a request makes the same link and marks it approved;
// an alliance with a workspace gets no link. Invented names only.
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import type { AppContext } from "@/lib/app-context";
import { TEST_PIN, testContext } from "@/lib/app-context.test-helpers";
import type { Db } from "@/lib/db";
import { openTestDb, truncateAll } from "@/lib/db.test-helpers";
import { insertRequest } from "@/lib/repo/alliance-invites";
import { workspaces } from "@/lib/schema";
import { accessRequests, allianceInvites } from "@/lib/schema-invites";

const holder = vi.hoisted(() => ({ ctx: null as AppContext | null }));
vi.mock("@/lib/app-context", async (original) => ({
  ...(await original<typeof import("@/lib/app-context")>()),
  getAppContext: () => holder.ctx,
}));

const route = await import("./route");

const WACK = 67110992;

let db: Db;
beforeAll(async () => {
  db = await openTestDb();
});
beforeEach(async () => {
  await truncateAll(db);
  holder.ctx = testContext(db).ctx;
});

const post = async (pin: string, body: unknown) => {
  const res = await route.POST(
    new Request("https://laptracker.test/api/admin/invites", {
      method: "POST",
      headers: { "x-real-ip": "198.51.100.1", "x-edit-pin": pin },
      body: JSON.stringify(body),
    }),
  );
  return { status: res.status, body: (await res.json()) as Record<string, unknown> };
};

describe("POST /api/admin/invites (D130)", () => {
  it("answers the link once, keeps only its hash, and a new link cancels the earlier one", async () => {
    expect((await post("wrong-pin", { action: "create", union_id: WACK })).status).toBe(401);
    const first = await post(TEST_PIN, { action: "create", union_id: WACK });
    const second = await post(TEST_PIN, { action: "create", union_id: WACK });
    expect(String(first.body.link)).toMatch(/^https:\/\/laptracker\.test\/api\/w\/invite\/\d+\./);
    const rows = await db.select().from(allianceInvites).orderBy(allianceInvites.id);
    const secret = String(second.body.link).split(".").at(-1) ?? "";
    expect(JSON.stringify(rows)).not.toContain(secret);
    expect(rows.map((r) => r.cancelledAt !== null)).toEqual([true, false]);
  });

  it("approves a request with the same link, and gives none to an alliance with a workspace", async () => {
    const request = {
      unionId: WACK,
      playerName: "Vellamo Rook",
      claimedRole: "r5" as const,
      rosterMatch: "not_found" as const,
      rosterRank: null,
      rosterSeenAt: null,
    };
    await insertRequest(db, request, new Date());
    const [row] = await db.select().from(accessRequests);
    const approved = await post(TEST_PIN, { action: "approve", request_id: row?.id });
    expect(approved.status).toBe(200);
    expect(String(approved.body.link)).toContain("/api/w/invite/");
    const [after] = await db.select().from(accessRequests);
    expect(after?.decision).toBe("approved");
    expect((await post(TEST_PIN, { action: "approve", request_id: row?.id })).body.code).toBe(
      "decided",
    );
    await db.insert(workspaces).values({
      unionId: WACK,
      slug: "wack",
      discordGuildId: "700000000000000101",
      leaderRoleIds: [],
    });
    expect((await post(TEST_PIN, { action: "create", union_id: WACK })).body.code).toBe(
      "has_workspace",
    );
  });
});
