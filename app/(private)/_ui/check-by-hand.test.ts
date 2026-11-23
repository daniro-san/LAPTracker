// Raid prep's "To check by hand" (issue 726) against a real Postgres (PGlite), built as the marking page
// builds it: the list holds exactly the members it counts, each map says its day and its age against the reset
// (00:00 ST) across midnight, and the grid never says "Nobody left to mark" before an officer has marked.
// One raid (KvK Sat 2026-11-21), its two checks, one member away. Names are invented.
import { randomUUID } from "node:crypto";

import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import type { Db } from "@/lib/db";
import { openTestDb, truncateAll } from "@/lib/db.test-helpers";
import { requireWorkspace } from "@/lib/private/access";
import { WORKSPACE_DICTIONARIES } from "@/lib/private/dictionary";
import { saveFacts } from "@/lib/private/member-facts";
import { prepView } from "@/lib/private/raid-prep";
import { addCall, markOne, openOccasion } from "@/lib/private/roll-call";
import { callRead } from "@/lib/private/roll-call-view";
import { createSession } from "@/lib/private/session";
import { dailyReads, dailyRosters, workspaces, workspaceUsers } from "@/lib/schema";
import { rollCallMarks } from "@/lib/schema-rollcall";
import { playerReads } from "@/lib/schema-squads";

import { prepHead, prepRows } from "./prep-data";
import { RaidPrepMarks } from "./RaidPrepMarks";
import { markRows, markWords, rollWords } from "./roll-call-data";
import { filterOf } from "./roll-call-grid";

// The marking page's client parts read the router; nothing here navigates.
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: () => undefined }) }));

const OGS = 67111155;
/** Saturday 10:30 ST (UTC−2), after both checks. */
const NOW = new Date("2026-11-21T12:30:00Z");
const ZONE = "Etc/GMT+2";
const NAMES: Record<number, string> = {
  101: "Aster Vale",
  102: "Briar Holt",
  103: "Cedar Moss",
  104: "Dove Lark",
  105: "Elm Reed",
  106: "Fern Ash",
  107: "Gale Rook",
};
const UIDS = Object.keys(NAMES).map(Number);
const at = (iso: string) => new Date(iso);

let db: Db;
beforeAll(async () => {
  db = await openTestDb();
});
beforeEach(async () => {
  await truncateAll(db);
  await db.insert(dailyReads).values({ day: "2026-11-20", startedAt: NOW, status: "complete" });
  await db.insert(dailyRosters).values({
    readDay: "2026-11-20",
    unionId: OGS,
    memberCount: UIDS.length,
    isFresh: true,
    sourceUpdatedAt: NOW,
    memberUids: UIDS,
    memberNames: UIDS.map((u) => NAMES[u] as string),
    memberPower: UIDS.map(() => 1000),
    memberKills: UIDS.map(() => 0),
  });
  // Night check, Fri 23:31 ST. The 22:33 ST map was scanned at 22:33:40 ST.
  const night = { unionId: OGS, readAt: at("2026-11-21T01:31:00Z"), shieldType: 0 };
  const map2233 = at("2026-11-21T00:33:40Z");
  await db.insert(playerReads).values([
    { ...night, uid: 101, shielding: 1, mapUpdatedAt: map2233 },
    { ...night, uid: 102, shielding: 0, mapUpdatedAt: map2233 },
    // A Thursday 10:07 ST map, 37 h 53 min before the reset.
    { ...night, uid: 103, shielding: 1, mapUpdatedAt: at("2026-11-19T12:07:00Z") },
    { ...night, uid: 106, shielding: 0, mapUpdatedAt: map2233 },
  ]);
  // Morning check, Sat 10:01 ST.
  const morning = { unionId: OGS, readAt: at("2026-11-21T12:01:00Z"), shieldType: 0 };
  await db.insert(playerReads).values([
    { ...morning, uid: 102, shielding: 1, mapUpdatedAt: at("2026-11-21T09:15:00Z") },
    { ...morning, uid: 103, shielding: 1, mapUpdatedAt: at("2026-11-21T06:36:00Z") },
    { ...morning, uid: 106, shielding: 1, mapUpdatedAt: at("2026-11-21T02:31:00Z") },
  ]);
});

