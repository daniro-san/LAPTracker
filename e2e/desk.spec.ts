// The Officers' Desk for Lantern Keep's officer (issue 477): Home, Members (a card opens and stays closed once
// closed, #573), a roll call mark that is kept, and Raid prep's "To mark", which counts the Shield mark only
// (#590 F1). Expected figures are computed from the seed's rows (e2e/fixtures/seed.ts) and written with the
// pages' formatter (`big`); none depends on the day the suite runs, except the dates, which follow it.
import type { Page } from "@playwright/test";

import {
  ALLIANCES,
  calendarOf,
  cheeseOf,
  DAILY,
  daysAgo,
  JOINER,
  KVK_ENTRY,
  LEAVER,
  lastRosterDay,
  raidOf,
  rosterOf,
  seededAt,
  SENTINELS,
  usDay,
  SHIELD_MARKED,
  WALL_ONLY,
  weekLine,
} from "./fixtures/seed";
import { big, deskFrame, expect, hydrated, sees, signIn, test } from "./fixtures/test";

const A = ALLIANCES.a;
const desk = `/w/${A.slug}`;
/** Lantern Keep's roster today: the leaver is gone. */
const ROSTER = A.names.length - 1;
/** Each project marks its own member (and its own roll call, cheeseOf). */
const MARKED_BY = { phone: A.names[6], wide: A.names[7], iphone: A.names[8] } as Record<
  string,
  string
>;
/** A label that starts with `prefix` and a name, the name inside Unicode isolates (isolate(), <bdi>). */
const labelled = (prefix: string, name: string) => new RegExp(`^${prefix}\\u2068?${name}\\u2069?`);
const cal = calendarOf(seededAt());

test.beforeEach(async ({ context }) => {
  await signIn(context, "a", "officer");
});

/** A tap on `target` that saves (POST /api/w/<slug>/roll-call), waited for before the page is left. */
async function tapAndSave(page: Page, target: import("@playwright/test").Locator) {
  const saved = page.waitForResponse((r) => r.url().endsWith(`/api/w/${A.slug}/roll-call`));
  await hydrated(target);
  await target.click();
  await (await saved).finished();
}

test("Home shows the alliance, its activity and its week line", async ({ page }) => {
  await page.goto(desk);
  await expect(page.getByRole("heading", { level: 1, name: "Home" })).toBeVisible();
  await deskFrame(page, A);
  // Recent activity: other tests' roll call marks land here too, so only what none of them changes is
  // checked: the feed lists the officer's own actions (the seed's and the tests' writer is that officer).
  const activity = page.getByRole("region", { name: "Recent activity" }).first();
  await expect(activity.getByRole("listitem").first()).toBeVisible();
  await sees(activity.getByRole("listitem").first(), "Officer LNK");
  // D146: every member at the coin cap yesterday, the median quest points, the week's donations.
  const w = weekLine(seededAt());
  const week = page.getByRole("region", { name: "Members this week" }).first();
  await sees(
    week,
    `Alliance Help: ${w.members} of ${w.members} reached 1,000 yesterday · daily quest points yesterday, median ${DAILY.active} · donations ${w.week} ${big(w.donations)}`,
  );
  await expect(week.getByRole("heading", { name: "Top donors" })).toBeVisible();
  await expect(week.getByRole("listitem").filter({ hasText: A.names[0] as string })).toBeVisible();
  // D114: on Sunday and Monday (server days), while the week is not thanked yet (the seed shares none), the
  // thanks nudge takes the place of "Everyone looks fine"; on the other days that line shows.
  const thanksDay = [0, 1].includes(new Date(cal.today).getUTCDay());
  if (thanksDay) {
    await sees(week, "Time for the weekly appreciation post");
    await expect(week.getByText("Everyone looks fine this week.")).toHaveCount(0);
  } else {
    await sees(week, "Everyone looks fine this week.");
  }
});

