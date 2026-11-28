// POST /api/w/[slug]/data-export (D125): an officer downloads a ZIP with a CSV per table the workspace owns
// (deleted records in their own files), the notices' pictures and a README; no private roster field, no
// key, no session and no Discord id is in any byte of it. A member and another workspace are refused, and
// a workspace gets 3 downloads a day.
import { eq } from "drizzle-orm";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import type { AppContext } from "@/lib/app-context";
import { TEST_ENV, testContext } from "@/lib/app-context.test-helpers";
import type { Db } from "@/lib/db";
import { openTestDb, truncateAll } from "@/lib/db.test-helpers";
import { createSession, SESSION_COOKIE } from "@/lib/private/session";
import { dailyReads, dailyRosters, memberFacts, workspaces, workspaceUsers } from "@/lib/schema";
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
import { unzip } from "@/lib/zip.test-helpers";

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
beforeEach(() => seed());

/** nse with a row in every table it owns; ogs empty, or with rows of its own too (`other`). */
async function seed(other = false) {
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
  if (!other) return;
  await db.insert(dailyRosters).values({
    readDay: "2026-11-18",
    unionId: ogs.unionId,
    memberCount: 1,
    isFresh: true,
    memberUids: [202],
    memberNames: ["Bea Invented"],
    memberPower: [2000],
    memberKills: [20],
  });
  await seedEverything(db, ogs);
}

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
      "member-self-reports",
      "new-members",
      "name-aliases",
      "calendar-entries",
      "calendar-weeks",
      "garrison-plans",
      "kvk-plans",
      "kvk-claims",
      "notices",
      "notice-texts",
      "notice-posts",
      "notice-reviews",
      "notice-review-outcomes",
      "notice-pictures",
      "roll-calls",
      "roll-call-marks",
      "roll-call-teams",
      "roll-call-results",
      "follow-ups",
      "thefts",
      "theft-steps",
      "theft-attackers",
      "thanks",
      "thanks-taken-down",
      "start-here",
      "post-callouts",
      "posts",
      "screenshot-drafts",
      "alliance-duel-points",
      "screenshot-checks",
      "squads",
      "player-reads",
      "player-history",
      "tracker-key-changes",
      "data-requests",
      "former-members",
      "activity",
    ];
    const deleted = [
      "new-members",
      "calendar-entries",
      "notices",
      "notice-reviews",
      "roll-calls",
      "follow-ups",
      "thefts",
    ];
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
    // Portuguese and French files use ";", as Excel expects there (owner, 2026-11-19).
    expect(csv("notice-texts.csv").startsWith("\uFEFFid;notice_id;workspace_id")).toBe(true);
    expect(csv("notice-texts.csv")).toContain("Olá, aliança");
    expect(csv("member-facts.csv")).toContain("101;Ana Example;notes");
    expect(csv("member-facts.csv")).toContain("Officer nse");
    expect(csv("thefts.csv").split("\r\n")).toHaveLength(3);
    expect(csv("thefts-deleted.csv").split("\r\n")).toHaveLength(3);
    expect(csv("README.txt")).toContain("Arquivos");
    // D132: a tracker read goes as its columns; its raw body (90 days of them) stays out.
    const reads = csv("player-reads.csv").slice(1).split("\r\n")[0]?.split(";") ?? [];
    expect(reads).toContain("shielding");
    expect(reads).not.toContain("raw_json");
    // Issue 782: the officer's What's new seen version is screen state, not alliance data.
    expect(csv("people.csv").slice(1).split("\r\n")[0]?.split(";")).not.toContain("whats_new_seen");
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
      const header = data.toString("utf8").slice(1).split("\r\n")[0]?.split(";") ?? [];
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

  it("holds the same bytes whether or not another workspace has rows of its own (issue 471)", async () => {
    const requestId = ID();
    const alone = unzip(
      new Uint8Array(await (await post(tokens.officer, requestId)).arrayBuffer()),
    );
    await seed(true);
    const res = await post(tokens.officer, requestId);
    const beside = unzip(new Uint8Array(await res.arrayBuffer()));
    expect([...beside.keys()]).toEqual([...alone.keys()]);
    // Seeded columns left to the database's now() or a random request id differ between the two seeds, and
    // the download's own line takes the next serial id after ogs's rows; a row of ogs's would add a line.
    const text = (data?: Buffer) =>
      data
        ?.toString("utf8")
        .replace(/^\d+(?=[,;])/gm, "<id>")
        .replace(/\d{4}-\d\d-\d\dT[\d:.]+Z/g, "<time>")
        .replace(/[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}/g, "<uuid>");
    for (const [name, data] of alone) expect(text(beside.get(name)), name).toBe(text(data));
    expect(Buffer.concat([...beside.values()]).toString("utf8")).not.toMatch(
      /Bea Invented|Officer ogs/,
    );
  });

  it("writes why each former member left, in the officer's words, in former-members.csv (issue 469)", async () => {
    const [nse] = await db.select().from(workspaces).where(eq(workspaces.slug, "nse"));
    await db
      .insert(dailyReads)
      .values({ day: "2026-11-10", startedAt: SEED_AT, status: "complete" });
    await db.insert(dailyRosters).values({
      readDay: "2026-11-10",
      unionId: nse?.unionId ?? 0,
      memberCount: 2,
      sourceUpdatedAt: new Date("2026-11-10T12:00:00Z"),
      isFresh: true,
      memberUids: [101, 102],
      memberNames: ["Ana Example", "Bo Invented"],
      memberPower: [1000, 2000],
      memberKills: [10, 20],
    });
    await db.insert(memberFacts).values({
      workspaceId: nse?.id ?? 0,
      uid: 102,
      field: "leftReason",
      version: 1,
      value: { reason: "otherAlliance", note: "moved to a friend" },
      source: "officer",
      writtenAt: SEED_AT,
    });

    const files = unzip(new Uint8Array(await (await post(tokens.officer)).arrayBuffer()));
    const lines = files.get("former-members.csv")?.toString("utf8").slice(1).split("\r\n");
    expect(lines?.[0]).toBe("uid,name,last_seen,might,kills,left_reason,left_note");
    expect(lines?.[1]).toMatch(
      /^102,Bo Invented,2026-11-\d\d,2000,20,Joined another alliance,moved to a friend$/,
    );
  });

  it("refuses a member's session and another workspace's officer, and records nothing", async () => {
    for (const token of [tokens.member, tokens.other, "no-session"]) {
      const res = await post(token);
      expect([res.status, await res.json()]).toEqual([401, { code: "signed_out" }]);
    }
    const lines = await db.select().from(workspaceDataEvents);
    expect(lines.filter((l) => l.action === "download")).toEqual([]);
  });

  it("allows 3 ZIPs in 24 hours per workspace, a repeated request id's included", async () => {
    const first = ID();
    const english = await post(tokens.officer, first);
    expect(english.status).toBe(200);
    // English files keep ",".
    const people = unzip(new Uint8Array(await english.arrayBuffer())).get("people.csv");
    expect(people?.toString("utf8").startsWith("\uFEFFid,workspace_id,")).toBe(true);
    // The same request again builds a ZIP, so it counts; it adds no second Home line.
    expect((await post(tokens.officer, first)).status).toBe(200);
    expect((await post(tokens.officer)).status).toBe(200);
    const fourth = await post(tokens.officer);
    expect([fourth.status, await fourth.json()]).toEqual([429, { code: "rate_limited" }]);
    const replay = await post(tokens.officer, first);
    expect([replay.status, await replay.json()]).toEqual([429, { code: "rate_limited" }]);
    const lines = await db.select().from(workspaceDataEvents);
    expect(lines.filter((l) => l.action === "download")).toHaveLength(2);
  });
});
