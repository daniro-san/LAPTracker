import { generateKeyPairSync, sign } from "node:crypto";

import { sql } from "drizzle-orm";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import type { Db } from "../db";
import { openTestDb, truncateAll } from "../db.test-helpers";
import { allowUser, findWorkspaceBySlug, saveWorkspace } from "../repo/workspaces";
import { dailyReads, dailyRosters } from "../schema";
import { screenshotDrafts } from "../schema-import";
import { ReaderFailedError, type ScreenshotReader } from "../screenshot/read-screenshot";
import { ogsCandidates, recorded } from "../screenshot/test-helpers";
import { handleInteraction, type Job, verifySignature } from "./discord-interaction";
import { runJob, type JobDeps } from "./import-discord";

// A test key pair stands in for the Discord app's: its public key goes where DISCORD_PUBLIC_KEY would.
const keys = generateKeyPairSync("ed25519");
const PUBLIC_KEY = Buffer.from(
  String(keys.publicKey.export({ format: "jwk" }).x),
  "base64url",
).toString("hex");
const NOW = new Date("2026-11-16T20:00:00Z");
const GUILD = "1544808864262914060";
const LEADER = "1571951836724990113";
const MEMBER = "1571951836724990999";
const CDN = "https://cdn.discordapp.com/attachments/1/2/98.png";
const PICTURE = Buffer.concat([
  Buffer.from([0x89, 0x50, 0x4e, 0x47]),
  Buffer.from("picture-bytes-XYZ"),
]);

let db: Db;
beforeAll(async () => {
  db = await openTestDb();
});
beforeEach(async () => {
  await truncateAll(db);
  await saveWorkspace(db, {
    unionId: 67111155,
    slug: "ogs",
    discordGuildId: GUILD,
    leaderRoleIds: [LEADER],
  });
  const members = ogsCandidates();
  await db.insert(dailyReads).values({ day: "2026-11-15", startedAt: NOW, status: "complete" });
  await db.insert(dailyRosters).values({
    readDay: "2026-11-15",
    unionId: 67111155,
    memberCount: members.length,
    isFresh: true,
    memberUids: members.map((m) => m.uid),
    memberNames: members.map((m) => m.names[0] ?? ""),
    memberPower: members.map(() => 1000),
    memberKills: members.map(() => 0),
  });
});

/** A message command on a message with one picture, by a member with these roles. */
function command(roles: string[], attachment: Record<string, unknown> = {}) {
  return {
    type: 2,
    application_id: "900",
    token: "interaction-token",
    guild_id: GUILD,
    locale: "en-US",
    member: { nick: "Ana", roles, user: { id: "700000000000000001", username: "ana" } },
    data: {
      name: "Send to LAPTracker",
      type: 3,
      target_id: "55",
      resolved: {
        messages: {
          "55": {
            timestamp: "2026-11-16T18:54:00Z",
            attachments: [{ url: CDN, content_type: "image/png", size: 700_000, ...attachment }],
          },
        },
      },
    },
  };
}

/** A request as Discord sends it, signed with `key`, `at` seconds after NOW (0: on time). */
function signed(payload: unknown, key = keys.privateKey, at = 0) {
  const body = JSON.stringify(payload);
  const timestamp = String(Math.floor(NOW.getTime() / 1000) + at);
  const signature = sign(null, Buffer.from(timestamp + body), key).toString("hex");
  return { body, signature, timestamp };
}

const handle = (request: { body: string; signature: string | null; timestamp: string | null }) =>
  handleInteraction(db, PUBLIC_KEY, request, NOW);

describe("the interaction's signature", () => {
  it("accepts Discord's signature and refuses a wrong or missing one", async () => {
    const ping = signed({ type: 1, application_id: "900", token: "t" });
    expect(verifySignature(PUBLIC_KEY, ping.signature, ping.timestamp, ping.body)).toBe(true);
    const other = signed(
      { type: 1, application_id: "900", token: "t" },
      generateKeyPairSync("ed25519").privateKey,
    );
    expect((await handle(other)).status).toBe(401);
    expect((await handle({ ...ping, body: ping.body.replace("900", "901") })).status).toBe(401);
    expect((await handle({ ...ping, signature: null })).status).toBe(401);
    // A signed request replayed more than 5 minutes later.
    expect(
      await handle(signed({ type: 1, application_id: "900", token: "t" }, undefined, -301)),
    ).toEqual({
      status: 401,
      body: { code: "stale_signature" },
    });
    expect(await handleInteraction(db, undefined, ping, NOW)).toMatchObject({ status: 401 });
  });

  it("answers Discord's PING", async () => {
    expect(await handle(signed({ type: 1, application_id: "900", token: "t" }))).toEqual({
      status: 200,
      body: { type: 1 },
    });
  });
});

describe("who may send", () => {
  it("refuses a member without a leadership role, politely and only to them", async () => {
    const handled = await handle(signed(command([MEMBER])));
    expect(handled).toMatchObject({ status: 200, body: { type: 4, data: { flags: 64 } } });
    expect(JSON.stringify(handled.body)).toContain("Only the alliance’s R4 and R5");
    expect("job" in handled).toBe(false);
  });

  it("lets in a leadership role, and an allowlisted account without one", async () => {
    expect(await handle(signed(command([MEMBER, LEADER])))).toMatchObject({ body: { type: 5 } });
    const ws = await findWorkspaceBySlug(db, "ogs");
    await allowUser(
      db,
      ws?.id ?? 0,
      "700000000000000001",
      new Date("2026-12-01T00:00:00Z"),
      "admin",
    );
    expect(await handle(signed(command([MEMBER])))).toMatchObject({ body: { type: 5 } });
  });
});

