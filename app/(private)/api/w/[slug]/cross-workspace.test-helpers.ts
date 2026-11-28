// Test-only (issue 471): two workspaces, Alpha and Bravo, on two Discord servers and two alliances, each with
// a row in every table it owns (lib/workspace-data.test-helpers.ts), every feature on, an officer's session
// each, and records Bravo's officer added through the routes under request ids (D100) that Alpha's officer
// replays later. Analytics is on, so a test can read which workspace each `ws_action` names. A test file
// mocks getAppContext to return `holder.ctx`. Invented names only.
import { randomUUID } from "node:crypto";

import { eq, sql } from "drizzle-orm";

import type { AppContext } from "@/lib/app-context";
import { TEST_ENV, testContext } from "@/lib/app-context.test-helpers";
import type { Db } from "@/lib/db";
import { truncateAll } from "@/lib/db.test-helpers";
import { createSession, SESSION_COOKIE } from "@/lib/private/session";
import { dailyRosters, memberFollowUps, workspaces, workspaceUsers } from "@/lib/schema";
import { workspaceFeatures } from "@/lib/schema-features";
import {
  SEED_AT,
  seedEverything,
  seedRoster,
  seedWorkspace,
} from "@/lib/workspace-data.test-helpers";
import { FEATURES } from "@/lib/workspace-features";

type Handler = (r: Request, c: { params: Promise<Record<string, string>> }) => Promise<Response>;
type Route = { GET?: Handler; POST?: Handler };
const ROUTES: Record<string, () => Promise<unknown>> = {
  activity: () => import("./activity/route"),
  calendar: () => import("./calendar/route"),
  discord: () => import("./discord/route"),
  features: () => import("./features/route"),
  "follow-up": () => import("./follow-up/route"),
  garrison: () => import("./garrison/route"),
  import: () => import("./import/route"),
  "kvk-plan": () => import("./kvk-plan/route"),
  facts: () => import("./members/[uid]/facts/route"),
  member: () => import("./members/[uid]/route"),
  notices: () => import("./notices/route"),
  "notices/delete": () => import("./notices/delete/route"),
  "notices/picture": () => import("./notices/picture/route"),
  "notices/picture/keep": () => import("./notices/picture/keep/route"),
  "notices/picture/remove": () => import("./notices/picture/remove/route"),
  "notices/picture/reuse": () => import("./notices/picture/reuse/route"),
  "notices/publish": () => import("./notices/publish/route"),
  "notices/reviews": () => import("./notices/reviews/route"),
  pending: () => import("./pending/route"),
  profile: () => import("./profile/route"),
  "read-status": () => import("./read-status/route"),
  "roll-call": () => import("./roll-call/route"),
  shot: () => import("./shots/[id]/route"),
  thanks: () => import("./thanks/route"),
  thefts: () => import("./thefts/route"),
  "workspace-deletion": () => import("./workspace-deletion/route"),
};

/** Loads every route module once, so a test body spends its time on requests, not on first imports. */
export const loadRoutes = () => Promise.all(Object.values(ROUTES).map((load) => load()));

const ORIGIN = "https://laptracker.test";
export const ALPHA = 900_001;
export const BRAVO = 900_002;
export const WEEK = "2026-11-16";
export { SEED_AT };

/** Bravo's request ids, used by Bravo's officer through the routes before Alpha replays them. */
export const used = {
  entry: randomUUID(),
  call: randomUUID(),
  pending: randomUUID(),
  theft: randomUUID(),
  notice: randomUUID(),
  review: randomUUID(),
  follow: randomUUID(),
  deleted: randomUUID(),
};

type Who = "alpha" | "bravo";
/** One request: whose session, and its body (a POST), query, path params or picture. */
export interface Ask {
  who?: Who;
  body?: unknown;
  query?: string;
  params?: Record<string, string>;
  picture?: Uint8Array<ArrayBuffer>;
}
export interface Two {
  db: Db;
  token: Record<Who, string>;
  /** What the context's fetch sent: Discord webhooks and PostHog batches. */
  posts: { url: string; body: Record<string, unknown> }[];
}

/** Both workspaces seeded, Bravo's adds made, the fetch record cleared. */
export async function seedTwo(db: Db, holder: { ctx: AppContext | null }): Promise<Two> {
  await truncateAll(db);
  const env: typeof TEST_ENV = {
    ...TEST_ENV,
    VERCEL_ENV: "production",
    POSTHOG_KEY: "phc_test",
    WORKSPACE_DISCORD_WEBHOOKS: {
      alpha: {
        members: { name: "#alpha", url: "https://discord.test/api/webhooks/1/a", forum: false },
      },
      bravo: {
        members: { name: "#bravo", url: "https://discord.test/api/webhooks/2/b", forum: false },
      },
    },
  };
  const test = testContext(db, env);
  test.clock.now = SEED_AT;
  holder.ctx = test.ctx;
  const alpha = await seedWorkspace(db, "alpha", ALPHA);
  const bravo = await seedWorkspace(db, "bravo", BRAVO);
  await seedRoster(db, ALPHA);
  // Bravo's alliance has its own member, 202, on the same day's read.
  await db.insert(dailyRosters).values({
    readDay: "2026-11-18",
    unionId: BRAVO,
    memberCount: 1,
    sourceUpdatedAt: SEED_AT,
    isFresh: true,
    memberUids: [202],
    memberNames: ["Bea Invented"],
    memberPower: [2000],
    memberKills: [20],
  });
  await seedEverything(db, alpha);
  await seedEverything(db, bravo);
  // Every feature on in both, so no refusal is a switch's.
  const allOn = Object.fromEntries(FEATURES.map((f) => [f, true]));
  await db.update(workspaceFeatures).set({ switches: allOn, allianceSwitches: allOn });
  const session = (ws: { workspaceId: number; officer: number }) =>
    createSession(db, ws.workspaceId, ws.officer, SEED_AT, null, "officer").then((s) => s.token);
  const two: Two = {
    db,
    token: { alpha: await session(alpha), bravo: await session(bravo) },
    posts: [],
  };
  await bravoAdds(two);
  await new Promise((r) => setTimeout(r, 0));
  test.posts.length = 0;
  two.posts = test.posts;
  return two;
}

