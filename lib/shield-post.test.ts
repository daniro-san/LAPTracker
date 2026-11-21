// Which channel the Raid Shield summary goes to (D147) against a real Postgres (PGlite) and a stubbed Discord:
// the workspace's own Raid Shield channel when saved (a forum there too), else its leaders' channel; a
// channel changed since the first post gets a fresh one. No real Discord call; invented names and tokens.
import { beforeAll, beforeEach, describe, expect, it } from "vitest";

import { OWN_ALLIANCE_ID } from "../config/alliances";
import { TEST_ENV } from "./app-context.test-helpers";
import type { Db } from "./db";
import { openTestDb, truncateAll } from "./db.test-helpers";
import { storeWebhook } from "./repo/workspace-discord";
import { saveWorkspace } from "./repo/workspaces";
import { dailyReads, dailyRosters } from "./schema";
import { shieldChecks } from "./schema-shield";
import { playerReads } from "./schema-squads";
import { postShieldSummary, type PostDeps } from "./shield-post";
import type { ShieldTarget } from "./shield-read";
import { sealKey } from "./workspace-keys";

const DAY = "2026-11-20";
/** Friday 23:45 ST and Saturday 10:30 ST (UTC−2). */
const FRI = new Date("2026-11-21T01:45:00Z");
const SAT = new Date("2026-11-21T12:30:00Z");
const SECRET = Buffer.alloc(32, 5).toString("base64");
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

/** A webhook the workspace saved in Alliance settings, sealed as D129 stores it (under `secret`). */
async function save(channel: "leaders" | "shield", forum = false, secret = SECRET) {
  const sealed = sealKey(secret, ws, hook(channel), `webhook-${channel}`);
  const { ciphertext, nonce, masterFp } = sealed;
  await storeWebhook(db, {
    ...{ workspaceId: ws, channel, ciphertext, nonce, masterFp, name: channel, forum },
    ...{ savedBy: null, savedAt: FRI, requestId: `${channel}-save` },
  });
}

/** Discord as a stub: every post and edit, answered with message 900; a forum post needs a title. */
function discord(forum = false) {
  const posts: { method: string; url: string; threadName?: string }[] = [];
  const fetch: typeof globalThis.fetch = async (url, init) => {
    const body = JSON.parse(String(init?.body)) as { thread_name?: string };
    const method = String(init?.method);
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
  const post = (now: Date, pass: "night" | "morning") => {
    at = now;
    const target: ShieldTarget = {
      unionId: OWN_ALLIANCE_ID,
      workspaceId: ws,
      slug: "ogs",
      key: null,
      settings: { workspaceId: ws, morningMinute: 600, discord: true, language: "en" },
    } as ShieldTarget;
    return postShieldSummary(deps, db, { day: DAY, target, pass });
  };
  return {
    posts,
    post,
    rename: (names: string[]) => db.update(dailyRosters).set({ memberNames: names }),
  };
}

describe("the Raid Shield summary's channel (D147)", () => {
  it("goes to the Raid Shield channel once saved, as a forum post there, never to the leaders'", async () => {
    await save("leaders");
    await save("shield", true);
    const d = discord(true);
    expect(await d.post(FRI, "night")).toBe(true);
    await d.rename(["Ash1", "Ash2"]);
    expect(await d.post(SAT, "morning")).toBe(true);
    expect(d.posts).toEqual([
      { method: "POST", url: `${hook("shield")}?wait=true`, threadName: "Raid Shield check" },
      { method: "PATCH", url: `${hook("shield")}/messages/900?thread_id=900` },
    ]);
  });

  it("goes to the leaders' channel while no Raid Shield channel is saved", async () => {
    await save("leaders");
    const d = discord();
    expect(await d.post(FRI, "night")).toBe(true);
    expect(d.posts).toEqual([{ method: "POST", url: `${hook("leaders")}?wait=true` }]);
  });

  it("posts nothing, not even to the leaders', when the Raid Shield webhook must be pasted again", async () => {
    await save("leaders");
    await save("shield", false, Buffer.alloc(32, 6).toString("base64"));
    const d = discord();
    expect(await d.post(FRI, "night")).toBe(false);
    expect(d.posts).toEqual([]);
  });

  it("posts fresh in a channel changed since Friday, then edits only the new message", async () => {
    await save("leaders");
    const d = discord();
    await d.post(FRI, "night");
    await save("shield");
    await d.rename(["Ash1", "Ash2"]);
    await d.post(SAT, "morning");
    await d.rename(["Fern1", "Fern2"]);
    await d.post(new Date(SAT.getTime() + 15 * 60_000), "morning");
    expect(d.posts.map((p) => `${p.method} ${p.url}`)).toEqual([
      `POST ${hook("leaders")}?wait=true`,
      `POST ${hook("shield")}?wait=true`,
      `PATCH ${hook("shield")}/messages/900`,
    ]);
  });
});