test("Members: a card opens from the list and stays closed once closed, after a reload too", async ({
  page,
}) => {
  // A clock the test moves on: "a moment after closing" (#573) is then 1.5 s of the page's own time.
  await page.clock.install();
  await page.goto(`${desk}/members`);
  await expect(page.getByRole("heading", { level: 1, name: "Members" })).toBeVisible();
  await deskFrame(page, A);
  await sees(page.locator("main"), `${ROSTER} of ${ROSTER} members`);
  const k = 3;
  const name = A.names[k] as string;
  // A member's line: a card in a list below 1024 px, a table row from 1024 px (D122); its name opens the card.
  const lineOf = (n: string) =>
    page
      .getByRole("listitem")
      .or(page.getByRole("row"))
      .filter({ has: page.getByRole("button", { name: labelled("R\\d ", n) }) });
  const row = page.getByRole("button", { name: labelled("R\\d ", name) }).first();
  const now = rosterOf("a", k);
  await sees(lineOf(name), `R2 ${name}`);
  await sees(lineOf(name), big(now.might));
  // The joiner is marked new since the last event; the leaver is not on the list.
  await sees(
    lineOf(A.names[JOINER] as string),
    `New · first seen ${usDay(cal.events[1] as string)}`,
  );
  await expect(
    page.getByRole("button", { name: labelled("R\\d ", A.names[LEAVER] as string) }),
  ).toHaveCount(0);

  await hydrated(row);
  await row.click();
  // Below 1024 px the card is a sheet (a dialog); from 1024 px a pane beside the list (D122).
  const card =
    (page.viewportSize()?.width ?? 0) < 1024
      ? page.getByRole("dialog", { name })
      : page.locator("main");
  await expect(card.getByRole("heading", { name, level: 2 })).toBeVisible();
  await sees(card, `Might ${big(now.might)}`);
  await sees(card, `Kills ${big(now.kills)}`);
  // Overview: the last 7 days' averages and the might change over them.
  await expect(card.getByRole("tab", { name: "Overview", selected: true })).toBeVisible();
  await expect(card.getByRole("heading", { name: "Last 7 days" })).toBeVisible();
  await sees(card, `Daily quest points Average ${DAILY.active} · 7 days`);
  await sees(card, `Donations Average ${big(DAILY.tech)} · 7 days`);
  await expect(
    card.getByRole("listitem", { name: `${usDay(lastRosterDay())}: ${DAILY.active}` }),
  ).toBeVisible();
  const change = rosterOf("a", k).might - rosterOf("a", k, 7).might;
  await sees(card, `Might +${big(change)} since ${usDay(daysAgo(7))}`);
  // Info: the map position stays hidden until "Show map position" is tapped (D71: the own alliance only).
  const map = `X ${SENTINELS.a.x} · Y ${SENTINELS.a.y}`;
  await card.getByRole("tab", { name: "Info" }).click();
  await expect(card.getByText(map)).toHaveCount(0);
  await card.getByRole("button", { name: "Show map position" }).click();
  await expect(card.getByText(map)).toBeVisible();
  await expect(page).toHaveURL(/[?&]m=\d+/);

  await card.getByRole("button", { name: "Close" }).click();
  await expect(page.getByRole("heading", { name, level: 2 })).toBeHidden();
  // #573: the card used to open again a moment after closing, with "Loading…".
  await page.clock.runFor(1500);
  await expect(page.getByRole("heading", { name, level: 2 })).toBeHidden();
  await expect(page.getByText("Loading…")).toBeHidden();
  await expect(page).not.toHaveURL(/[?&]m=/);
  await expect(row).toBeVisible();
  await page.reload();
  await expect(page.getByRole("heading", { level: 1, name: "Members" })).toBeVisible();
  await sees(page.locator("main"), `${ROSTER} of ${ROSTER} members`);
  await expect(page.getByRole("heading", { name, level: 2 })).toBeHidden();
});

test("Roll call: a mark shows at once, is kept after a reload and in the list, then clears", async ({
  page,
}, info) => {
  const name = MARKED_BY[info.project.name] as string;
  const cheese = cheeseOf(info.project.name, info.repeatEachIndex);
  const title = `Cheese Trap · Lv.${cheese.level}`;
  const summary = (marked: number) =>
    `${marked} of ${ROSTER} marked · Took part ${marked} · Not this time 0 · Not set ${ROSTER - marked}`;
  // The roll call by its own title: the list's order follows the weekday.
  const listed = page
    .getByRole("listitem")
    .filter({ has: page.getByRole("heading", { name: title, exact: true }) });
  const main = page.locator("main");
  const tile = page.getByRole("listitem").filter({ hasText: name });
  const tookPart = tile.getByRole("button", { name: labelled("Took part: ", name) });
  const openAll = async () => {
    const all = page.getByRole("button", { name: `All ${ROSTER}` });
    await hydrated(all);
    await all.click();
  };

  await page.goto(`${desk}/roll-call`);
  await expect(page.getByRole("heading", { level: 1, name: "Roll call" })).toBeVisible();
  await deskFrame(page, A);
  await sees(listed, summary(0));
  await listed.getByRole("link", { name: "Mark ›" }).click();

  await expect(page.getByRole("heading", { level: 1, name: title })).toBeVisible();
  await sees(main, `0 of ${ROSTER} marked`);
  await expect(page.getByRole("button", { name: `To mark ${ROSTER}` })).toBeVisible();
  await sees(tile, "Not set");
  await tapAndSave(page, tookPart);
  // At once: the tile says so, and the counts move (the tile stays where it is until a chip is tapped).
  await sees(tile, "Took part");
  await sees(main, `1 of ${ROSTER} marked`);
  await expect(page.getByRole("button", { name: "Took part: 1" })).toBeVisible();
  await expect(page.getByRole("button", { name: `To mark ${ROSTER - 1}` })).toBeVisible();

  await page.reload();
  await expect(page.getByRole("heading", { level: 1, name: title })).toBeVisible();
  await sees(main, `1 of ${ROSTER} marked`);
  await expect(page.getByRole("button", { name: `To mark ${ROSTER - 1}` })).toBeVisible();
  await openAll();
  await sees(tile, "Took part");
  await page.goto(`${desk}/roll-call`);
  await sees(listed, summary(1));

  // A second tap clears it again, on screen, after a reload and in the list.
  await listed.getByRole("link", { name: "Mark ›" }).click();
  await openAll();
  await tapAndSave(page, tookPart);
  await sees(tile, "Not set");
  await sees(main, `0 of ${ROSTER} marked`);
  await page.reload();
  await sees(main, `0 of ${ROSTER} marked`);
  await expect(page.getByRole("button", { name: `To mark ${ROSTER}` })).toBeVisible();
  await page.goto(`${desk}/roll-call`);
  await sees(listed, summary(0));
});

