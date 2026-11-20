// Issue 471: what the desk's pages read for Alpha's officer when the address names Bravo's records (a notice,
// its history, posts and reviews, a draft, a roll call, a garrison plan, a member card), and Home's activity
// pages. Each finds nothing of Bravo's. The pages call these reads after requireWorkspace, with the id from
// the address. Invented names only.
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import type { AppContext } from "@/lib/app-context";
import type { Db } from "@/lib/db";
import { openTestDb } from "@/lib/db.test-helpers";
import { requireWorkspace, type WorkspaceAccess } from "@/lib/private/access";
import { WORKSPACE_DICTIONARIES } from "@/lib/private/dictionary";
import { garrisonView } from "@/lib/private/garrison";
import { draftView } from "@/lib/private/import-view";
import { memberCard } from "@/lib/private/member-card";
import { lastPublish } from "@/lib/private/notice-publish";
import { noticeReviews } from "@/lib/private/notice-reviews";
import { noticeDetail, noticeHistory } from "@/lib/private/notices";
import { callView } from "@/lib/private/roll-call-view";

import {
  call,
  type Ids,
  idsOf,
  SEED_AT,
  seedTwo,
  type Two,
  WEEK,
} from "./cross-workspace.test-helpers";

const holder = vi.hoisted(() => ({ ctx: null as AppContext | null }));
vi.mock("@/lib/app-context", async (original) => ({
  ...(await original<typeof import("@/lib/app-context")>()),
  getAppContext: () => holder.ctx,
}));

const ZONE = "Etc/GMT+2";
let db: Db;
let two: Two;
let b: Ids;
let a: WorkspaceAccess;
beforeAll(async () => {
  db = await openTestDb();
});
beforeEach(async () => {
  two = await seedTwo(db, holder);
  b = await idsOf(db, "bravo");
  const found = await requireWorkspace(
    db,
    "alpha",
    { get: () => ({ value: two.token.alpha }) },
    SEED_AT,
  );
  if (!found.ok) throw new Error("no access");
  a = found;
});

describe("the desk's pages given Bravo's ids, for Alpha's officer (issue 471)", () => {
  it("find no notice, history, post or review of Bravo's, and offer only Alpha's officers as reviewers", async () => {
    for (const n of b.notices) {
      expect(await noticeDetail(db, a, n)).toBeNull();
      expect((await noticeHistory(db, a, n)).versions).toEqual([]);
      expect(await lastPublish(db, a, n)).toBeNull();
      expect((await noticeReviews(db, a, n)).list).toEqual([]);
    }
    const [ours = 0] = (await idsOf(db, "alpha")).notices;
    expect((await noticeReviews(db, a, ours)).officers.map((o) => o.id)).not.toContain(b.officer);
  });

  it("find no draft, roll call, garrison plan or member card of Bravo's", async () => {
    for (const d of b.drafts) expect(await draftView(db, a, d, SEED_AT)).toBeNull();
    for (const c of b.calls) expect(await callView(db, a, { id: c }, "en", ZONE)).toBeNull();
    for (const entry of b.entries) {
      expect(await callView(db, a, { entry, week: WEEK }, "en", ZONE)).toBeNull();
      expect(await garrisonView(db, a, entry, WEEK)).toBeNull();
    }
    const at = { now: SEED_AT, zone: ZONE, language: "en" as const, t: WORKSPACE_DICTIONARIES.en };
    expect(await memberCard(db, a, 202, at)).toBeNull();
    expect(await memberCard(db, a, 101, at)).not.toBeNull();
  });

  it("Home's activity pages carry Alpha's lines only", async () => {
    const page = await call(two, "activity", {
      query: `?before=${SEED_AT.getTime() + 86_400_000}`,
    });
    expect(page.status).toBe(200);
    const text = JSON.stringify(page.json);
    expect(text).toContain("Officer alpha");
    expect(text).not.toMatch(/Officer bravo|Bravo plan|Bravo rules|Bravo old|Bryn Later/);
  });
});
