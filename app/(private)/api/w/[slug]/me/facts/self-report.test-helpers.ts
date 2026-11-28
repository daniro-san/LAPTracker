// The world of the self-report route tests (D154): two workspaces, Alpha's newest roster (Ana, Bo, Cass)
// and Bravo's (Cy); Ana with an approved link to her player, Bobby with a pending one, Nobody with none,
// Rook an Alpha officer, Vale an officer of Bravo. A member's send, an officer's answer, the officer's
// card and an officer's own fact. Each test file mocks getAppContext itself. Invented names only.
import { T0 } from "@/lib/collector.test-helpers";
import type { Db } from "@/lib/db";
import { truncateAll } from "@/lib/db.test-helpers";
import { requireWorkspace } from "@/lib/private/access";
import { WORKSPACE_DICTIONARIES } from "@/lib/private/dictionary";
import { memberCard } from "@/lib/private/member-card";
import { createSession, SESSION_COOKIE } from "@/lib/private/session";
import { dailyReads, dailyRosters, memberFacts, workspaces, workspaceUsers } from "@/lib/schema";

import * as linksRoute from "../../member-links/route";
import * as officerRoute from "../../members/[uid]/self-report/route";
import * as awayRoute from "../away/route";
import * as memberRoute from "./route";

const ORIGIN = "https://laptracker.test";
const ALPHA = 900_001;
const BRAVO = 900_002;
// T0 is Saturday 2026-11-07, 10:00 ST (the server at UTC−2).
const at = { now: T0, zone: "Etc/GMT+2", language: "en" as const, t: WORKSPACE_DICTIONARIES.en };
export const ID = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;

type State = {
  db: Db;
  alphaId: number;
  tokens: Record<string, string>;
  users: Record<string, number>;
};

async function roster(w: State, unionId: number, day: string, people: [number, string][]) {
  await w.db
    .insert(dailyReads)
    .values({ day, startedAt: T0, status: "complete" })
    .onConflictDoNothing();
  await w.db.insert(dailyRosters).values({
    readDay: day,
    unionId,
    memberCount: people.length,
    isFresh: true,
    sourceUpdatedAt: new Date(`${day}T23:31:00-02:00`),
    memberUids: people.map((p) => p[0]),
    memberNames: people.map((p) => p[1]),
    memberPower: people.map(() => 1_000_000),
    memberKills: people.map(() => 5),
  });
}

async function person(
  w: State,
  slug: string,
  wsId: number,
  name: string,
  tier: "member" | "officer",
  link?: { uid: number; state: "approved" | "pending" },
) {
  const [user] = await w.db
    .insert(workspaceUsers)
    .values({
      workspaceId: wsId,
      discordUserId: `d-${slug}-${name}`,
      displayName: name,
      ...(link && { playerUid: link.uid, playerLink: link.state, playerLinkedAt: T0 }),
    })
    .returning({ id: workspaceUsers.id });
  w.users[`${slug}:${name}`] = user?.id ?? 0;
  const session = await createSession(w.db, wsId, user?.id ?? 0, T0, null, tier);
  w.tokens[`${slug}:${name}`] = session.token;
}

async function setUp(w: State, db: Db) {
  w.db = db;
  await truncateAll(db);
  const [alpha, bravo] = await db
    .insert(workspaces)
    .values(
      [
        { unionId: ALPHA, slug: "alpha", discordGuildId: "1", leaderRoleIds: ["2"] },
        { unionId: BRAVO, slug: "bravo", discordGuildId: "3", leaderRoleIds: ["4"] },
      ].map((ws, i) => ({ ...ws, memberRoleIds: [String(5 + i)] })),
    )
    .returning({ id: workspaces.id });
  w.alphaId = alpha?.id ?? 0;
  await roster(w, ALPHA, "2026-11-06", [
    [101, "Ana Invented"],
    [102, "Bo Invented"],
    [103, "Cass Invented"],
  ]);
  await roster(w, BRAVO, "2026-11-06", [[202, "Cy Invented"]]);
  await person(w, "alpha", w.alphaId, "Ana Invented", "member", { uid: 101, state: "approved" });
  await person(w, "alpha", w.alphaId, "Bobby", "member", { uid: 102, state: "pending" });
  await person(w, "alpha", w.alphaId, "Nobody", "member");
  await person(w, "alpha", w.alphaId, "Rook", "officer");
  await person(w, "bravo", bravo?.id ?? 0, "Vale Officer", "officer");
}

export function selfReportWorld() {
  const w: State = { db: null as unknown as Db, alphaId: 0, tokens: {}, users: {} };
  const { tokens, users } = w;

  async function call(url: string, who: string, body: object, params: Record<string, string>) {
    const mod = url.includes("/me/away")
      ? awayRoute
      : url.includes("/me/")
        ? memberRoute
        : url.includes("/member-links")
          ? linksRoute
          : officerRoute;
    const request = new Request(`${ORIGIN}${url}`, {
      method: "POST",
      headers: {
        origin: ORIGIN,
        "sec-fetch-site": "same-origin",
        "content-type": "application/json",
        cookie: `${SESSION_COOKIE}=${tokens[who] ?? ""}`,
      },
      body: JSON.stringify(body),
    });
    const res = await (mod.POST as (r: Request, c: object) => Promise<Response>)(request, {
      params: Promise.resolve(params),
    });
    return { status: res.status, body: (await res.json()) as Record<string, unknown> };
  }

  /** A member's send from their own page. */
  const send = (who: string, changes: object[], requestId = ID(1), extra: object = {}) =>
    call("/api/w/alpha/me/facts", who, { requestId, changes, ...extra }, { slug: "alpha" });
  /** A member's own days away (issue 829). */
  const away = (who: string, body: object) =>
    call("/api/w/alpha/me/away", who, body, { slug: "alpha" });
  /** An officer's answer on a member's card. */
  const answer = (who: string, uid: number, body: object, slug = "alpha") =>
    call(`/api/w/${slug}/members/${uid}/self-report`, who, body, { slug, uid: String(uid) });

  /** Rook's "Remove link" (D142) of a member's approved link. */
  const removeLink = (who: string, uid: number) =>
    call(
      "/api/w/alpha/member-links",
      "alpha:Rook",
      { action: "unlink", user: users[who], uid },
      {
        slug: "alpha",
      },
    );

  const rook = async () => {
    const cookies = { get: () => ({ value: tokens["alpha:Rook"] ?? "" }) };
    const access = await requireWorkspace(w.db, "alpha", cookies, T0);
    if (!access.ok) throw new Error(access.reason);
    return access;
  };
  /** The member card an Alpha officer opens. */
  const card = async (uid: number) => memberCard(w.db, await rook(), uid, at);
  /** A fact an Alpha officer typed. */
  const officerFact = (uid: number, field: string, value: unknown, version = 1) =>
    w.db.insert(memberFacts).values({
      workspaceId: w.alphaId,
      uid,
      field,
      version,
      value,
      source: "officer",
      writtenBy: users["alpha:Rook"] ?? null,
      writtenAt: T0,
    });

  return {
    setUp: (db: Db) => setUp(w, db),
    roster: (unionId: number, day: string, people: [number, string][]) =>
      roster(w, unionId, day, people),
    users,
    send,
    away,
    answer,
    removeLink,
    rook,
    card,
    officerFact,
    ALPHA,
  };
}
