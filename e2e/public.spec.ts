// The public pages (issue 477): the home ledger, the alliance list, a player page, and an event's ledger with
// the member-change mark (D69 amendment) and its split. No sign-in. Every expected figure is computed from the
// seed's own rows (e2e/fixtures/seed.ts) and written with the pages' formatter (`big`, lib/compact); none
// depends on the day the suite runs.
import type { Locator, Page } from "@playwright/test";

import {
  ALLIANCES,
  boardOf,
  calendarOf,
  changedAtLastEvent,
  endOf,
  eventTotals,
  lastRosterDay,
  memberChange,
  memberUid,
  rosterOf,
  seededAt,
  shown,
  type Side,
} from "./fixtures/seed";
import { OPPONENT } from "./fixtures/seed-kvk";
import { big, expect, hydrated, noError, sees, test } from "./fixtures/test";

const A = ALLIANCES.a;
const lastEvent = calendarOf(seededAt()).events[1] as string;
const MINUS = "−";
const pct = (part: number, whole: number) => `${((part / whole) * 100).toFixed(1)}%`;

/** The page scrolls sideways when its content is wider than the window. */
const sideways = (page: Page) =>
  page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);

/** No error screen, and no empty state where the seed put data. */
async function noErrorOrEmpty(page: Page) {
  await noError(page);
  await expect(page.getByText(/fills after tonight|No events yet/)).toHaveCount(0);
}

/** An alliance's row of the event ledger: the list item holding its link. */
const ledgerRow = (page: Page, a: { tag: string; name: string }): Locator =>
  page
    .getByRole("listitem")
    .filter({ has: page.getByRole("link", { name: `[${a.tag}] ${a.name}`, exact: true }) });

/** The two workspaces' rows on the last event's ledger: rank, End might and kills, the changes, members. */
async function seededLedger(page: Page) {
  await expect(
    page.getByRole("heading", {
      level: 2,
      name: shown(lastEvent, "en-GB", { weekday: "long", day: "numeric", month: "long" }),
    }),
  ).toBeVisible();
  for (const [side, rank, members] of [
    ["a", 1, "11 = 0 · +1 joined · −1 left"],
    ["b", 2, "8 = 0"],
  ] as [Side, number, string][]) {
    const [start, end] = [eventTotals(side, "before"), eventTotals(side, "after")];
    const row = ledgerRow(page, ALLIANCES[side]);
    const fell = start.might - end.might;
    const gained = end.kills - start.kills;
    await sees(row, `#${rank}`);
    await sees(
      row,
      `Might ${big(end.might)} ▼ ${MINUS}${big(fell)} (${MINUS}${pct(fell, start.might)})`,
    );
    await sees(row, `Kills ${big(end.kills)} ▲ +${big(gained)} (+${pct(gained, start.kills)})`);
    await sees(row, `Members ${members}`);
  }
  await expect(page.getByRole("link", { name: /^\[(LNK|MSH|IRT|MNW|GLW)\]/ })).toHaveCount(5);
}

test("the home page shows the last event's ledger with the seeded figures", async ({ page }) => {
  await page.goto("/");
  await expect(
    page.getByRole("heading", { level: 1, name: "Server 325 · Event Ledger" }),
  ).toBeVisible();
  await seededLedger(page);
  await noErrorOrEmpty(page);
  expect(await sideways(page)).toBe(false);
});

test("the alliance list shows yesterday's ranks board", async ({ page }) => {
  await page.goto("/alliances");
  await expect(page.getByRole("heading", { level: 1, name: "All alliances" })).toBeVisible();
  await expect(
    page.getByText(
      `Ranks board of ${shown(lastRosterDay(), "en-GB", { day: "numeric", month: "short" })}`,
    ),
  ).toBeVisible();
  const tracked = page.getByRole("region", { name: "Read every day (5)" });
  await expect(tracked.getByRole("listitem")).toHaveCount(5);
  for (const [n, a] of [ALLIANCES.a, ALLIANCES.b].entries()) {
    const b = boardOf(n);
    const row = tracked
      .getByRole("listitem")
      .filter({ has: page.getByRole("link", { name: `[${a.tag}] ${a.name}` }) });
    await sees(row, `#${b.rank}`);
    await sees(row, `Might ${big(b.might)} Kills ${big(b.kills)}`);
  }
  await noErrorOrEmpty(page);
  expect(await sideways(page)).toBe(false);
});