/** Raid prep of `week`, with its seeded marks: 4 Shield marks, 2 members with a wall mark only. */
async function seededRaidPrep(page: Page, week: string) {
  await page.goto(`${desk}/roll-call/mark?entry=${KVK_ENTRY}&week=${week}`);
  await expect(page.getByRole("heading", { level: 1, name: "Raid prep" })).toBeVisible();
  await deskFrame(page, A);
}

test("Raid prep: To mark counts the members with no Shield mark", async ({ page }) => {
  await seededRaidPrep(page, cal.raid.week);
  // Two members have a squads-off-the-wall mark and no Shield mark: they are still to mark (#590 F1).
  const toMark = ROSTER - SHIELD_MARKED.length;
  await expect(page.getByRole("button", { name: `To mark ${toMark}` })).toBeVisible();
  await expect(page.getByRole("button", { name: `All ${ROSTER}` })).toBeVisible();
  await sees(page.locator("main"), `${SHIELD_MARKED.length} of ${ROSTER} marked`);
  // Under "To mark": the two wall-only members, with no Shield mark yet; the four marked are folded away.
  for (const k of WALL_ONLY) {
    const name = A.names[k] as string;
    const tile = page.getByRole("listitem").filter({ hasText: name }).first();
    await sees(tile, "Not set");
    await expect(
      tile.getByRole("button", { name: labelled("Off the wall: ", name) }),
    ).toHaveAttribute("aria-pressed", "true");
  }
  for (const k of SHIELD_MARKED) {
    await expect(page.getByRole("listitem").filter({ hasText: A.names[k] as string })).toHaveCount(
      0,
    );
  }
  await expect(
    page.getByRole("button", { name: `Marked (${SHIELD_MARKED.length})` }),
  ).toBeVisible();
});

test("Raid prep: a Shield mark moves To mark at once and is kept after a reload", async ({
  page,
}, info) => {
  // Phone only, on a later week of its own per repeat (raidOf): the counts are that roll call's alone.
  test.skip(info.project.name !== "phone", "one project marks Raid prep");
  const { week } = raidOf(seededAt(), info.repeatEachIndex);
  const name = A.names[WALL_ONLY[0] as number] as string;
  const marked = SHIELD_MARKED.length;
  const shieldUp = page.getByRole("button", { name: labelled("Shield up: ", name) });
  const main = page.locator("main");
  await seededRaidPrep(page, week);
  await expect(page.getByRole("button", { name: `To mark ${ROSTER - marked}` })).toBeVisible();
  await tapAndSave(page, shieldUp);
  await expect(page.getByRole("button", { name: `To mark ${ROSTER - marked - 1}` })).toBeVisible();
  await sees(main, `${marked + 1} of ${ROSTER} marked`);
  await page.reload();
  await expect(page.getByRole("button", { name: `To mark ${ROSTER - marked - 1}` })).toBeVisible();
  await sees(main, `${marked + 1} of ${ROSTER} marked`);
  // Tapped again, the mark clears, and stays cleared after a reload.
  const all = page.getByRole("button", { name: `All ${ROSTER}` });
  await hydrated(all);
  await all.click();
  await tapAndSave(page, shieldUp);
  await sees(main, `${marked} of ${ROSTER} marked`);
  await page.reload();
  await expect(page.getByRole("button", { name: `To mark ${ROSTER - marked}` })).toBeVisible();
  await sees(main, `${marked} of ${ROSTER} marked`);
});
