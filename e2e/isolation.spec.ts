// Multi-alliance isolation (issue 477, #471): one workspace's officer or member never opens the other
// workspace's desk, board or data, by page or by API, whichever cookie carries their session; and no answer of
// the site carries a private roster field (CLAUDE.md "Roster fields", D71), checked against the seed's
// sentinels. Runs on the phone project only: none of it depends on the window.
import { request, type APIRequestContext, type Page } from "@playwright/test";

import { UNLOGGED_ROSTER_KEYS } from "../lib/queries/blocked-keys";
import { unzip } from "../lib/zip.test-helpers";
import { BASE_URL } from "./env";
import {
  ALLIANCES,
  calendarOf,
  KVK_ENTRY,
  DAILY,
  lastRosterDay,
  LEAVER,
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
/** Private fields no JSON answer has as a key, as stored or as the app names them (daily_* and active are
 * public on the alliance page since the D76 amendment of 2026-11-28, and no JSON answer serves them). */
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

/** Columns no exported CSV may have (D125, as lib/repo/workspace-data.ts NEVER drops them). */
const EXPORT_NEVER = new Set<string>([...UNLOGGED_ROSTER_KEYS, "avatar_url"]);
/** The banned columns in an exported CSV's header (English files use ","; a BOM may lead). */
const bannedColumns = (csv: string) =>
  (csv.replace(/^\uFEFF/, "").split("\r\n")[0] ?? "")
    .split(",")
    .filter((column) => EXPORT_NEVER.has(column));

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
          expect(await mark.json()).toEqual({ code: "signed_out" });
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
  // Each sweep with the Lantern Keep session it runs with (none: signed out).
  const sweeps: [string, "officer" | "member" | null, [string, string][]][] = [
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
        [`/alliances/${ALLIANCES.a.unionId}`, A],
        [`/alliances/${ALLIANCES.a.unionId}?tab=moves`, A],
      ],
    ],
    [
      // Every public JSON answer under app/api that reads (GET). Left out: /api/quota and /api/quota/check
      // (each spends an upstream call), and the POST routes (PIN, cron secret, or an upstream read: details).
      "the public JSON answers",
      null,
      [
        ["/api/events", `Saturday Event ${cal.events[1]}`],
        ["/api/events/2", ALLIANCES.a.tag],
        ...(["a", "b"] as const).map((side): [string, string] => [
          // The newest daily read's card (its source_updated_at, as the seed writes it).
          `/api/alliances/${ALLIANCES[side].unionId}/history?at=${new Date(`${lastRosterDay()}T23:31:00-02:00`).toISOString()}`,
          ALLIANCES[side].names[0] as string,
        ]),
      ],
    ],
    [
      "a's desk",
      "officer",
      [
        [`/w/${slug("a")}`, officer],
        [`/w/${slug("a")}/members`, officer],
        [`/w/${slug("a")}/members?view=former`, officer],
        [`/w/${slug("a")}/roll-call`, officer],
        [raid, officer],
        [`/w/${slug("a")}/insights`, officer],
        [`/w/${slug("a")}/follow-up`, officer],
        [`/w/${slug("a")}/calendar`, officer],
        [`/w/${slug("a")}/calendar/caravans`, officer],
        [`/w/${slug("a")}/notices`, officer],
        [`/w/${slug("a")}/notices/new`, officer],
        [`/w/${slug("a")}/notices/pictures`, officer],
        [`/w/${slug("a")}/thefts`, officer],
        [`/w/${slug("a")}/import`, officer],
        [`/w/${slug("a")}/start-here`, officer],
        [`/w/${slug("a")}/settings`, officer],
        [`/api/w/${slug("a")}/activity?before=${Date.now()}`, officer],
      ],
    ],
    [
      "a's board",
      "member",
      [
        [`/w/${slug("a")}/board`, member],
        [`/w/${slug("a")}/board/me`, member],
      ],
    ],
  ];
  for (const [label, tier, paths] of sweeps) {
    test(label, async ({ context, page }) => {
      const ctx = await api(tier ? (cookiesOf("a", tier)[0] as string) : null);
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
      // A desk or board page whose data failed still answers 200, its error boundary drawn in the browser;
      // the HTML alone cannot tell (its payload carries the error copy as words for the page's forms). So
      // each is also opened, and shows its marker and no error screen. The public pages have theirs in
      // public.spec.ts.
      if (!tier) return;
      await signIn(context, "a", tier);
      for (const [path, marker] of paths.filter(([path]) => !path.startsWith("/api/"))) {
        await page.goto(path);
        // The page itself, not a redirect to Home or the sign-in screen.
        expect(new URL(page.url()).pathname, path).toBe(path.split("?")[0]);
        await noError(page);
        await expect(page.getByText(marker).first(), path).toBeAttached();
      }
    });
  }

  // "Download our data" (D125 "Never in it"): no file of the ZIP carries any private roster field or the
  // photo URL, by sentinel or as a key; no CSV has a column named after one of them; no file names Moss
  // Hollow's members.
  test("the export ZIP", async () => {
    const path = `/api/w/${slug("a")}/data-export`;
    const ctx = await api(`${cookiesOf("a", "officer")[0]}; lap_ws_lang=en`);
    const res = await ctx.post(path, { data: { requestId: crypto.randomUUID() } });
    expect(res.status()).toBe(200);
    expect(res.headers()["content-type"]).toBe("application/zip");
    const files = unzip(await res.body());
    await ctx.dispose();
    // The real file: the README's title names the alliance, the people file its officer, and the former
    // members' file the member who left at the last event.
    expect(files.get("README.txt")?.toString("utf8")).toContain(ALLIANCES.a.name);
    expect(files.get("people.csv")?.toString("utf8")).toContain(officer);
    expect(files.get("former-members.csv")?.toString("utf8")).toContain(
      ALLIANCES.a.names[LEAVER] as string,
    );
    for (const [name, data] of files) {
      const body = data.toString("utf8");
      expect(leaksIn(`${BASE_URL}${path}`, body), name).toEqual([]);
      if (name.endsWith(".csv")) expect(bannedColumns(body), name).toEqual([]);
    }
  });

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
    // D142: the member's own page, with their own daily quest points; of the public pages only the alliance
    // page shows them (D76 amendment 2026-11-28).
    const board = await api(cookiesOf("a", "member")[0] as string);
    const mePath = `/w/${slug("a")}/board/me`;
    const meBody = await (await board.get(mePath)).text();
    expect(leaksIn(`${BASE_URL}${mePath}`, meBody)).toEqual([]);
    expect(leaksIn(`${BASE_URL}/`, meBody)).toContain("a.active");
    await board.dispose();
  });

  // The public alliance page renders the seeded daily fields per member (D76 amendment 2026-11-28), and the
  // sweep above found no other private field on it.
  test("the public alliance page shows each member's seeded daily fields", async () => {
    const ctx = await api(null);
    const body = await (await ctx.get(`/alliances/${ALLIANCES.a.unionId}`)).text();
    expect(body).toContain(ALLIANCES.a.names[0] as string);
    for (const label of ["Quest points", "Help coins", "Tech donated"])
      expect(body).toContain(label);
    // Exact spellings, from the page's exact-numbers spans.
    expect(body).toContain(`>${DAILY.tech.toLocaleString("en")}<`);
    expect(body).toContain(`>${DAILY.honor.toLocaleString("en")}<`);
    expect(leaksIn(`${BASE_URL}/alliances/${ALLIANCES.a.unionId}`, body)).toEqual([]);
    await ctx.dispose();
  });

  // The daily fields, each by surface: the public alliance page shows any alliance's (D76 amendment
  // 2026-11-28), every other public page and the board's home show none; the member's own page and the desk
  // show the own alliance's (D142, CLAUDE.md), never another's; an export keeps joined_at but not the map
  // position (D71).
  test("the scan sees the daily fields and the export's fields where no rule allows them", () => {
    const [a, b] = [SENTINELS.a, SENTINELS.b];
    const daily = `{"active":${a.active},"dailyTech":${a.tech},"dailyHonor":1000}`;
    expect(leaksIn(`${BASE_URL}/`, daily)).toEqual(
      expect.arrayContaining([
        "a.active",
        "a.daily_tech",
        "daily_tech (as a key)",
        "daily_honor (as a key)",
      ]),
    );
    expect(leaksIn(`${BASE_URL}/api/events`, `donations 3,917`)).toContain("a.daily_tech");
    const alliancePage = `${BASE_URL}/alliances/${ALLIANCES.b.unionId}`;
    expect(leaksIn(alliancePage, daily)).toEqual([]);
    expect(leaksIn(alliancePage, `map ${a.x}`)).toEqual(["a.x"]);
    expect(leaksIn(`${alliancePage}/history`, daily)).toContain("a.active");
    expect(leaksIn(`${BASE_URL}/w/${slug("a")}/board`, daily)).toContain("a.active");
    expect(leaksIn(`${BASE_URL}/w/${slug("a")}/board/me`, daily)).toEqual([]);
    expect(leaksIn(`${BASE_URL}/w/${slug("a")}/board/me`, `Average ${b.active}`)).toContain(
      "b.active",
    );
    expect(leaksIn(`${BASE_URL}/w/${slug("a")}/settings`, daily)).toEqual([]);
    // The export allows none of them (D125), the desk's own joined_at and daily fields included.
    const exported = `${BASE_URL}/api/w/${slug("a")}/data-export`;
    expect(leaksIn(exported, `uid,joined\n1,${a.joined.slice(0, 10)}`)).toEqual(["a.joined_at"]);
    expect(leaksIn(exported, `uid,map\n1,${a.x}`)).toEqual(["a.x"]);
    expect(leaksIn(exported, daily)).toEqual(
      expect.arrayContaining(["a.active", "a.daily_tech", "daily_honor (as a key)"]),
    );
    // The CSV header check flags a column named after a private field, after the BOM and at any place.
    expect(bannedColumns("\uFEFFid,online,name,joined_at\r\n1,true,Esk Vale,")).toEqual([
      "online",
      "joined_at",
    ]);
    expect(bannedColumns("\uFEFFid,daily_tech\r\n")).toEqual(["daily_tech"]);
    expect(bannedColumns("\uFEFFid,name,joined\r\n")).toEqual([]);
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