test("a player page shows the player's figures at the last event's End", async ({ page }) => {
  await page.goto(`/players/${memberUid("a", 0)}`);
  await expect(page.getByRole("heading", { level: 1, name: A.names[0] as string })).toBeVisible();
  const figures = page.getByRole("region", { name: "Player" });
  const end = endOf("a", 0);
  await sees(figures, `Might ${big(end.might)}`);
  await sees(figures, `Kills ${big(end.kills)}`);
  await sees(figures, "Level 25");
  await sees(
    figures,
    `As of ${shown(lastEvent, "en-GB", { day: "numeric", month: "short" })}, 14:00 server time`,
  );
  await expect(page.getByRole("link", { name: `[${A.tag}] ${A.name}` }).first()).toBeVisible();
  await noErrorOrEmpty(page);
  expect(await sideways(page)).toBe(false);
});

test("a player's might chart names a reading under it at a step, and the address keeps it (D158)", async ({
  page,
}) => {
  await page.goto(`/players/${memberUid("a", 0)}`);
  await expect(page.getByRole("heading", { level: 1, name: A.names[0] as string })).toBeVisible();
  const progress = page.locator("section").filter({ hasText: "Daily progress" });
  // The first readout in the card is the might chart's; it starts on the newest reading, the last daily read.
  const line = progress.locator("p[aria-live]").first();
  const day = shown(lastRosterDay(), "en-GB", { day: "numeric", month: "short" });
  await expect(line).toHaveText(`${day} · ${big(rosterOf("a", 0).might)}`);
  const [earlier, later] = [
    progress.getByRole("button", { name: "Earlier" }).first(),
    progress.getByRole("button", { name: "Later" }).first(),
  ];
  await hydrated(earlier);
  await expect(later).toBeDisabled();
  expect((await earlier.boundingBox())?.height).toBeGreaterThanOrEqual(44);
  const newest = (await line.textContent()) ?? "";
  await earlier.click();
  await expect(line).not.toHaveText(newest);
  await expect(later).toBeEnabled();
  const stepped = (await line.textContent()) ?? "";
  await expect(page).toHaveURL(/#at-might-\d+$/);
  // Back to the page (a reload here) shows the same reading.
  await page.reload();
  await expect(line).toHaveText(stepped);
});

test("an event's ledger marks the change that members who joined or left moved, and splits it", async ({
  page,
}) => {
  await page.goto("/events/2");
  await seededLedger(page);
  // Only Lantern Keep's members changed: one mark on its Might and one on its Kills, none elsewhere.
  const marks = page.locator("summary:visible", {
    hasText: "Includes member changes: show the split",
  });
  await expect(marks).toHaveCount(2);
  const might = ledgerRow(page, A).locator("details", {
    hasText: "Includes member changes: show the split, Might",
  });
  await hydrated(might);
  await might.locator("summary").click();
  const split = might.locator("dl");
  await expect(split).toBeVisible();
  const line = (term: string) =>
    split.locator("div").filter({ has: page.getByRole("term").getByText(term) });
  const total = eventTotals("a", "after").might - eventTotals("a", "before").might;
  const { joined, left } = memberChange("a");
  await sees(line("Total"), `${MINUS}${big(total)}`);
  await sees(line("Came in with 1 who joined"), `+${big(joined)}`);
  await sees(line("Went with 1 who left"), `${MINUS}${big(left)}`);
  await sees(line("Without them"), `${MINUS}${big(total - joined + left)}`);
  // Escape closes it again.
  await page.keyboard.press("Escape");
  await expect(split).toBeHidden();
  await noErrorOrEmpty(page);
  expect(await sideways(page)).toBe(false);
});

test("an event with a KvK opponent shows both servers at the Start and from Start to End (D152)", async ({
  page,
}) => {
  await page.goto("/events/2");
  const section = page.getByRole("region", { name: "KvK matchup" });
  await expect(section.getByRole("heading", { level: 2, name: "KvK matchup" })).toBeVisible();
  // Both sides read 2 alliances, so each compares its top 2.
  await sees(section, `Server 325 vs server ${OPPONENT.server} · top 2 alliances each`);
  const sum = (rows: readonly (readonly [number, number])[], i: 0 | 1) =>
    rows.reduce((t, r) => t + r[i], 0);
  const start = OPPONENT.alliances.flatMap((a) => a.start);
  const end = OPPONENT.alliances.flatMap((a) => a.end);
  const ours = eventTotals("a", "before").might + eventTotals("b", "before").might;
  const mightChange = `${MINUS}${big(sum(start, 0) - sum(end, 0))}`;
  const killsGained = `+${big(sum(end, 1) - sum(start, 1))}`;
  if ((page.viewportSize()?.width ?? 0) < 640) {
    // Below 640 px each part is one table: a row per measure, ours then theirs side by side (D158).
    const table = (name: string) => section.getByRole("table", { name, exact: true });
    const row = (name: string, measure: string) =>
      table(name)
        .getByRole("row")
        .filter({ has: page.getByRole("rowheader", { name: measure, exact: true }) });
    await sees(table("KvK matchup"), `Server ${OPPONENT.server}`);
    await sees(table("KvK matchup"), "2 of 2 alliances read");
    await sees(row("KvK matchup", "Might"), `Might ${big(ours)} ${big(sum(start, 0))}`);
    await sees(row("KvK matchup", "Kills"), big(sum(start, 1)));
    await sees(row("KvK matchup", "Members with 60M+ might"), "1 of 4");
    await sees(table("Start to End"), "2 of 2 alliances counted");
    await sees(row("Start to End", "Might change"), mightChange);
    await sees(row("Start to End", "Kills gained"), killsGained);
  } else {
    const card = (name: string) => section.getByRole("group", { name, exact: true });
    const theirStart = card(`Server ${OPPONENT.server}`);
    await sees(theirStart, `Might ${big(sum(start, 0))}`);
    await sees(theirStart, `Kills ${big(sum(start, 1))}`);
    await sees(theirStart, "2 of 2 alliances read");
    await sees(theirStart, "Members with 60M+ might 1 of 4");
    await sees(card("Server 325"), `Might ${big(ours)}`);
    const theirChange = card(`Server ${OPPONENT.server} · Start to End`);
    await sees(theirChange, "2 of 2 alliances counted");
    await sees(theirChange, `Might change ${mightChange}`);
    await sees(theirChange, `Kills gained ${killsGained}`);
  }
  await noErrorOrEmpty(page);
  expect(await sideways(page)).toBe(false);
});

test("tapping a ledger row's joined count opens the alliance's member list with exactly those members", async ({
  page,
}) => {
  await page.goto("/events/2");
  const joined = changedAtLastEvent("a", "joined");
  await ledgerRow(page, A)
    .getByRole("link", { name: `+${joined.length} joined`, exact: true })
    .click();
  await expect(page).toHaveURL(/\/events\/2\/alliances\/\d+\?show=joined#members$/);
  await expect(page.getByRole("heading", { level: 1, name: `[${A.tag}] ${A.name}` })).toBeVisible();
  const list = page.getByRole("region", { name: "Members" });
  await expect(list.getByRole("button", { name: `Joined (${joined.length})` })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await sees(list, `${joined.length} shown`);
  await expect(list.getByRole("listitem")).toHaveCount(joined.length);
  for (const name of joined) {
    await expect(list.getByRole("link", { name, exact: true })).toBeVisible();
  }
  // Tapping the chip again shows everyone (both rosters together: every seeded name), and the address drops
  // the filter.
  await list.getByRole("button", { name: `Joined (${joined.length})` }).click();
  await expect(page).toHaveURL(/\/events\/2\/alliances\/\d+#members$/);
  await expect(list.getByRole("listitem")).toHaveCount(A.names.length);
  await noErrorOrEmpty(page);
  expect(await sideways(page)).toBe(false);
});

test("the alliance page's split opens Joined again after the list went back to All", async ({
  page,
}) => {
  await page.goto(`/events/2/alliances/${A.unionId}`);
  const joined = changedAtLastEvent("a", "joined");
  const list = page.getByRole("region", { name: "Members" });
  const chip = list.getByRole("button", { name: `Joined (${joined.length})` });
  const split = page.locator("details", {
    hasText: "Includes member changes: show the split, Might",
  });
  // The split's "Came in with" line links to this same page, so the list is not remounted by it.
  const openJoined = async () => {
    await hydrated(split);
    await split.locator("summary").click();
    await split.getByRole("link", { name: `Came in with ${joined.length} who joined` }).click();
    await expect(page).toHaveURL(/\?show=joined#members$/);
    await expect(chip).toHaveAttribute("aria-pressed", "true");
    await expect(list.getByRole("listitem")).toHaveCount(joined.length);
  };
  await openJoined();
  await chip.click();
  await expect(list.getByRole("listitem")).toHaveCount(A.names.length);
  await openJoined();
  for (const name of joined) {
    await expect(list.getByRole("link", { name, exact: true })).toBeVisible();
  }
  await noErrorOrEmpty(page);
});