async function officer() {
  const [ws] = await db
    .insert(workspaces)
    .values({ unionId: OGS, slug: "ogs", discordGuildId: "1", leaderRoleIds: ["2"] })
    .returning({ id: workspaces.id });
  const [user] = await db
    .insert(workspaceUsers)
    .values({
      workspaceId: ws?.id ?? 0,
      discordUserId: "ogs-ana",
      displayName: "Ana",
      lastLoginAt: NOW,
    })
    .returning({ id: workspaceUsers.id });
  const { token } = await createSession(db, ws?.id ?? 0, user?.id ?? 0, NOW, null, "officer");
  const access = await requireWorkspace(db, "ogs", { get: () => ({ value: token }) }, NOW);
  if (!access.ok) throw new Error("no access");
  return access;
}

/**
 * Saturday's Raid prep, 105 away on raid day, read as its page reads it: `tracker` holds ✓ marks the tick
 * wrote before issue 726 (version 1, no officer), then these officer taps on top.
 */
async function raidPrep(
  marks: Record<number, "yes" | "no">,
  language: "en" | "fr" = "en",
  tracker: number[] = [],
) {
  const access = await officer();
  const away = { text: "trip", from: "2026-11-20", until: "2026-11-22" };
  await saveFacts(
    db,
    access,
    105,
    [{ field: "away", version: 0, value: away, source: "officer" }],
    NOW,
  );
  const occasion = await addCall(db, access, { kind: "shield", day: "2026-11-21" }, randomUUID());
  const rollCallId = "id" in occasion ? occasion.id : 0;
  for (const uid of tracker)
    await db.insert(rollCallMarks).values({
      rollCallId,
      uid,
      part: "main",
      version: 1,
      mark: "yes",
      byTracker: true,
      writtenAt: at("2026-11-21T01:40:00Z"),
    });
  for (const [uid, mark] of Object.entries(marks)) {
    const version = tracker.includes(Number(uid)) ? 1 : 0;
    await markOne(db, access, { occasion, uid: Number(uid), mark, version }, NOW);
  }
  const read = await callRead(db, access, occasion, language, ZONE);
  const opened = await openOccasion(db, access, occasion);
  if (!read || !opened) throw new Error("no roll call");
  const view = await prepView(db, access, opened, { zone: ZONE, now: NOW }, read.loaded);
  const t = WORKSPACE_DICTIONARIES[language];
  const rows = markRows(read.view.rows, { t, language });
  return {
    occasion,
    rows,
    t,
    language,
    prep: prepRows(view, t, ZONE, language),
    head: prepHead(view, t, ZONE),
  };
}

/** The page as the marking page renders it, on the All chip so every tile shows. */
const render = (p: Awaited<ReturnType<typeof raidPrep>>, filter = "all") =>
  renderToStaticMarkup(
    createElement(RaidPrepMarks, {
      slug: "ogs",
      occasion: p.occasion,
      rows: p.rows,
      words: rollWords(p.t),
      marks: markWords("shield", p.t),
      language: p.language,
      today: "2026-11-21",
      prep: p.prep,
      head: p.head,
      filter: filterOf(filter),
      opened: null,
    }),
  );

/** The names of the tiles that say "Check by hand", in name order. */
const taggedTiles = (html: string) =>
  html
    .split("<li ")
    .filter((tile) => tile.includes("Check by hand ·"))
    .map((tile) => /aria-label="Shield up: ⁨?([^"⁩]+)/.exec(tile)?.[1])
    .sort();

