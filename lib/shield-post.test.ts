// Which channel the Raid Shield summary goes to (D147) against a real Postgres (PGlite) and a stubbed Discord:
// only the workspace's own Raid Shield channel (a forum there too), never its leaders' channel; a channel
// changed since the first post gets a fresh one; away members are a count, not a name (D137, 2026-11-22).
// No real Discord call; invented names and tokens.
import { beforeAll, beforeEach, describe, expect, it } from "vitest";

import { OWN_ALLIANCE_ID } from "../config/alliances";
import { TEST_ENV } from "./app-context.test-helpers";
import type { Db } from "./db";
import { openTestDb, truncateAll } from "./db.test-helpers";
import { CALLOUT_LIMIT, calloutLength } from "./post-callout";
import { calloutOf, saveCallout } from "./repo/post-touches";
import { setSwitch } from "./repo/workspace-features";
import { recordSignIn, saveWorkspace } from "./repo/workspaces";
import { dailyReads, dailyRosters, memberFacts } from "./schema";
import { shieldChecks } from "./schema-shield";
import { playerReads } from "./schema-squads";
import { postShieldSummary, type PostDeps } from "./shield-post";
import { HOOK_SECRET as SECRET, saveHook } from "./shield-post.test-helpers";
import type { ShieldTarget } from "./shield-read";

const DAY = "2026-11-20";
/** Friday 23:45 ST and Saturday 10:30 ST (UTC−2). */
const FRI = new Date("2026-11-21T01:45:00Z");
const SAT = new Date("2026-11-21T12:30:00Z");
/** Built from a repeated phrase, so no scanner takes them for real webhooks. */
const hook = (c: string) =>
  `https://discord.com/api/webhooks/900000000000000606/${`${c}-test-`.repeat(4)}`;

let db: Db;
let ws = 0;
beforeAll(async () => {
  db = await openTestDb();
});
beforeEach(async () => {
  await truncateAll(db);
  await saveWorkspace(db, {
    unionId: OWN_ALLIANCE_ID,
    slug: "ogs",
    discordGuildId: "1",
    leaderRoleIds: ["2"],
  });
  ws = (await db.query.workspaces.findFirst())?.id ?? 0;
  await db.insert(dailyReads).values({
    day: DAY,
    startedAt: new Date(`${DAY}T23:30:00-02:00`),
    status: "complete",
    callsUsed: 21,
    quotaRemainingBefore: 900,
  });
  await db.insert(dailyRosters).values({
    readDay: DAY,
    unionId: OWN_ALLIANCE_ID,
    memberCount: 2,
    isFresh: true,
    sourceUpdatedAt: new Date(`${DAY}T23:00:00-02:00`),
    memberUids: [1, 2],
    memberNames: ["Wren1", "Wren2"],
    memberPower: [1, 1],
    memberKills: [0, 0],
  });
  await db.insert(shieldChecks).values({ day: DAY, unionId: OWN_ALLIANCE_ID });
  // Friday night's readings: nobody seen with a shield, so the message names both.
  const reading = { unionId: OWN_ALLIANCE_ID, readAt: FRI, shielding: 0, shieldType: 0 };
  await db.insert(playerReads).values([1, 2].map((uid) => ({ ...reading, uid })));
});

/** A webhook the workspace saved, sealed under `secret`; `path` names its invented URL. */
const save = (
  channel: "leaders" | "shield",
  forum = false,
  secret = SECRET,
  path: string = channel,
) => saveHook(db, ws, { channel, url: hook(path), forum, secret });

/** Saturday morning's readings: nobody seen with a shield, so the morning message names both. */
const morningReads = () =>
  db.insert(playerReads).values(
    [1, 2].map((uid) => ({
      ...{ unionId: OWN_ALLIANCE_ID, readAt: SAT, shielding: 0, shieldType: 0 },
      uid,
    })),
  );

