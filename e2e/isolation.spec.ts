// Multi-alliance isolation (issue 477, #471): one workspace's officer or member never opens the other
// workspace's desk, board or data, by page or by API, whichever cookie carries their session; and no answer of
// the site carries a private roster field (CLAUDE.md "Roster fields", D71), checked against the seed's
// sentinels. Runs on the phone project only: none of it depends on the window.
import { request, type APIRequestContext, type Page } from "@playwright/test";

import { BASE_URL } from "./env";
import {
  ALLIANCES,
  calendarOf,
  KVK_ENTRY,
  LINKED,
  memberUid,
  seededAt,
  SENTINELS,
  TOKENS,
  type Side,
  WORKSPACES,
} from "./fixtures/seed";
import { expect, leaksIn, noError, sees, signIn, test } from "./fixtures/test";

const other = (side: Side): Side => (side === "a" ? "b" : "a");
const slug = (side: Side) => ALLIANCES[side].slug;
/**
 * Every might the seed gives the other alliance's members on its newest roster, as the desk writes it
 * (40M − k·2.5M + 650K): any of them on a refused page would be that alliance's data.
 */
const mightsOf = (side: Side) =>
  ALLIANCES[side].names.map(
    (_, k) => `${((40_000_000 - k * 2_500_000 + 650_000) / 1e6).toFixed(1)}M`,
  );

/** The sign-in screen a refused visit gets (D99), and nothing of `side`'s alliance on it. */
async function signInScreenOnly(page: Page, side: Side) {
  const screen = page.getByRole("region", { name: "Sign in" });
  await expect(screen.getByRole("heading", { level: 1, name: "Sign in" })).toBeVisible();
  await sees(screen, "Sign in with the Discord account you use in the alliance’s server.");
  await expect(screen.getByRole("link", { name: "Sign in with Discord" })).toBeVisible();
  await noError(page);
  const a = ALLIANCES[side];
  const text = await page.locator("body").innerText();
  expect(text).not.toMatch(new RegExp(`\\b${a.tag}\\b`));
  expect(text).not.toContain(a.name);
  for (const name of a.names) expect(text).not.toContain(name);
  for (const might of mightsOf(side)) expect(text).not.toContain(might);
  // The HTML (with its RSC payload) carries none of it either.
  const html = await page.content();
  for (const name of [a.name, ...a.names]) expect(html).not.toContain(name);
}
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

  test("a's officer reads none of b's members through a's own workspace", async ({
    context,
    page,
  }) => {
    const ctx = await api(cookiesOf("a", "officer")[0] as string);
    const card = await ctx.get(`/api/w/${slug("a")}/members/${memberUid("b", 0)}`);
    expect(card.status()).toBe(404);
    const mark = await ctx.post(`/api/w/${slug("a")}/roll-call`, {
      data: {
        action: "mark",
        occasion: { entry: KVK_ENTRY, week: cal.raid.week },
        uid: memberUid("b", 0),
        mark: "yes",
        version: 0,
      },
    });
    expect(mark.status()).toBe(400);
    expect(await mark.json()).toEqual({ code: "not_member" });
    await ctx.dispose();
    // On screen: a's Raid prep still has its own roster and marks, and none of b's members.
    await signIn(context, "a", "officer");
    await page.goto(`/w/${slug("a")}/roll-call/mark?entry=${KVK_ENTRY}&week=${cal.raid.week}`);
    await expect(page.getByRole("heading", { level: 1, name: "Raid prep" })).toBeVisible();
    await noError(page);
    const ROSTER = ALLIANCES.a.names.length - 1;
    await sees(page.locator("main"), `4 of ${ROSTER} marked`);
    await expect(page.getByRole("button", { name: `All ${ROSTER}` })).toBeVisible();
    for (const name of ALLIANCES.b.names) await expect(page.getByText(name)).toHaveCount(0);
  });

  for (const [tier, name] of (["officer", "member"] as const).flatMap((t) =>
    cookieNames("a").map((n) => [t, n] as const),
  )) {
    test(`a's ${tier} as ${name} sees no page of b's desk or board`, async ({ context, page }) => {
      await signIn(context, "a", tier, name);
      for (const path of ["", "/members", "/roll-call", "/board", "/board/me"]) {
        await page.goto(`/w/${slug("b")}${path}`);
        await signInScreenOnly(page, "b");
      }
    });
  }
});

