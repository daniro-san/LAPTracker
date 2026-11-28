// The suite's `test` (issue 477): every page in a test runs behind two guards, checked when the test ends.
// 1. No request leaves this machine: any other host is aborted and fails the test.
// 2. No private roster field reaches a page it may not (CLAUDE.md "Roster fields", D71): every HTML, JSON and
//    RSC answer is searched for the seed's sentinels (e2e/fixtures/seed.ts) and for the private fields'
//    names used as keys (`online` is a boolean with no sentinel value: its key is what can be seen, and so
//    is `daily_honor`'s, whose seeded value is its cap). Public pages and the members' board show none.
//    A workspace's desk shows only its own alliance's: joined_at, daily quest points, coins and donations on
//    its pages (CLAUDE.md: the desk may; the Members copy for a spreadsheet carries joined_at; D71 keeps x, y,
//    online and last_online_at out of copies; the export ZIP holds none of the fields, D125), and the map position and last online only in an
//    officer's member card (/api/w/<slug>/members/<uid>, read when the card opens). The member's own page
//    (/w/<slug>/board/me) shows their own quest points, coins and donations (D142). No answer carries the
//    photo URL, and a private answer of one seeded workspace never names another's members. The D76
//    exception (alliance aggregates of the daily fields on public pages) is for OWN_ALLIANCE_ID only, which
//    the seed has no rows of, so no public answer here may carry them.
import {
  test as base,
  expect,
  type BrowserContext,
  type Locator,
  type Page,
  type Response,
} from "@playwright/test";

import { compactLarge } from "../../lib/compact";
import { errorsCopy } from "../../lib/copy-errors";
import { BASE_URL } from "../env";
import { ALLIANCES, AVATAR_SENTINEL, SENTINELS, TOKENS, WORKSPACES, type Side } from "./seed";

const LOCAL_HOSTS = new Set(["127.0.0.1", "localhost"]);
const HOST = new URL(BASE_URL).hostname;
const SIDES = ["a", "b"] as const;

/**
 * A sentinel standing alone, not inside a longer number or word (a chunk name such as "x2088y"). A comma
 * before it still counts, so the second of a `[x,y]` pair or a CSV column is seen, and so does an escape
 * such as `\t` in a JSON string (a tab-separated copy row).
 */
const alone = (re: string) => new RegExp(`(?<!(?<!\\\\)[\\w.])${re}(?![\\w])`);
/** A figure as sent or as printed with thousands separators ("713,579", "713 579", "3.917"). */
const figure = (n: number) =>
  alone(String(n).replace(/\B(?=(\d{3})+$)/g, "[,.\\s\\u00a0\\u202f]?"));
/** Both alliances' last online fall on 29 February, which the card prints without the year (EN, PT, FR). */
const FORMATTED_LAST_ONLINE = /\bFeb 29\b|\b29 Feb\b|\b29 de fev|\b29 févr/i;

/** A private field's name as a key, in JSON or in the escaped RSC payload inside the HTML. */
const KEYS: [string, RegExp][] = [
  ["online", /\\?"online\\?"\s*:/],
  ["last_online_at", /\\?"(last_online_at|lastOnlineAt)\\?"\s*:/],
  ["joined_at", /\\?"(joined_at|joinedAt)\\?"\s*:/],
  ["avatar_url", /\\?"(avatar_url|avatarUrl)\\?"\s*:/],
  ["daily_tech", /\\?"(daily_tech|dailyTech)\\?"\s*:/],
  ["daily_honor", /\\?"(daily_honor|dailyHonor)\\?"\s*:/],
];

function sentinelPatterns(side: Side): [string, RegExp][] {
  const s = SENTINELS[side];
  return [
    ["x", figure(s.x)],
    ["y", figure(s.y)],
    ["last_online_at", alone(s.lastOnline.slice(0, 4))],
    ["joined_at", alone(s.joined.slice(0, 4))],
    ["active", figure(s.active)],
    ["daily_tech", figure(s.tech)],
  ];
}

/** The daily fields: on the desk (CLAUDE.md), and on the member's own page (D142). */
const DAILY_FIELDS = ["active", "daily_tech", "daily_honor"];

const slugOf = (side: Side) => ALLIANCES[side].slug;