/** A request to a route as the desk sends it: JSON (or a picture), same origin, the session's cookie. */
export async function call(two: Two, route: string, ask: Ask) {
  const slug = ask.who ?? "alpha";
  const method = ask.body === undefined && !ask.picture ? "GET" : "POST";
  const headers = new Headers({ origin: ORIGIN, cookie: `${SESSION_COOKIE}=${two.token[slug]}` });
  headers.set("content-type", ask.picture ? "image/png" : "application/json");
  if (ask.picture) headers.set("content-length", String(ask.picture.length));
  const request = new Request(`${ORIGIN}/api/w/${slug}/${route}${ask.query ?? ""}`, {
    method,
    headers,
    ...(method === "POST" && { body: ask.picture ?? JSON.stringify(ask.body) }),
  });
  const handler = ((await ROUTES[route]?.()) as Route)[method] as Handler;
  const res = await handler(request, { params: Promise.resolve({ slug, ...ask.params }) });
  return {
    status: res.status,
    json: (await res.json().catch(() => null)) as Record<string, unknown>,
  };
}

/** The same theft, for Bravo's add and Alpha's replay of its request id. */
export const theft = (requestId: string) => ({
  action: "add",
  attacker: { name: "Raider", tag: "XX" },
  victimUid: null,
  day: "2026-11-18",
  time: "10:00",
  kind: "ops",
  note: "",
  requestId,
});

/** Bravo's officer adds records through the routes, under the request ids in `used`. */
async function bravoAdds(two: Two) {
  const add = (route: string, body: unknown) => call(two, route, { who: "bravo", body });
  const entry = { kind: "other", title: "Bravo plan", day: "2026-11-19", minute: 600 };
  const made = await add("calendar", { action: "create", entry, requestId: used.entry });
  const del = { action: "delete", entry: made.json.id, scope: "all", week: WEEK };
  await add("calendar", { ...del, requestId: used.deleted });
  await add("roll-call", {
    action: "add",
    kind: "cheese",
    day: "2026-11-18",
    requestId: used.call,
  });
  await add("pending", { action: "add", requestId: used.pending, name: "Bryn Later", changes: [] });
  await add("thefts", theft(used.theft));
  const title = (value: string) => [{ field: "title", value, version: 0 }];
  const notice = await add("notices", { changes: title("Bravo rules"), requestId: used.notice });
  const review = { action: "ask", notice: notice.json.id, language: null, reviewer: null };
  await add("notices/reviews", { ...review, requestId: used.review });
  const talked = { uid: 202, action: "talked", note: "", until: null, version: 0 };
  await add("follow-up", { ...talked, requestId: used.follow });
  // A notice of Bravo's in the trash, which any officer of Bravo may restore (D118).
  const old = await add("notices", { changes: title("Bravo old"), requestId: randomUUID() });
  await add("notices/delete", { id: old.json.id, requestId: used.deleted });
}

/** A workspace's ids, oldest first, by its slug. */
export async function idsOf(db: Db, slug: Who) {
  const [ws] = await db.select().from(workspaces).where(eq(workspaces.slug, slug));
  const id = ws?.id ?? 0;
  const ids = async (table: string, where = sql``) =>
    (
      await db.execute<{ id: number }>(
        sql`select id from ${sql.identifier(table)} where workspace_id = ${id} ${where} order by id`,
      )
    ).rows.map((r) => r.id);
  const [officer] = await db
    .select({ id: workspaceUsers.id })
    .from(workspaceUsers)
    .where(eq(workspaceUsers.workspaceId, id));
  const follow = await db
    .select({ requestId: memberFollowUps.requestId })
    .from(memberFollowUps)
    .where(eq(memberFollowUps.workspaceId, id));
  return {
    workspace: { id, unionId: ws?.unionId ?? 0 },
    officer: officer?.id ?? 0,
    notices: await ids("notices"),
    reviews: await ids("notice_reviews"),
    entries: await ids("calendar_entries", sql`and deleted_at is null`),
    deletedEntries: await ids("calendar_entries", sql`and deleted_at is not null`),
    kvk: await ids("calendar_entries", sql`and deleted_at is null and kind = 'kvk'`),
    calls: await ids("roll_calls"),
    thefts: await ids("thefts"),
    pending: await ids("pending_members"),
    shares: await ids("thanks_shares"),
    drafts: await ids("screenshot_drafts"),
    follow: follow.map((r) => r.requestId),
  };
}
export type Ids = Awaited<ReturnType<typeof idsOf>>;

/** The PostHog events sent so far: each `ws_action`'s workspace. */
export const eventWorkspaces = (two: Two) =>
  two.posts.flatMap((p) =>
    ((p.body.batch ?? []) as { event: string; properties: { workspace?: string } }[]).map(
      (e) => `${e.event}:${e.properties.workspace}`,
    ),
  );
