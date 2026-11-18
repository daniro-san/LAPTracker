// "Publish to Discord" (issue 345, D102): a notice goes to its audience's channel, never to the other;
// its picture goes with the first message (D119); a repeat of the same request id posts nothing more; no
// message can mention anyone; a forum channel gets a post named after the notice with the rest inside it;
// without a channel nothing is sent. A refusal is a
// failed publish; a claim still running answers 409, one stuck over 2 minutes counts as failed; a second
// publish to the same audience within 30 s is refused; another workspace's notice is not found.
import { randomUUID } from "node:crypto";

import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import type { AppContext } from "@/lib/app-context";
import { testContext, TEST_ENV } from "@/lib/app-context.test-helpers";
import { T0 } from "@/lib/collector.test-helpers";
import type { Db } from "@/lib/db";
import { openTestDb, truncateAll } from "@/lib/db.test-helpers";
import { createSession, SESSION_COOKIE } from "@/lib/private/session";
import { workspaces, workspaceUsers } from "@/lib/schema";
import { noticePictures, noticePublishes } from "@/lib/schema-notices";

const holder = vi.hoisted(() => ({ ctx: null as AppContext | null }));
vi.mock("@/lib/app-context", async (original) => ({
  ...(await original<typeof import("@/lib/app-context")>()),
  getAppContext: () => holder.ctx,
}));

const { POST: save } = await import("../route");
const { POST } = await import("./route");

const HOOK = "https://discord.com/api/webhooks/1/";
const env = (forum: boolean) => ({
  ...TEST_ENV,
  WORKSPACE_DISCORD_WEBHOOKS: {
    ogs: {
      members: { url: `${HOOK}members`, name: "guides-and-beyond", forum },
      leaders: { url: `${HOOK}leaders`, name: "notices", forum: false },
    },
  },
});

let db: Db;
let sent: { url: string; body: Record<string, unknown>; file?: File }[];
beforeAll(async () => {
  db = await openTestDb();
});
beforeEach(async () => {
  await truncateAll(db);
  await db.insert(workspaces).values([
    { unionId: 67111155, slug: "ogs", discordGuildId: "1", leaderRoleIds: ["2"] },
    { unionId: 67109944, slug: "nse", discordGuildId: "3", leaderRoleIds: ["4"] },
  ]);
  use(env(false));
});

/**
 * The app context with `e`, and a Discord stand-in that keeps each post and opens a forum thread; with
 * `refuse`, Discord answers 500.
 */
function use(e: AppContext["env"], refuse = false) {
  sent = [];
  holder.ctx = {
    ...testContext(db, e).ctx,
    fetch: async (input, init) => {
      const form = init?.body instanceof FormData ? init.body : null;
      const json = form ? form.get("payload_json") : init?.body;
      const file = form?.get("files[0]");
      sent.push({
        url: String(input),
        body: JSON.parse(String(json)),
        ...(file instanceof File && { file }),
      });
      if (refuse) return new Response(null, { status: 500 });
      return Response.json({ id: `m${sent.length}`, channel_id: "900" });
    },
  };
}

async function call(
  route: typeof POST,
  path: string,
  token: string,
  body: object,
  slug: "ogs" | "nse" = "ogs",
) {
  const response = await route(
    new Request(`https://laptracker.test/api/w/${slug}/${path}`, {
      method: "POST",
      headers: {
        origin: "https://laptracker.test",
        "content-type": "application/json",
        cookie: `${SESSION_COOKIE}=${token}`,
      },
      body: JSON.stringify(body),
    }),
    { params: Promise.resolve({ slug }) },
  );
  return { status: response.status, json: (await response.json()) as Record<string, unknown> };
}

/** An officer of ogs (workspace 1), or of nse (workspace 2): their session token. */
async function officer(workspaceId = 1): Promise<string> {
  const [user] = await db
    .insert(workspaceUsers)
    .values({ workspaceId, discordUserId: `id-rook-${workspaceId}`, displayName: "Rook" })
    .returning({ id: workspaceUsers.id });
  return (await createSession(db, workspaceId, user?.id ?? 0, T0, null, "officer")).token;
}

/** A claim left in the table: `status`, made `ago` ms before the test clock. */
async function claim(id: number, requestId: string, status: string, ago: number) {
  await db.insert(noticePublishes).values({
    workspaceId: 1,
    noticeId: id,
    requestId,
    audience: "members",
    languages: "en",
    status,
    publishedAt: new Date(T0.getTime() - ago),
  });
}

/** A notice in English and French; `members` sets "Show to members". */
async function notice(token: string, members: boolean): Promise<number> {
  const made = await call(save, "notices", token, {
    requestId: randomUUID(),
    changes: [
      { field: "title", value: "Garden rota", version: 0 },
      { field: "en", value: "Water the *roses* @everyone", version: 0 },
      { field: "fr", value: "Arrosez les roses.", version: 0 },
      { field: "for_members", value: String(members), version: 0 },
    ],
  });
  return made.json.id as number;
}

const publish = (token: string, id: number, requestId = randomUUID()) =>
  call(POST, "notices/publish", token, { id, languages: ["en", "fr"], requestId });