test.describe("no answer carries a private roster field", () => {
  const raid = `/w/${slug("a")}/roll-call/mark?entry=${KVK_ENTRY}&week=${cal.raid.week}`;
  // Each path with a marker of the real page (so a sign-in screen cannot pass the scan): the alliance, the
  // player, or the signed-in person's name.
  const officer = "Officer LNK";
  const member = "Member LNK";
  const A = ALLIANCES.a.name;
  const sweeps: [string, string | null, [string, string][]][] = [
    [
      "the public pages",
      null,
      [
        ["/", A],
        ["/alliances", A],
        ["/events/1", A],
        ["/events/2", A],
        [`/events/2/alliances/${ALLIANCES.a.unionId}`, A],
        [`/players/${memberUid("a", 0)}`, ALLIANCES.a.names[0] as string],
        [`/players/${memberUid("b", 0)}`, ALLIANCES.b.names[0] as string],
        [`/alliances/${ALLIANCES.a.unionId}/history`, A],
      ],
    ],
    [
      "a's desk",
      cookiesOf("a", "officer")[0] as string,
      [
        [`/w/${slug("a")}`, officer],
        [`/w/${slug("a")}/members`, officer],
        [`/w/${slug("a")}/members?view=former`, officer],
        [`/w/${slug("a")}/roll-call`, officer],
        [raid, officer],
        [`/w/${slug("a")}/insights`, officer],
        [`/w/${slug("a")}/follow-up`, officer],
        [`/w/${slug("a")}/calendar`, officer],
        [`/api/w/${slug("a")}/activity?before=${Date.now()}`, officer],
      ],
    ],
    [
      "a's board",
      cookiesOf("a", "member")[0] as string,
      [
        [`/w/${slug("a")}/board`, member],
        [`/w/${slug("a")}/board/me`, member],
      ],
    ],
  ];
  for (const [label, cookie, paths] of sweeps) {
    test(label, async () => {
      const ctx = await api(cookie);
      for (const [path, marker] of paths) {
        const res = await ctx.get(path);
        expect(res.status(), path).toBe(200);
        const body = await res.text();
        // The sign-in screen's own heading (its words are also in every page's copy, so not those).
        expect(body, `${path}: not the sign-in screen`).not.toMatch(/<h1[^>]*>Sign in<\/h1>/);
        expect(body, `${path}: the real page`).toContain(marker);
        // proxy.ts: no shared or browser cache keeps a private page or answer (D71).
        if (/^\/(api\/)?w\//.test(path)) {
          expect(res.headers()["cache-control"], path).toBe("private, no-store");
        }
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

  // The positive controls: the scan, given these real answers as if a public page had sent them, finds every
  // sentinel D71 lets the own desk carry, so the passes above are not blind.
  test("the scan sees the own desk's fields where D71 allows them", async () => {
    const ctx = await api(cookiesOf("a", "officer")[0] as string);
    const cardPath = `/api/w/${slug("a")}/members/${LINKED.a}`;
    const card = await ctx.get(cardPath);
    expect(card.status()).toBe(200);
    const cardBody = await card.text();
    expect(leaksIn(`${BASE_URL}${cardPath}`, cardBody)).toEqual([]);
    expect(leaksIn(`${BASE_URL}/`, cardBody)).toEqual(
      expect.arrayContaining(["a.x", "a.y", "last_online_at (as printed)"]),
    );
    const members = await ctx.get(`/w/${slug("a")}/members`);
    const membersBody = await members.text();
    expect(leaksIn(`${BASE_URL}/w/${slug("a")}/members`, membersBody)).toEqual([]);
    expect(leaksIn(`${BASE_URL}/`, membersBody)).toContain("a.joined_at");
    await ctx.dispose();
  });

  // The scan's two weak spots the review found, each proved on its own: a private field's name as a key
  // (online has no sentinel value), and a sentinel after a comma (a [x,y] pair, a CSV column after the first).
  test("the scan sees online as a key and a sentinel after a comma", () => {
    const publicPage = `${BASE_URL}/`;
    const s = SENTINELS.a;
    expect(leaksIn(publicPage, '{"members":[{"uid":1,"online":true}]}')).toContain(
      "online (as a key)",
    );
    expect(leaksIn(publicPage, '\\"online\\":false')).toContain("online (as a key)");
    expect(leaksIn(publicPage, `{"map":[${s.x},${s.y}]}`)).toEqual(
      expect.arrayContaining(["a.x", "a.y"]),
    );
    expect(leaksIn(publicPage, `name,joined\nEsk Vale,${s.joined.slice(0, 10)}`)).toContain(
      "a.joined_at",
    );
  });

  // Every seeded workspace, the filler alliances' too: a private answer of one that names another's member
  // is a leak; its own members are not.
  test("the scan sees another seeded workspace's member on each workspace's private answers", () => {
    for (const w of WORKSPACES) {
      const url = `${BASE_URL}/w/${w.slug}/settings`;
      for (const o of WORKSPACES.filter((x) => x !== w)) {
        const name = o.names[0] as string;
        expect(leaksIn(url, `<p>${name}</p>`), `${o.slug} on ${w.slug}`).toContain(name);
      }
      expect(leaksIn(url, `<p>${w.names.join(", ")}</p>`), w.slug).toEqual([]);
    }
  });
});