/**
 * The fields an answer from `path` may carry, and whose they are (null: any alliance's); none for any other
 * path.
 */
function allowedAt(path: string): { side: Side | null; fields: string[] } | null {
  // The public alliance page shows every member's daily fields, nothing else private (D76 amendment
  // 2026-11-28); its /history page is not this page.
  if (/^\/alliances\/\d+$/.test(path)) return { side: null, fields: DAILY_FIELDS };
  for (const side of SIDES) {
    const slug = slugOf(side);
    if (new RegExp(`^/api/w/${slug}/members/\\d+$`).test(path)) {
      return { side, fields: ["x", "y", "online", "last_online_at", "joined_at", ...DAILY_FIELDS] };
    }
    // D142: the member's own figures, for the link's uid only. Every member of an alliance has the same
    // seeded figures, so whose they are is not told apart here; another alliance's still is.
    if (path === `/w/${slug}/board/me`) return { side, fields: DAILY_FIELDS };
    // The export ZIP's files (D125 "Never in it"): no private roster field at all, the desk's own included.
    if (path === `/api/w/${slug}/data-export`) return { side, fields: [] };
    // The desk's pages and answers.
    if (new RegExp(`^(/api)?/w/${slug}(/|$)`).test(path) && !path.startsWith(`/w/${slug}/board`)) {
      return { side, fields: ["joined_at", ...DAILY_FIELDS] };
    }
  }
  return null;
}

/** Every check: what it reports, its pattern, the field it stands for, and whose value it is (none: anyone's). */
const CHECKS: { label: string; re: RegExp; field: string; side?: Side }[] = [
  ...SIDES.flatMap((side) =>
    sentinelPatterns(side).map(([field, re]) => ({ label: `${side}.${field}`, re, field, side })),
  ),
  { label: "last_online_at (as printed)", re: FORMATTED_LAST_ONLINE, field: "last_online_at" },
  ...KEYS.map(([field, re]) => ({ label: `${field} (as a key)`, re, field })),
];

/** Which private fields of whose show in `body`, an answer from `url`. */
export function leaksIn(url: string, body: string): string[] {
  const path = new URL(url).pathname;
  const allowed = allowedAt(path);
  const mayCarry = (field: string, side?: Side) =>
    !!allowed?.fields.includes(field) &&
    (side === undefined || allowed.side === null || side === allowed.side);
  const found = CHECKS.filter((c) => !mayCarry(c.field, c.side) && c.re.test(body)).map((c) => c.label);
  if (body.includes(AVATAR_SENTINEL)) found.unshift("avatar_url");
  return [...found, ...otherMembersIn(path, body)];
}

/** On one seeded workspace's private path, every other seeded workspace's member names found in `body`. */
function otherMembersIn(path: string, body: string): string[] {
  const own = WORKSPACES.find((w) => new RegExp(`^(/api)?/w/${w.slug}(/|$)`).test(path));
  if (!own) return [];
  return WORKSPACES.filter((w) => w !== own)
    .flatMap((w) => w.names)
    .filter((name) => body.includes(name));
}

const SCANNED = /text\/html|application\/json|text\/x-component/;

/**
 * Adds the session cookie of `side`'s officer or member, as a sign-in through Discord would (D131); `name`
 * puts the token under another cookie name, as a forged cookie would; `token` sends another seeded session
 * (one a test ends, or another workspace's under that workspace's `name`).
 */
export async function signIn(
  context: BrowserContext,
  side: Side,
  tier: "officer" | "member",
  name = `__Host-lap_ws.${ALLIANCES[side].slug}`,
  token: string = TOKENS[side][tier],
) {
  await context.addCookies([
    {
      name,
      value: token,
      // A domain, not a url: Playwright drops Secure from a cookie given an http url, and a __Host- cookie
      // without Secure is refused.
      domain: HOST,
      path: "/",
      secure: true,
      httpOnly: true,
      sameSite: "Lax",
    },
    // The first-use steps (D73) and the desk language, as a returning officer has them.
    { name: "lap_ws_intro", value: "1", domain: HOST, path: "/" },
    { name: "lap_ws_lang", value: "en", domain: HOST, path: "/" },
  ]);
}

/**
 * `text` is on screen inside `locator` as rendered: innerText, so CSS-hidden exact figures do not count, with
 * any run of white space for a space and any case (labels are upper-cased by CSS).
 */
