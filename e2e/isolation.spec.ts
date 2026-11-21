// Multi-alliance isolation (issue 477, #471): one workspace's officer or member never opens the other
// workspace's desk, board or data, by page or by API, whichever cookie carries their session; and no answer of
// the site carries a private roster field (CLAUDE.md "Roster fields", D71), checked against the seed's
// sentinels. Runs on the phone project only: none of it depends on the window.
import { request, type APIRequestContext } from "@playwright/test";

import { BASE_URL } from "./env";
import {
  ALLIANCES,
  calendarOf,
  CHEESE_ENTRY,
  KVK_ENTRY,
  LINKED,
  memberUid,
  seededAt,
  SENTINELS,
  TOKENS,
  type Side,
} from "./fixtures/seed";
import { expect, leaksIn, signIn, test } from "./fixtures/test";

const other = (side: Side): Side => (side === "a" ? "b" : "a");
const slug = (side: Side) => ALLIANCES[side].slug;
const cal = calendarOf(seededAt());
/** Private fields no JSON answer has as a key, as stored or as the app names them (daily_* and active: D76). */
const PRIVATE_KEYS = new Set([
  "x",
  "y",
  "online",
  "last_online_at",
  "joined_at",
  "avatar_url",
  "lastOnlineAt",
  "joinedAt",
  "avatarUrl",
]);

/** Every key at any depth of a parsed JSON answer. */
const keysOf = (v: unknown): string[] =>
  Array.isArray(v)
    ? v.flatMap(keysOf)
    : v !== null && typeof v === "object"
      ? Object.entries(v).flatMap(([k, child]) => [k, ...keysOf(child)])
      : [];

/** Every cookie name that could carry `side`'s session to the other workspace: its own, the other's, the old one. */
const cookieNames = (side: Side) => [
  `__Host-lap_ws.${slug(side)}`,
  `__Host-lap_ws.${slug(other(side))}`,
  "__Host-lap_ws",
];
const cookiesOf = (side: Side, tier: "officer" | "member") =>
  cookieNames(side).map((name) => `${name}=${TOKENS[side][tier]}`);

async function api(cookie: string | null): Promise<APIRequestContext> {
  return request.newContext({
    baseURL: BASE_URL,
    extraHTTPHeaders: { ...(cookie ? { cookie } : {}), origin: BASE_URL },
  });
}

test.describe("one workspace's sessions never open the other's", () => {
  for (const side of ["a", "b"] as const) {
    for (const tier of ["officer", "member"] as const) {
      test(`${side}'s ${tier}: the other workspace's API answers signed_out`, async () => {
        const target = other(side);
        for (const cookie of cookiesOf(side, tier)) {
          const ctx = await api(cookie);
          const base = `/api/w/${slug(target)}`;
          for (const path of [
            `${base}/members/${memberUid(target, 0)}`,
            `${base}/activity?before=${Date.now()}`,
            `${base}/read-status`,
          ]) {
            const res = await ctx.get(path);
            expect(res.status(), `${path} with ${cookie.split("=")[0]}`).toBe(401);
            expect(await res.json()).toEqual({ code: "signed_out" });
          }
          const mark = await ctx.post(`${base}/roll-call`, {
            data: {
              action: "mark",
              occasion: { entry: KVK_ENTRY, week: cal.raid.week },
              uid: memberUid(target, 0),
              mark: "yes",
              version: 0,
            },
          });
          expect(mark.status()).toBe(401);
          await ctx.dispose();
        }
      });
    }
  }

  test("a's officer reads none of b's members through a's own workspace", async () => {
    const ctx = await api(cookiesOf("a", "officer")[0] as string);
    const card = await ctx.get(`/api/w/${slug("a")}/members/${memberUid("b", 0)}`);
    expect(card.status()).toBe(404);
    const mark = await ctx.post(`/api/w/${slug("a")}/roll-call`, {
      data: {
        action: "mark",
        occasion: { entry: CHEESE_ENTRY, week: cal.week },
        uid: memberUid("b", 0),
        mark: "yes",
        version: 0,
      },
    });
    expect(mark.status()).toBe(400);
    expect(await mark.json()).toEqual({ code: "not_member" });
    await ctx.dispose();
  });

  test("a's member gets signed_out from a's own desk API", async () => {
    const ctx = await api(cookiesOf("a", "member")[0] as string);
    for (const path of [
      `/api/w/${slug("a")}/members/${memberUid("a", 0)}`,
      `/api/w/${slug("a")}/activity?before=${Date.now()}`,
      `/api/w/${slug("a")}/read-status`,
    ]) {
      expect((await ctx.get(path)).status(), path).toBe(401);
    }
    await ctx.dispose();
  });

  for (const [tier, name] of (["officer", "member"] as const).flatMap((t) =>
    cookieNames("a").map((n) => [t, n] as const),
  )) {
    test(`a's ${tier} as ${name} sees no page of b's desk or board`, async ({ context, page }) => {
      await signIn(context, "a", tier, name);
      for (const path of ["", "/members", "/roll-call", "/board", "/board/me"]) {
        await page.goto(`/w/${slug("b")}${path}`);
        await expect(
          page
            .getByRole("button", { name: /Sign in with Discord/ })
            .or(page.getByRole("link", { name: /Sign in with Discord/ })),
        ).toBeVisible();
        const text = await page.content();
        expect(text).not.toContain(ALLIANCES.b.name);
        for (const name of ALLIANCES.b.names) expect(text).not.toContain(name);
      }
    });
  }
});

