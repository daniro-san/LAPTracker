import { generateKeyPairSync } from "node:crypto";

import { sql } from "drizzle-orm";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { TEST_ENV, testContext } from "../app-context.test-helpers";
import type { Db } from "../db";
import { openTestDb, truncateAll } from "../db.test-helpers";
import { allowUser, findWorkspaceBySlug } from "../repo/workspaces";
import { screenshotDrafts } from "../schema-import";
import { ReaderFailedError, type ScreenshotReader } from "../screenshot/read-screenshot";
import { recorded } from "../screenshot/test-helpers";
import { handleInteraction, verifySignature } from "./discord-interaction";
import {
  CDN,
  command,
  discord,
  interactions,
  jobDeps,
  LEADER,
  MEMBER,
  NOW,
  PICTURE,
  PUBLIC_KEY,
  seedOgs,
  signed,
} from "./discord-interaction.test-helpers";
import { runJob } from "./import-discord";

let db: Db;
beforeAll(async () => {
  db = await openTestDb();
});
beforeEach(async () => {
  await truncateAll(db);
  await seedOgs(db);
});

const { handle, deferred } = interactions(() => db);
const deps = (fetcher: typeof fetch, read: string[]) => jobDeps(db, fetcher, read);

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
    expect(
      await handleInteraction(db, undefined, ping, NOW, "https://laptracker.test", false),
    ).toMatchObject({ status: 401 });
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
    expect(await handle(signed(command([MEMBER], {}, "56")))).toMatchObject({ body: { type: 5 } });
  });
});

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
      `Read: Alliance Duel (daily or weekly?), 8 rows, 2 doubtful → [Review](https://laptracker.test/w/ogs/shots/${draft?.id})`,
    );
    expect(draft).toMatchObject({ source: "discord", sentBy: "Ana", pictureDay: "2026-11-16" });
  });

  it("makes no new draft on a second run on the same message, and links the first one (D100)", async () => {
    const first = await deferred(command([LEADER]));
    await runJob(deps(discord().fetcher, recorded("98-alliance-duel-weekly-phone")), first.job);
    const [draft] = await db.select().from(screenshotDrafts);
    const again = await handle(signed(command([LEADER])));
    expect("job" in again).toBe(false);
    expect(again.body).toEqual({
      type: 4,
      data: {
        flags: 64,
        content: `These screenshots were already sent to the Officers’ Desk. No new draft was made.\n→ [Review](https://laptracker.test/w/ogs/shots/${draft?.id})`,
      },
    });
    expect(await db.select().from(screenshotDrafts)).toHaveLength(1);
  });

  it("lets a picture be sent again when its reading failed", async () => {
    const first = await deferred(command([LEADER]));
    const broken: ScreenshotReader = {
      read: () => Promise.reject(new ReaderFailedError("MODULE_NOT_FOUND")),
      toPng: async (image) => image,
      close: async () => undefined,
    };
    vi.spyOn(console, "info").mockImplementation(() => undefined);
    await runJob({ ...deps(discord().fetcher, []), openReader: async () => broken }, first.job);
    expect(await handle(signed(command([LEADER])))).toMatchObject({ body: { type: 5 } });
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

    const elsewhere = await deferred(
      command([LEADER], { url: "https://example.com/98.png" }, "56"),
    );
    const second = discord();
    await runJob(deps(second.fetcher, recorded("90-might-phone")), elsewhere.job);
    expect(second.calls.map((c) => c.method)).toEqual(["PATCH"]);
    expect(JSON.parse(second.calls[0]?.body ?? "{}").content).toBe(
      "1 screenshot could not be read. Send it again, full screen and uncropped.",
    );
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
    expect(reply(stalled.calls)).toBe(
      "1 screenshot could not be read. Send it again, full screen and uncropped.",
    );

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
      "The screenshots could not be read this time. Nothing was saved. Try again, or send them from the desk.",
    );
    expect(logged.mock.calls.map(([line]) => JSON.parse(String(line)).code)).toContain(
      "w.import.discord_failed:reader:MODULE_NOT_FOUND",
    );
    logged.mockRestore();
  });

  it("reports a failed save to error tracking without the screenshot's text (D71, D115)", async () => {
    const handled = await deferred(command([LEADER]));
    const { ctx, posts } = testContext(db, {
      ...TEST_ENV,
      VERCEL_ENV: "production",
      POSTHOG_KEY: "phc_test",
    });
    // The read's lines with one invented player in them; the drafts' insert fails, so its params hold them.
    const lines = recorded("98-alliance-duel-weekly-phone").map((line, i) =>
      i === 4 ? "*78 InventedBramble" : line,
    );
    await db.execute(sql`alter table screenshot_drafts add constraint no_drafts check (false)`);
    vi.spyOn(console, "info").mockImplementation(() => undefined);
    try {
      await runJob({ ...deps(discord().fetcher, lines), report: ctx.report }, handled.job);
    } finally {
      await db.execute(sql`alter table screenshot_drafts drop constraint no_drafts`);
    }
    const sent = posts.filter((p) => p.url === "https://us.i.posthog.com/batch/");
    await vi.waitFor(() => expect(sent.length).toBeGreaterThan(0));
    const [exception] = sent.flatMap(
      (p) => p.body.batch as { event: string; properties: Record<string, unknown> }[],
    );
    expect(exception).toMatchObject({
      event: "$exception",
      properties: {
        kind: "w.import.discord_failed",
        route: "lib/private/import-discord.ts",
        $exception_list: [
          { value: expect.stringMatching(/^Failed query: insert into .*\nparams: …$/s) },
        ],
      },
    });
    expect(JSON.stringify(sent)).not.toContain("InventedBramble");
  });
});