export const sees = (locator: Locator, text: string) =>
  expect(locator).toContainText(
    new RegExp(text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/ /g, "\\s+"), "i"),
    { useInnerText: true },
  );

/** The titles of the app's error boundary, not-found page and database-down page, and the generic failure line. */
const ERROR_SCREENS = new RegExp(
  [...Object.values(errorsCopy).map((e) => e.title), "Something went wrong"]
    .map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
    .join("|"),
);

/** No error screen on the page: the app's error boundary, the not-found page, the database-down line. */
export async function noError(page: Page) {
  await expect(page.getByText(ERROR_SCREENS)).toHaveCount(0);
}

/** The desk's frame for an alliance: its tag and name under the header, and no error screen. */
export async function deskFrame(page: Page, a: { tag: string; name: string }) {
  await expect(page.getByText(`${a.tag} · ${a.name}`)).toBeVisible();
  await noError(page);
}

/**
 * Waits until React has hydrated `target` (it then carries React's props key): a tap on a server-drawn button
 * before hydration does nothing. Not `networkidle`: the desk's read status bar polls (D141).
 */
export const hydrated = (target: Locator) =>
  expect
    .poll(() => target.evaluate((el) => Object.keys(el).some((k) => k.startsWith("__reactProps$"))))
    .toBe(true);

/**
 * Runs `action` (a tap that saves), then waits until the page's refresh of `path` (router.refresh, an RSC
 * answer) has come in whole: a reload or a new page cut short would leave that answer unread by the guards.
 */
export async function savedAndRefreshed(page: Page, path: string, action: () => Promise<void>) {
  const refreshed = page.waitForResponse(
    (r) => new URL(r.url()).pathname === path && r.request().headers()["rsc"] === "1",
  );
  await action();
  await (await refreshed).finished();
}

/**
 * Taps a feed's "Show more" (Home's Recent activity) until `item` is listed: the tests' own writes are newer
 * than the seed's rows, so a seeded line may be on a later page.
 */
export async function showMoreUntil(feed: Locator, item: Locator) {
  const more = feed.getByRole("button", { name: "Show more" });
  while ((await item.count()) === 0) {
    const shown = await feed.getByRole("listitem").count();
    await hydrated(more);
    await more.click();
    await expect.poll(() => feed.getByRole("listitem").count()).toBeGreaterThan(shown);
  }
}

/** A figure of 1,000 or more as the pages write it (lib/compact, D78). */
export const big = (n: number) => compactLarge(n, "en-GB");

export const test = base.extend<{ guards: undefined }>({
  guards: [
    async ({ context }, use) => {
      const outbound: string[] = [];
      const leaks: string[] = [];
      const reads: Promise<void>[] = [];
      await context.route("**/*", (route) => {
        const url = new URL(route.request().url());
        if (LOCAL_HOSTS.has(url.hostname)) return route.continue();
        outbound.push(url.host);
        return route.abort("blockedbyclient");
      });
      const scan = (response: Response) => {
        // A redirect has no body to read.
        if (response.status() >= 300 && response.status() < 400) return;
        if (!SCANNED.test(response.headers()["content-type"] ?? "")) return;
        const url = response.url();
        reads.push(
          response.text().then(
            (body) => {
              leaks.push(...leaksIn(url, body).map((l) => `${l} in ${url}`));
            },
            // An answer that could not be read could not be checked either.
            () => {
              leaks.push(`unreadable answer ${url}`);
            },
          ),
        );
      };
      context.on("response", scan);
      await use(undefined);
      context.off("response", scan);
      await Promise.all(reads);
      expect(outbound, "requests that left this machine").toEqual([]);
      expect(leaks, "private roster fields in an answer").toEqual([]);
    },
    { auto: true },
  ],
});

export { expect };

/** A name inside Unicode isolates, as isolate() writes it into a label or a line (a RegExp source). */
export const isolated = (name: string) => `\\u2068?${name}\\u2069?`;

/** A label that starts with `prefix` and a name, the name inside Unicode isolates (isolate(), <bdi>). */
export const labelled = (prefix: string, name: string) => new RegExp(`^${prefix}\\u2068?${name}\\u2069?`);