describe("Raid prep: To check by hand (issue 726)", () => {
  it("lists exactly the members it counts: no shield near the reset, no map within 3 h, no reading", async () => {
    // 107 has no reading but an officer marked ✗: checked by hand already. 105 is away.
    const page = await raidPrep({ 107: "no" });
    // 101: a shield on the 22:33 map, the only one within 3 h. 102: none on the 22:33 map. 103: Thursday's
    // map and 04:36's, both over 3 h away. 104: no reading. 106: none at 22:33, one at 00:31: 00:00 unknown.
    expect(page.head.hand).toEqual([102, 103, 104, 106]);
    expect(page.prep[102]?.hand).toBe("Check by hand · no shield seen");
    expect(page.prep[103]?.hand).toBe("Check by hand · no map within 3 h of the reset");
    expect(page.prep[104]?.hand).toBe("Check by hand · no reading");
    expect(page.prep[101]?.hand).toBeNull();
    const html = render(page);
    expect(html).toContain(">To check by hand: 4<");
    expect(html).toContain(">Show the 4<");
    expect(taggedTiles(html)).toEqual(["Briar Holt", "Cedar Moss", "Dove Lark", "Fern Ash"]);
    // "Mark ✓ the n seen with a shield" leaves them out: 101 only, not 102, 103 or 106.
    expect(html).toContain(">Mark ✓ the 1 seen with a shield</button>");
  });

  it("keeps a member whose reading has no map time on the list: no map near the reset", async () => {
    // Fri 23:31 ST, a shield seen but no map time: the read's own time is no map.
    await db.insert(playerReads).values({
      unionId: OGS,
      uid: 104,
      readAt: at("2026-11-21T01:31:00Z"),
      shieldType: 0,
      shielding: 1,
      mapUpdatedAt: null,
    });
    const page = await raidPrep({});
    expect(page.head.hand).toContain(104);
    expect(page.prep[104]?.hand).toBe("Check by hand · no map within 3 h of the reset");
  });

  it("does not say Nobody left to mark while every mark is the tracker's", async () => {
    const page = await raidPrep({}, "en", [101, 102, 103, 104, 106, 107]);
    expect(page.head.looked).toBe(false);
    const html = render(page, "todo");
    expect(html).not.toContain("Nobody left to mark.");
    expect(html).toContain("No officer has marked yet: every Shield mark so far is the tracker’s.");
  });

  it("says Nobody left to mark once an officer has marked", async () => {
    const page = await raidPrep({ 101: "yes" }, "en", [101, 102, 103, 104, 106, 107]);
    expect(page.head.looked).toBe(true);
    expect(render(page, "todo")).toContain("Nobody left to mark.");
  });

  it("says each map's day and its age against the reset, across midnight", async () => {
    const { prep } = await raidPrep({});
    const maps = (uid: number) => prep[uid]?.tracker?.checks.map((c) => `${c.scan} · ${c.age}`);
    // Counted from the map's minute: 22:33:40 reads 22:33 and 1 h 27 min.
    expect(maps(101)).toEqual(["map Fri 22:33 ST · 1 h 27 min before reset"]);
    expect(maps(103)).toEqual([
      "map Thu 10:07 ST · 37 h 53 min before reset",
      "map Sat 04:36 ST · 4 h 36 min after reset",
    ]);
    // Across midnight: the day changes with the map, and its age turns from before to after the reset.
    expect(maps(106)).toEqual([
      "map Fri 22:33 ST · 1 h 27 min before reset",
      "map Sat 00:31 ST · 31 min after reset",
    ]);
  });

  it("says the map's day and age in the officer's language", async () => {
    const fr = await raidPrep({}, "fr");
    expect(fr.prep[102]?.tracker?.checks.map((c) => `${c.scan} · ${c.age}`)).toEqual([
      "carte ven. 22:33 ST · 1 h 27 min avant le reset",
      "carte sam. 07:15 ST · 7 h 15 min après le reset",
    ]);
  });
});