describe("POST /api/w/[slug]/notices/publish", () => {
  it("posts a members notice to the members' channel once, with no mention allowed", async () => {
    const token = await officer();
    const id = await notice(token, true);
    const requestId = randomUUID();
    const first = await publish(token, id, requestId);
    expect(first.status).toBe(200);
    expect(first.json).toMatchObject({ audience: "members", languages: ["en", "fr"] });
    expect(sent).toHaveLength(1);
    expect(sent[0]?.url).toBe(`${HOOK}members?wait=true`);
    expect(sent[0]?.body.allowed_mentions).toEqual({ parse: [] });
    expect(String(sent[0]?.body.content)).toContain("**Garden rota**");
    expect(String(sent[0]?.body.content)).toContain("\\*roses\\* @\u200beveryone");
    // The same request again (a double tap): the first answer, nothing posted.
    expect((await publish(token, id, requestId)).status).toBe(200);
    expect(sent).toHaveLength(1);
  });

  it("sends the notice's picture as an attachment the first message's embed shows (D119)", async () => {
    const token = await officer();
    const id = await notice(token, true);
    const data = new Uint8Array([0x52, 0x49, 0x46, 0x46, 1, 2, 3]);
    await db.insert(noticePictures).values({
      noticeId: id,
      workspaceId: 1,
      data,
      type: "image/webp",
      width: 10,
      height: 10,
      bytes: data.length,
      hash: "abc",
      addedAt: T0,
    });
    expect((await publish(token, id)).status).toBe(200);
    expect(sent[0]?.body).toMatchObject({
      allowed_mentions: { parse: [] },
      embeds: [{ image: { url: "attachment://notice.webp" } }],
      attachments: [{ id: 0, filename: "notice.webp" }],
    });
    expect(sent[0]?.file?.name).toBe("notice.webp");
    expect(sent[0]?.file?.type).toBe("image/webp");
    expect(new Uint8Array(await (sent[0]?.file as File).arrayBuffer())).toEqual(data);
  });

  it("posts a leadership notice to the leaders' channel", async () => {
    const token = await officer();
    await publish(token, await notice(token, false));
    expect(sent.map((s) => s.url)).toEqual([`${HOOK}leaders?wait=true`]);
  });

  it("opens a forum post named after the notice and puts the rest inside it", async () => {
    use(env(true));
    const token = await officer();
    const id = await call(save, "notices", token, {
      requestId: randomUUID(),
      changes: [
        { field: "title", value: "Garden rota", version: 0 },
        { field: "en", value: "a".repeat(1500), version: 0 },
        { field: "fr", value: "b".repeat(1500), version: 0 },
        { field: "for_members", value: "true", version: 0 },
      ],
    });
    expect((await publish(token, id.json.id as number)).status).toBe(200);
    expect(sent.map((s) => s.url)).toEqual([
      `${HOOK}members?wait=true`,
      `${HOOK}members?wait=true&thread_id=900`,
    ]);
    expect(sent[0]?.body.thread_name).toBe("Garden rota");
    expect(sent[1]?.body.thread_name).toBeUndefined();
  });

  it("records a Discord refusal as a failed publish (502)", async () => {
    use(env(false), true);
    const token = await officer();
    expect(await publish(token, await notice(token, true))).toEqual({
      status: 502,
      json: { code: "failed" },
    });
    const [row] = await db.select().from(noticePublishes);
    expect(row).toMatchObject({ status: "failed", messages: 0 });
  });

  it("answers 409 while the same request runs, and counts a claim stuck over 2 minutes as failed", async () => {
    const token = await officer();
    const id = await notice(token, true);
    const [running, stuck] = [randomUUID(), randomUUID()];
    await claim(id, running, "posting", 60_000);
    await claim(id, stuck, "posting", 3 * 60_000);
    expect(await publish(token, id, running)).toEqual({ status: 409, json: { code: "posting" } });
    expect(await publish(token, id, stuck)).toEqual({ status: 502, json: { code: "failed" } });
    expect(sent).toHaveLength(0);
  });

  it("refuses a second publish to the same audience within 30 s", async () => {
    const token = await officer();
    const id = await notice(token, true);
    expect((await publish(token, id)).status).toBe(200);
    const count = sent.length;
    expect(await publish(token, id)).toEqual({ status: 409, json: { code: "recent" } });
    expect(sent).toHaveLength(count);
  });

  it("does not find another workspace's notice", async () => {
    const id = await notice(await officer(), true);
    const other = await officer(2);
    const answer = await call(
      POST,
      "notices/publish",
      other,
      { id, languages: ["en"], requestId: randomUUID() },
      "nse",
    );
    expect(answer).toEqual({ status: 404, json: { code: "not_found" } });
    expect(sent).toHaveLength(0);
  });

  it("sends nothing when the audience's channel is not set up", async () => {
    use(TEST_ENV);
    const token = await officer();
    const answer = await publish(token, await notice(token, true));
    expect(answer).toEqual({ status: 409, json: { code: "not_set_up" } });
    expect(sent).toHaveLength(0);
  });
});