/** Discord as a stub: every post and edit, answered with message 900; a forum post needs a title. */
function discord(forum = false) {
  const posts: { method: string; url: string; threadName?: string }[] = [];
  const texts: string[] = [];
  const fetch: typeof globalThis.fetch = async (url, init) => {
    const body = JSON.parse(String(init?.body)) as { content: string; thread_name?: string };
    const method = String(init?.method);
    texts.push(body.content);
    posts.push({
      method,
      url: String(url),
      ...(body.thread_name && { threadName: body.thread_name }),
    });
    if (forum && method === "POST" && !body.thread_name) return new Response(null, { status: 400 });
    return Response.json({ id: "900" });
  };
  let at = FRI;
  const deps: PostDeps = {
    env: { ...TEST_ENV, WORKSPACE_KEYS_SECRET: SECRET },
    fetch,
    now: () => at,
    origin: "https://laptracker.test",
  };
  const post = (now: Date, pass: "night" | "morning", language = "en") => {
    at = now;
    const target: ShieldTarget = {
      unionId: OWN_ALLIANCE_ID,
      workspaceId: ws,
      slug: "ogs",
      key: null,
      settings: { workspaceId: ws, morningMinute: 600, discord: true, language },
    } as ShieldTarget;
    return postShieldSummary(deps, db, { day: DAY, target, pass });
  };
  return {
    posts,
    texts,
    post,
    rename: (names: string[]) => db.update(dailyRosters).set({ memberNames: names }),
  };
}

describe("the Raid Shield summary's channel (D147)", () => {
  it("goes to the Raid Shield channel, as a forum post there, never to the leaders'", async () => {
    await save("leaders");
    await save("shield", true);
    const d = discord(true);
    expect(await d.post(FRI, "night")).toBe(true);
    await morningReads();
    await d.rename(["Ash1", "Ash2"]);
    expect(await d.post(SAT, "morning")).toBe(true);
    expect(d.posts).toEqual([
      { method: "POST", url: `${hook("shield")}?wait=true`, threadName: "Raid Shield check" },
      { method: "PATCH", url: `${hook("shield")}/messages/900?thread_id=900` },
    ]);
  });

  it("posts nothing without a Raid Shield channel, and never calls the leaders' channel", async () => {
    await save("leaders");
    const d = discord();
    expect(await d.post(FRI, "night")).toBe(false);
    expect(d.posts).toEqual([]);
  });

  it("posts nothing, not even to the leaders', when the Raid Shield webhook must be pasted again", async () => {
    await save("leaders");
    await save("shield", false, Buffer.alloc(32, 6).toString("base64"));
    const d = discord();
    expect(await d.post(FRI, "night")).toBe(false);
    expect(d.posts).toEqual([]);
  });

  it("never edits an older channel's message: posts fresh in the new one, then edits only that", async () => {
    // A message posted through the leaders' channel before this change: no `message_hook`.
    await db.update(shieldChecks).set({ messageId: "800", messageHash: "old" });
    await save("shield");
    const d = discord();
    await d.post(FRI, "night");
    await morningReads();
    await save("shield", false, SECRET, "shield-moved");
    await d.rename(["Ash1", "Ash2"]);
    await d.post(SAT, "morning");
    await d.rename(["Fern1", "Fern2"]);
    await d.post(new Date(SAT.getTime() + 15 * 60_000), "morning");
    expect(d.posts.map((p) => `${p.method} ${p.url}`)).toEqual([
      `POST ${hook("shield")}?wait=true`,
      `POST ${hook("shield-moved")}?wait=true`,
      `PATCH ${hook("shield-moved")}/messages/900`,
    ]);
  });
});

