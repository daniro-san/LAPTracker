// D110: the desk app's share target (/w/[slug]/share). The request is Android's: a navigation the browser makes itself
// (Sec-Fetch-Site none, Origin null), multipart, the pictures in `shots`. The OCR is a stand-in that returns
// a recorded Alliance Duel page, so the drafts are the real ones.
import { eq } from "drizzle-orm";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import type { AppContext } from "@/lib/app-context";
import { testContext } from "@/lib/app-context.test-helpers";
import { T0 } from "@/lib/collector.test-helpers";
import type { Db } from "@/lib/db";
import { openTestDb, truncateAll } from "@/lib/db.test-helpers";
import { MAX_PICTURES } from "@/lib/private/import";
import { endReading, MAX_UPLOAD, startReading } from "@/lib/private/import-read";
import { createSession, SESSION_COOKIE } from "@/lib/private/session";
import { appErrors, workspaces, workspaceUsers } from "@/lib/schema";
import { screenshotDrafts } from "@/lib/schema-import";
import { recorded } from "@/lib/screenshot/test-helpers";

const holder = vi.hoisted(() => ({ ctx: null as AppContext | null }));
vi.mock("@/lib/app-context", async (original) => ({
  ...(await original<typeof import("@/lib/app-context")>()),
  getAppContext: () => holder.ctx,
}));
const reads = vi.hoisted(() => ({ calls: [] as boolean[], fail: false }));
vi.mock("@/lib/private/import-read", async (original) => ({
  ...(await original<typeof import("@/lib/private/import-read")>()),
  readUpload: async (_bytes: Uint8Array, statusBar: boolean) => {
    reads.calls.push(statusBar);
    if (reads.fail) throw new Error("worker died");
    return recorded("27-alliance-duel-weekly-mine");
  },
}));

const { POST } = await import("./route");

const ORIGIN = "https://laptracker.test";
const picture = (size = 64) => new File([new Uint8Array(size)], "shot.png", { type: "image/png" });

function share(token: string | null, files: File[], site = "none") {
  const form = new FormData();
  for (const f of files) form.append("shots", f);
  const headers = new Headers({ origin: "null", "sec-fetch-site": site });
  if (token) headers.set("cookie", `${SESSION_COOKIE}=${token}`);
  const request = new Request(`${ORIGIN}/w/ogs/share`, { method: "POST", headers, body: form });
  return POST(request, { params: Promise.resolve({ slug: "ogs" }) });
}

let db: Db;
const tokens = { officer: "", member: "" };
beforeAll(async () => {
  db = await openTestDb();
});
beforeEach(async () => {
  await truncateAll(db);
  reads.calls = [];
  reads.fail = false;
  holder.ctx = testContext(db).ctx;
  const [ws] = await db
    .insert(workspaces)
    .values({ unionId: 67111155, slug: "ogs", discordGuildId: "1", leaderRoleIds: ["2"] })
    .returning({ id: workspaces.id });
  for (const tier of ["officer", "member"] as const) {
    const [user] = await db
      .insert(workspaceUsers)
      .values({ workspaceId: ws?.id ?? 0, discordUserId: `ogs-${tier}`, displayName: tier })
      .returning({ id: workspaceUsers.id });
    tokens[tier] = (await createSession(db, ws?.id ?? 0, user?.id ?? 0, T0, null, tier)).token;
  }
});

describe("the phone's share target (D110)", () => {
  it("makes the drafts for an officer of the session's workspace and opens the review", async () => {
    const res = await share(tokens.officer, [picture(), picture()]);
    const drafts = await db.select().from(screenshotDrafts);
    // Two pages of one ranking: one draft, read with the status bar dropped.
    expect(drafts.map((d) => [d.kind, d.source, d.sentBy])).toEqual([
      ["alliance_duel", "desk", "officer"],
    ]);
    expect(reads.calls).toEqual([true, true]);
    expect([res.status, res.headers.get("location")]).toEqual([
      303,
      `/w/ogs/shots/${drafts[0]?.id}`,
    ]);
  });

  it("refuses a member or no session: no reading, no draft, on to the sign-in", async () => {
    const member = await share(tokens.member, [picture()]);
    const none = await share(null, [picture()]);
    expect([member.status, member.headers.get("location")]).toEqual([303, "/w/ogs?shared=again"]);
    expect([none.status, none.headers.get("location")]).toEqual([303, "/w/ogs?shared=again"]);
    expect(reads.calls).toEqual([]);
    expect(await db.select().from(screenshotDrafts)).toEqual([]);
  });

  it("holds the limits: 16 pictures, 4 MB each, a share with a picture, our headers only", async () => {
    const tooMany = Array.from({ length: MAX_PICTURES + 1 }, () => picture());
    for (const [files, why] of [
      [tooMany, "limit"],
      [[picture(MAX_UPLOAD + 1)], "limit"],
      [[], "empty"],
    ] as const) {
      const res = await share(tokens.officer, [...files]);
      expect(res.headers.get("location")).toBe(`/w/ogs?shared=${why}`);
    }
    // Unexpected headers (a cross-site form, or a phone that sends others): a desk page, not JSON.
    const crossSite = await share(tokens.officer, [picture()], "cross-site");
    expect([crossSite.status, crossSite.headers.get("location")]).toEqual([
      303,
      "/w/ogs?shared=failed",
    ]);
    expect(reads.calls).toEqual([]);
    expect(await db.select().from(screenshotDrafts)).toEqual([]);
  });

  it("records a reading that fails, makes nothing and says so", async () => {
    reads.fail = true;
    const res = await share(tokens.officer, [picture()]);
    expect(res.headers.get("location")).toBe("/w/ogs?shared=failed");
    expect(await db.select().from(screenshotDrafts)).toEqual([]);
    const [error] = await db.select().from(appErrors);
    expect([error?.route, error?.message]).toEqual(["/w/[slug]/share", "route Error"]);
    // The code alone reaches app_errors: never what was read or the reader's message.
    expect(JSON.stringify(error?.detail)).toContain("w.import.share_failed:other");
    expect(JSON.stringify(error?.detail)).not.toContain("worker died");
  });

  it("waits its turn: one reading at a time per officer, as Read from a screenshot (D109)", async () => {
    const [officer] = await db
      .select({ id: workspaceUsers.id })
      .from(workspaceUsers)
      .where(eq(workspaceUsers.displayName, "officer"));
    const id = officer?.id ?? 0;
    expect(startReading(id)).toBe(true);
    try {
      const res = await share(tokens.officer, [picture()]);
      expect(res.headers.get("location")).toBe("/w/ogs?shared=busy");
      expect(reads.calls).toEqual([]);
    } finally {
      endReading(id);
    }
    // Freed after a share, so the next one reads.
    await share(tokens.officer, [picture()]);
    expect(startReading(id)).toBe(true);
    endReading(id);
  });
});