/** Discord's CDN, its media proxy and the interaction webhook, recorded. */
function discord() {
  const calls: { url: string; method: string; body?: string }[] = [];
  const fetcher: typeof fetch = async (input, init) => {
    const url = String(input);
    calls.push({
      url,
      method: init?.method ?? "GET",
      ...(init?.body ? { body: String(init.body) } : {}),
    });
    if (
      url.startsWith("https://cdn.discordapp.com/") ||
      url.startsWith("https://media.discordapp.net/")
    ) {
      return new Response(PICTURE, { headers: { "content-type": "image/png" } });
    }
    return Response.json({ id: "1" });
  };
  return { calls, fetcher };
}

function deps(fetcher: typeof fetch, read: string[]): JobDeps {
  const reader: ScreenshotReader = {
    read: async () => read,
    toPng: async (image) => image,
    close: async () => undefined,
  };
  return {
    openDb: () => ({ db, close: async () => {} }),
    fetch: fetcher,
    openReader: async () => reader,
    discordBase: "https://discord.test/api",
    origin: "https://laptracker.test",
    serverTz: "Etc/GMT+2",
    now: () => NOW,
  };
}

async function deferred(payload: unknown): Promise<{ body: unknown; job: Job }> {
  const handled = await handle(signed(payload));
  if (handled.status !== 200 || !handled.job) throw new Error("no deferred reply");
  return { body: handled.body, job: handled.job };
}

describe("the deferred flow", () => {
  it("answers at once, then reads the picture, makes the draft and edits the reply with its link", async () => {
    const handled = await deferred(command([LEADER]));
    expect(handled.body).toEqual({ type: 5, data: { flags: 64 } });
    const { calls, fetcher } = discord();
    await runJob(deps(fetcher, recorded("98-alliance-duel-weekly-phone")), handled.job);
    expect(calls[0]).toEqual({ url: CDN, method: "GET" });
    const edit = calls.find((c) => c.method === "PATCH");
    expect(edit?.url).toBe(
      "https://discord.test/api/webhooks/900/interaction-token/messages/@original",
    );
    const [draft] = await db.select().from(screenshotDrafts);
    expect(JSON.parse(edit?.body ?? "{}").content).toBe(
      `Read: Alliance Duel — daily or weekly?, 8 rows, 2 doubtful → [Review](https://laptracker.test/w/ogs/shots/${draft?.id})`,
    );
    expect(draft).toMatchObject({ source: "discord", sentBy: "Ana", pictureDay: "2026-11-16" });
  });

  it("keeps the OCR text and rows, never the picture", async () => {
    const handled = await deferred(command([LEADER]));
    await runJob(deps(discord().fetcher, recorded("98-alliance-duel-weekly-phone")), handled.job);
    const stored = JSON.stringify(await db.select().from(screenshotDrafts));
    for (const form of ["picture-bytes-XYZ", PICTURE.toString("base64"), PICTURE.toString("hex")]) {
      expect(stored).not.toContain(form);
    }
    const binary =
      await db.execute(sql`select table_name, column_name from information_schema.columns
      where table_name in ('screenshot_drafts', 'alliance_duel_points', 'screenshot_checks')
        and data_type = 'bytea'`);
    expect(binary.rows).toEqual([]);
  });

  it("asks Discord's proxy for a PNG of a JPEG, and fetches nothing from another host", async () => {
    const jpeg = await deferred(
      command([LEADER], {
        content_type: "image/jpeg",
        url: "https://cdn.discordapp.com/attachments/1/2/98.jpg",
        proxy_url: "https://media.discordapp.net/attachments/1/2/98.jpg",
      }),
    );
    const first = discord();
    await runJob(deps(first.fetcher, recorded("90-might-phone")), jpeg.job);
    expect(first.calls[0]?.url).toBe(
      "https://media.discordapp.net/attachments/1/2/98.jpg?format=png",
    );

    const elsewhere = await deferred(command([LEADER], { url: "https://example.com/98.png" }));
    const second = discord();
    await runJob(deps(second.fetcher, recorded("90-might-phone")), elsewhere.job);
    expect(second.calls.map((c) => c.method)).toEqual(["PATCH"]);
    expect(JSON.parse(second.calls[0]?.body ?? "{}").content).toBe("1 picture could not be read.");
  });

  it("edits the reply when a reading never settles, and when the reader fails", async () => {
    const handled = await deferred(command([LEADER]));
    const reply = (calls: { method: string; body?: string }[]) =>
      JSON.parse(calls.find((c) => c.method === "PATCH")?.body ?? "{}").content;

    const stalled = discord();
    let looks = 0;
    await runJob(
      {
        ...deps(stalled.fetcher, []),
        openReader: async () => ({
          read: () => new Promise<string[]>(() => {}),
          toPng: async (image) => image,
          close: async () => undefined,
        }),
        // The job's second look at the clock is 10 ms before its 45 s deadline.
        now: () => new Date(NOW.getTime() + (looks++ === 0 ? 0 : 44_990)),
      },
      handled.job,
    );
    expect(reply(stalled.calls)).toBe("1 picture could not be read.");

    const failing = discord();
    const logged = vi.spyOn(console, "info").mockImplementation(() => undefined);
    await runJob(
      {
        ...deps(failing.fetcher, []),
        openReader: async () => ({
          read: () => Promise.reject(new ReaderFailedError("MODULE_NOT_FOUND")),
          toPng: async (image) => image,
          close: async () => undefined,
        }),
      },
      handled.job,
    );
    expect(reply(failing.calls)).toBe(
      "The pictures could not be read this time. Nothing was saved. Try again, or send them from the desk.",
    );
    expect(logged.mock.calls.map(([line]) => JSON.parse(String(line)).code)).toContain(
      "w.import.discord_failed:reader:MODULE_NOT_FOUND",
    );
    logged.mockRestore();
  });
});