describe("the Raid Shield summary's names (D137, 2026-11-22)", () => {
  /** An officer's fact about member `uid`, saved on Friday night. */
  const fact = (uid: number, field: "away" | "status", value: unknown) =>
    db.insert(memberFacts).values({
      ...{ workspaceId: ws, uid, field, version: 1, value },
      ...{ source: "officer", writtenAt: FRI },
    });

  it("shows counts only at the night check: no name, no “unshielded”, in all three languages", async () => {
    await save("shield");
    await fact(2, "away", { text: "Trip", from: "2026-11-21", until: "2026-11-23" });
    const d = discord();
    for (const language of ["en", "pt-BR", "fr"]) {
      expect(await d.post(FRI, "night", language)).toBe(true);
    }
    const [en = "", pt = "", fr = ""] = d.texts;
    expect(en).toContain(
      "Night check 23:45 ST: shield seen on 0 of 2 maps so far; maps refresh after the reset",
    );
    expect(pt).toContain("escudo visto em 0 de 2 mapas até agora");
    expect(fr).toContain("bouclier vu sur 0 cartes sur 2 pour l’instant");
    for (const text of d.texts) {
      expect(text).not.toMatch(/Wren|away|ausente|absent|unshielded|sem escudo|sans bouclier/i);
    }
  });

  it("names those not seen, away members left out, only after the morning check", async () => {
    await save("shield");
    await fact(2, "away", { text: "Trip", from: "2026-11-21", until: "2026-11-23" });
    await morningReads();
    const d = discord();
    expect(await d.post(SAT, "morning")).toBe(true);
    const [text = ""] = d.texts;
    expect(text).toContain("\nNot seen this morning: Wren1 · 1 away, left out\n");
    expect(text).not.toContain("Wren2");
  });

  it("names nobody this morning when everyone not seen is away or on a break, and counts them in the plural", async () => {
    await save("shield");
    await fact(1, "status", "break");
    await fact(2, "away", { text: "Viagem", from: "2026-11-21", until: "2026-11-23" });
    const morning = { unionId: OWN_ALLIANCE_ID, readAt: SAT, shielding: 0, shieldType: 0 };
    await db.insert(playerReads).values([1, 2].map((uid) => ({ ...morning, uid })));
    const d = discord();
    expect(await d.post(SAT, "morning", "pt-BR")).toBe(true);
    const [text] = d.texts;
    expect(text).toContain("\nSem escudo visto hoje de manhã: 2 ausentes, fora da lista\n");
    expect(text).not.toMatch(/Wren/);
  });
});

describe("the alliance's own line on the Raid Shield summary (D156)", () => {
  it("opens the summary with the line, pinging no one, and leaves it out while the switch is off", async () => {
    await save("shield");
    const by = await recordSignIn(db, ws, "ogs-ana", "Ana", FRI);
    const callout = "Shields up, family @everyone <@&7>";
    await saveCallout(db, { workspaceId: ws, post: "shield", callout, by, at: FRI });
    const d = discord();
    expect(await d.post(FRI, "night")).toBe(true);
    const [first, title] = (d.texts[0] ?? "").split("\n");
    expect(first).toBe("Shields up, family @\u200beveryone <@\u200b&7\\>");
    expect(title).toBe("**Raid Shield check**");
    // The owner's switch off: the line stays stored, and the morning's edit leaves it out.
    await setSwitch(db, ws, "post_callouts", false, FRI);
    expect(await d.post(SAT, "morning")).toBe(true);
    expect(d.posts.map((p) => p.method)).toEqual(["POST", "PATCH"]);
    expect(d.texts[1]?.split("\n")[0]).toBe("**Raid Shield check**");
    expect(await calloutOf(db, ws, "shield")).toBe(callout);
  });

  it("leaves out a line that would take the summary past Discord's 2,000 characters", async () => {
    await save("shield");
    const by = await recordSignIn(db, ws, "ogs-ana", "Ana", FRI);
    // 120 graphemes, each a letter under 16 stacked accents: short to count, long to send.
    const callout = `a${"\u0301".repeat(16)}`.repeat(CALLOUT_LIMIT);
    expect(calloutLength(callout)).toBe(CALLOUT_LIMIT);
    await saveCallout(db, { workspaceId: ws, post: "shield", callout, by, at: FRI });
    const d = discord();
    expect(await d.post(FRI, "night")).toBe(true);
    const [text = ""] = d.texts;
    expect(text.length).toBeLessThanOrEqual(2000);
    expect(text.startsWith("**Raid Shield check**\n")).toBe(true);
    expect(text).not.toContain("\u0301");
  });
});
