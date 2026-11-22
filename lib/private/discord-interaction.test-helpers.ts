// Test-only (D96): the Discord interaction tests' stand-ins, shared by discord-interaction.test.ts and
// discord-servers.test.ts: a signing key in place of the Discord app's, OGs' workspace and roster, a signed
// "Send to LAPTracker" command, Discord's CDN and webhook recorded, and a reader that answers given lines.
// Invented ids only.
import { generateKeyPairSync, sign } from "node:crypto";

import type { Db } from "../db";
import { saveWorkspace } from "../repo/workspaces";
import { dailyReads, dailyRosters } from "../schema";
import type { ScreenshotReader } from "../screenshot/read-screenshot";
import { ogsCandidates } from "../screenshot/test-helpers";
import { handleInteraction, type Job } from "./discord-interaction";
import type { JobDeps } from "./import-discord";

// A test key pair stands in for the Discord app's: its public key goes where DISCORD_PUBLIC_KEY would.
export const keys = generateKeyPairSync("ed25519");
export const PUBLIC_KEY = Buffer.from(
  String(keys.publicKey.export({ format: "jwk" }).x),
  "base64url",
).toString("hex");
export const NOW = new Date("2026-11-16T20:00:00Z");
export const GUILD = "1544808864262914060";
export const LEADER = "1571951836724990113";
export const MEMBER = "1571951836724990999";
export const CDN = "https://cdn.discordapp.com/attachments/1/2/98.png";
export const PICTURE = Buffer.concat([
  Buffer.from([0x89, 0x50, 0x4e, 0x47]),
  Buffer.from("picture-bytes-XYZ"),
]);

/** OGs' workspace on GUILD, and its roster of the day before. */
export async function seedOgs(db: Db) {
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
}

/** A message command on message `message` with one picture, by a member with these roles. */
export function command(roles: string[], attachment: Record<string, unknown> = {}, message = "55") {
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
      target_id: message,
      resolved: {
        messages: {
          [message]: {
            timestamp: "2026-11-16T18:54:00Z",
            attachments: [
              { id: "98", url: CDN, content_type: "image/png", size: 700_000, ...attachment },
            ],
          },
        },
      },
    },
  };
}

/** A request as Discord sends it, signed with `key`, `at` seconds after NOW (0: on time). */
export function signed(payload: unknown, key = keys.privateKey, at = 0) {
  const body = JSON.stringify(payload);
  const timestamp = String(Math.floor(NOW.getTime() / 1000) + at);
  const signature = sign(null, Buffer.from(timestamp + body), key).toString("hex");
  return { body, signature, timestamp };
}

/** The route's call on `db`, and a command that must get the deferred reply and its job. */
export function interactions(db: () => Db) {
  const handle = (request: { body: string; signature: string | null; timestamp: string | null }) =>
    handleInteraction(db(), PUBLIC_KEY, request, NOW, "https://laptracker.test", false);
  const deferred = async (payload: unknown): Promise<{ body: unknown; job: Job }> => {
    const handled = await handle(signed(payload));
    if (handled.status !== 200 || !handled.job) throw new Error("no deferred reply");
    return { body: handled.body, job: handled.job };
  };
  return { handle, deferred };
}

/** Discord's CDN, its media proxy and the interaction webhook, recorded. */
export function discord() {
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

/** The job's dependencies over `db`, with a reader that answers `read` for every picture. */
export function jobDeps(db: Db, fetcher: typeof fetch, read: string[]): JobDeps {
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
    report: () => undefined,
  };
}