test.describe("no answer carries a private roster field", () => {
  const raid = `/w/${slug("a")}/roll-call/mark?entry=${KVK_ENTRY}&week=${cal.raid.week}`;
  const sweeps: [string, string | null, string[]][] = [
    [
      "the public pages",
      null,
      [
        "/",
        "/alliances",
        "/events/1",
        "/events/2",
        `/events/2/alliances/${ALLIANCES.a.unionId}`,
        `/players/${memberUid("a", 0)}`,
        `/players/${memberUid("b", 0)}`,
        `/alliances/${ALLIANCES.a.unionId}/history`,
      ],
    ],
    [
      "a's desk",
      cookiesOf("a", "officer")[0] as string,
      [
        `/w/${slug("a")}`,
        `/w/${slug("a")}/members`,
        `/w/${slug("a")}/members?view=former`,
        `/w/${slug("a")}/roll-call`,
        raid,
        `/w/${slug("a")}/insights`,
        `/w/${slug("a")}/follow-up`,
        `/w/${slug("a")}/calendar`,
        `/api/w/${slug("a")}/activity?before=${Date.now()}`,
      ],
    ],
    [
      "a's board",
      cookiesOf("a", "member")[0] as string,
      [`/w/${slug("a")}/board`, `/w/${slug("a")}/board/me`],
    ],
  ];
  for (const [label, cookie, paths] of sweeps) {
    test(label, async () => {
      const ctx = await api(cookie);
      for (const path of paths) {
        const res = await ctx.get(path);
        expect(res.status(), path).toBe(200);
        const body = await res.text();
        expect(leaksIn(`${BASE_URL}${path}`, body), path).toEqual([]);
        if (res.headers()["content-type"]?.includes("json")) {
          expect(
            keysOf(JSON.parse(body)).filter((k) => PRIVATE_KEYS.has(k)),
            path,
          ).toEqual([]);
        }
      }
      await ctx.dispose();
    });
  }

  test("an officer's own member card shows its own map position, never the other alliance's or the photo URL", async () => {
    const ctx = await api(cookiesOf("a", "officer")[0] as string);
    const res = await ctx.get(`/api/w/${slug("a")}/members/${LINKED.a}`);
    expect(res.status()).toBe(200);
    const body = await res.text();
    // D71 allows this one answer the alliance's own fields; the sentinel shows the check above can see them.
    expect(body).toContain(String(SENTINELS.a.x));
    expect(body).toMatch(/Feb 29/);
    expect(leaksIn(`${BASE_URL}/api/w/${slug("a")}/members/${LINKED.a}`, body)).toEqual([]);
    await ctx.dispose();
  });
});
