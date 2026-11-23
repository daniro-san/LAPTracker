// Insights' Time zones card (owner, 2026-11-22) on Lantern Keep's seed. ZONE_FACTS records time zones with no
// summer time for some members, so the offsets and the reset's times hold on any seed date. The card says the
// largest group and its reset without a tap. Its rows (west to east), the members with none recorded and the
// hours most are within their usual hours sit behind the fold. "Add their time zone ›" opens Members
// filtered on Missing info: time zone. Read-only. Every expected value is computed from the seed below, with
// Intl as the clock, apart from the app's own code.
import type { Page } from "@playwright/test";

import { compactLarge } from "../lib/compact";
import {
  ALLIANCES,
  calendarOf,
  changedAtLastEvent,
  DAY_MS,
  eventTotals,
  IDLE_UIDS,
  JOINER,
  LEAVER,
  memberChange,
  newMembers,
  lastRosterDay,
  rosterOf,
  seededAt,
  shown,
  uidOf,
  usDay,
  ZONE_FACTS,
} from "./fixtures/seed";
import { deskFrame, expect, hydrated, sees, signIn, test } from "./fixtures/test";

const A = ALLIANCES.a;
const desk = `/w/${A.slug}`;
const HOUR_MS = 3_600_000;
/** The server's clock: UTC−2 (e2e/env.ts SERVER_TZ). */
const ST_MS = -2 * HOUR_MS;

/** A Members line: a button whose name starts with the rank and the member's name (in isolates). */
const memberLine = (page: Page, name: string) =>
  page.getByRole("button", { name: new RegExp(`^R\\d \\u2068?${name}\\u2069?`) });

const parts = (zone: string, at: number) =>
  Object.fromEntries(
    new Intl.DateTimeFormat("en-US", {
      timeZone: zone,
      hourCycle: "h23",
      weekday: "short",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      timeZoneName: "longOffset",
    })
      .formatToParts(at)
      .map((p) => [p.type, p.value]),
  );

/** "GMT+05:30" → 330 minutes; "GMT" → 0. */
const minutesOf = (gmt: string) => {
  const m = /([+-])(\d\d):(\d\d)/.exec(gmt);
  return m ? (m[1] === "-" ? -1 : 1) * (Number(m[2]) * 60 + Number(m[3])) : 0;
};
/** 330 → "UTC+5:30", −180 → "UTC−3", the offset as the desk writes it. */
const offsetText = (min: number) =>
  `UTC${min < 0 ? "−" : "+"}${Math.floor(Math.abs(min) / 60)}${Math.abs(min) % 60 ? `:${String(Math.abs(min) % 60).padStart(2, "0")}` : ""}`;
const cityOf = (zone: string) => (zone.split("/").at(-1) as string).replaceAll("_", " ");
const hh = (h: number) => String(h).padStart(2, "0");

/** What the card should say for the seed: its groups west to east, and the members in their usual hours. */
function expected() {
  const { today } = calendarOf(seededAt());
  const members = A.names.filter((_, k) => k !== LEAVER).length;
  const zones = Object.values(ZONE_FACTS);
  const reset = today + DAY_MS - ST_MS; // the next 00:00 ST
  const resetDay = new Date(today + DAY_MS).toISOString().slice(0, 10);
  const byOffset = new Map<number, string[]>();
  for (const zone of zones) {
    const offset = minutesOf(parts(zone, reset).timeZoneName as string);
    byOffset.set(offset, [...(byOffset.get(offset) ?? []), zone]);
  }
  const groups = [...byOffset]
    .sort(([a], [b]) => a - b)
    .map(([offset, list]) => {
      const count = (z: string) => list.filter((x) => x === z).length;
      const cities = [...new Set(list)]
        .sort((a, b) => count(b) - count(a) || cityOf(a).localeCompare(cityOf(b)))
        .map(cityOf)
        .join(", ");
      const p = parts(list[0] as string, reset);
      const time = `${p.hour}:${p.minute}`;
      return {
        label: `${cities} · ${offsetText(offset)}`,
        named: `${cities} (${offsetText(offset)})`,
        n: list.length,
        reset: `${p.year}-${p.month}-${p.day}` === resetDay ? time : `${p.weekday} ${time}`,
      };
    });
  // Members with a zone whose own clock is in 08:00–22:59, at each server hour of today.
  const byHour = Array.from(
    { length: 24 },
    (_, h) =>
      zones.filter((zone) => {
        const hour = Number(parts(zone, today + h * HOUR_MS - ST_MS).hour);
        return hour >= 8 && hour < 23;
      }).length,
  );
  const top = Math.max(...byHour);
  const runs: { from: number; to: number }[] = [];
  byHour.forEach((n, h) => {
    if (n !== top) return;
    const last = runs.at(-1);
    if (last && last.to === h - 1) last.to = h;
    else runs.push({ from: h, to: h });
  });
  const [first, final] = [runs[0], runs.at(-1)];
  if (runs.length > 1 && first?.from === 0 && final?.to === 23) {
    runs.pop();
    runs[0] = { from: final.from, to: first.to };
  }
  const hours = runs.sort((a, b) => a.from - b.from).map((r) => `${hh(r.from)}:00–${hh(r.to)}:59`);
  return {
    members,
    known: zones.length,
    groups,
    top,
    hours: new Intl.ListFormat("en", { type: "conjunction" }).format(hours),
  };
}

test.beforeEach(async ({ context }) => {
  await signIn(context, "a", "officer");
});

test("Time zones: the largest group and its reset, the groups west to east, and the members to ask", async ({
  page,
}) => {
  const e = expected();
  const largest = e.groups.reduce((a, b) => (b.n > a.n ? b : a));
  await page.goto(`${desk}/insights`);
  await expect(page.getByRole("heading", { level: 1, name: "Insights" })).toBeVisible();
  await deskFrame(page, A);
  const card = page.getByRole("region", { name: "Time zones" });
  await sees(
    card,
    `Largest group: ${largest.named}, ${largest.n} of the ${e.known} members with a time zone. The 00:00 ST reset is ${largest.reset} for them.`,
  );
  await sees(
    card,
    `Time zone recorded for ${e.known} of the ${e.members} members in the newest daily update.`,
  );
  // The last card (only the margin's "How this page counts" comes after it), its rows behind the fold.
  const heads = await page.getByRole("main").getByRole("heading", { level: 2 }).allTextContents();
  expect(heads.slice(heads.indexOf("Time zones") + 1)).toEqual(["How this page counts"]);
  await expect(card.getByText("Not recorded yet")).toBeHidden();

  await card.getByText("Show the details").click();
  const rows = card.getByRole("listitem");
  await expect(rows).toHaveCount(e.groups.length + 1);
  for (const [i, g] of e.groups.entries()) {
    await sees(rows.nth(i), g.label);
    await sees(rows.nth(i), `Reset ${g.reset}`);
  }
  const missing = rows.nth(e.groups.length);
  await expect(missing).toContainText(new RegExp(`Not recorded yet\\s*${e.members - e.known}`));
  await sees(missing, "Not counted in any group.");
  await sees(
    card,
    `Within their usual hours for the most: ${e.hours} ST, ${e.top} of the ${e.known} members with a time zone (${e.members - e.known} not recorded).`,
  );

  const add = card.getByRole("link", { name: "Add their time zone ›" });
  expect((await add.boundingBox())?.height).toBeGreaterThanOrEqual(44);
  await add.click();
  await expect(page).toHaveURL(`${desk}/members?ask=timeZone`);
  await expect(page.getByRole("heading", { level: 1, name: "Members" })).toBeVisible();
  const withZone = Number(Object.keys(ZONE_FACTS)[0]);
  const without = A.names.findIndex((_, k) => k !== LEAVER && !(k in ZONE_FACTS));
  await expect(memberLine(page, A.names[without] as string)).toBeVisible();
  await expect(memberLine(page, A.names[withZone] as string)).toHaveCount(0);
});

/**
 * Lantern Keep's effort groups on the seed (D139): the newest daily update's members, the new one left out,
 * by might in four equal groups, the highest first. No member is on a break in the seed.
 */
function effortGroups() {
  const compared = A.names.flatMap((name, k) =>
    k === LEAVER || newMembers("a").includes(name)
      ? []
      : [{ k, name, might: rosterOf("a", k).might }],
  );
  const s = [...compared].sort((a, b) => a.might - b.might);
  return [0, 1, 2, 3]
    .map((i) => s.slice(Math.floor((i * s.length) / 4), Math.floor(((i + 1) * s.length) / 4)))
    .reverse();
}

test("Insights: a might group opens exactly its members, each to their card, and Back keeps it open (#678)", async ({
  page,
}) => {
  const top = effortGroups()[0] ?? [];
  const [low, high] = [top[0], top.at(-1)];
  if (!low || !high) throw new Error("the seed makes no effort groups");
  const label = `Might ${compactLarge(low.might, "en")} – ${compactLarge(high.might, "en")}`;
  const count = `${top.length} members`;
  const names = top.map((m) => m.name).sort((a, b) => a.localeCompare(b, "en"));
  await page.goto(`${desk}/insights`);
  await expect(page.getByRole("heading", { level: 1, name: "Insights" })).toBeVisible();
  await deskFrame(page, A);
  const effort = page.getByRole("region", { name: "Effort at every might level" });
  await sees(effort, "Who is in each group");
  await sees(effort, "Tap a count to see who.");
  // The group's row is the tap target; its names are closed until it is tapped.
  const row = effort.locator("summary").filter({ hasText: label });
  await sees(row, count);
  expect((await row.boundingBox())?.height).toBeGreaterThanOrEqual(44);
  const list = effort.getByRole("list", { name: `${label}: ${count}` });
  await expect(list).toBeHidden();
  await row.click();
  await expect(list).toBeVisible();
  // Exactly the group's members, in name order, with nothing beside a name.
  await expect(list.getByRole("link")).toHaveText(names);
  const pick = top.find((m) => m.name === names[0]) as (typeof top)[number];
  const link = list.getByRole("link", { name: pick.name });
  expect((await link.boundingBox())?.height).toBeGreaterThanOrEqual(44);
  const uid = uidOf("a", pick.k);
  // The card's own read, finished before going Back, so the leak guard can read its answer.
  const details = page.waitForResponse((r) => r.url().endsWith(`/api/w/${A.slug}/members/${uid}`));
  await link.click();
  await expect(page).toHaveURL(`${desk}/members?m=${uid}`);
  await expect(page.getByRole("heading", { level: 1, name: "Members" })).toBeVisible();
  const phone = (page.viewportSize()?.width ?? 0) < 1024;
  const card = phone ? page.getByRole("dialog", { name: pick.name }) : page.locator("main");
  await expect(card.getByRole("heading", { name: pick.name, level: 2 })).toBeVisible();
  await (await details).finished();

  // Back on Insights, the group is still open with the same names. On a phone the card is a sheet, and
  // Back closes it first, as anywhere on Members (D122).
  if (phone) {
    await page.goBack();
    await expect(card).toBeHidden();
    await expect(page.getByRole("heading", { level: 1, name: "Members" })).toBeVisible();
  }
  await page.goBack();
  await expect(page.getByRole("heading", { level: 1, name: "Insights" })).toBeVisible();
  await expect(list).toBeVisible();
  await expect(list.getByRole("link")).toHaveText(names);
});

test("Insights: a group's names end with “Open these n in Members ›”, which shows exactly them under one chip (D158)", async ({
  page,
}) => {
  const top = effortGroups()[0] ?? [];
  const [low, high] = [top[0], top.at(-1)];
  if (!low || !high) throw new Error("the seed makes no effort groups");
  const label = `Might ${compactLarge(low.might, "en")} – ${compactLarge(high.might, "en")}`;
  const title = `${label}: ${top.length} members`;
  const names = top.map((m) => m.name).sort((a, b) => a.localeCompare(b, "en"));
  const others = A.names.filter((n, k) => k !== LEAVER && !names.includes(n));
  await page.goto(`${desk}/insights`);
  await expect(page.getByRole("heading", { level: 1, name: "Insights" })).toBeVisible();
  await deskFrame(page, A);
  const effort = page.getByRole("region", { name: "Effort at every might level" });
  // Up to 12 names open in place, right under the tapped row, the onward link after them.
  await effort.locator("summary").filter({ hasText: label }).click();
  await expect(effort.getByRole("list", { name: title }).getByRole("link")).toHaveText(names);
  const onward = effort.getByRole("link", { name: `Open these ${top.length} in Members ›` });
  expect((await onward.boundingBox())?.height).toBeGreaterThanOrEqual(44);
  const arrived = page.waitForResponse((r) =>
    r.url().endsWith("/members?set=effort_range:range-0"),
  );
  await onward.click();
  await expect(page).toHaveURL(`${desk}/members?set=effort_range:range-0`);
  await expect(page.getByRole("heading", { level: 1, name: "Members" })).toBeVisible();
  // One chip names the set with the chart's own sentence; the list holds exactly its members.
  const chip = page.locator("#members-set");
  await sees(chip, "From Insights");
  await sees(chip, title);
  for (const name of names) await expect(memberLine(page, name)).toHaveCount(1);
  for (const name of others) await expect(memberLine(page, name)).toHaveCount(0);
  // A reload builds the same set again on the server; the page's own answer is read first, for the leak guard.
  await (await arrived).finished();
  await page.reload();
  await sees(page.locator("#members-set"), title);
  for (const name of others) await expect(memberLine(page, name)).toHaveCount(0);
  // Its × gives the whole list back and takes the set off the address.
  const clear = page.getByRole("button", { name: "Show every member" });
  expect((await clear.boundingBox())?.height).toBeGreaterThanOrEqual(44);
  await clear.click();
  await expect(page.locator("#members-set")).toHaveCount(0);
  // The chip went with its ×: the focus is on the search, not lost to the page.
  await expect(page.getByRole("searchbox", { name: "Search members" })).toBeFocused();
  await expect(memberLine(page, others[0] as string)).toHaveCount(1);
  await expect(page).toHaveURL(`${desk}/members`);
});

test("Members `?set=` with a key no Insights count has shows the whole list with no chip", async ({
  page,
}) => {
  await page.goto(`${desk}/members?set=effort_range:range-9`);
  await expect(page.getByRole("heading", { level: 1, name: "Members" })).toBeVisible();
  await deskFrame(page, A);
  await expect(page.locator("#members-set")).toHaveCount(0);
  await expect(memberLine(page, A.names[0] as string)).toHaveCount(1);
});

/** The Monday of the game week (Monday to Sunday) that holds `day`. */
const mondayOf = (day: string) => {
  const at = Date.parse(day);
  return new Date(at - ((new Date(at).getUTCDay() + 6) % 7) * DAY_MS).toISOString().slice(0, 10);
};
/** "Week of Nov 9", as a week row and the path name it. */
const weekOf = (monday: string) =>
  `Week of ${shown(monday, "en-US", { month: "short", day: "numeric" })}`;
const scrollOf = (page: Page) => page.evaluate(() => window.scrollY);
/** The window has not moved: the card stays where it was (Back keeps the scroll position). */
const stays = (page: Page, y: number) =>
  expect.poll(async () => Math.abs((await scrollOf(page)) - y)).toBeLessThanOrEqual(2);

test("Insights: a week of the pulse opens its days in the card, which add up to the week, and Back keeps the place (D158 rule 7 (b))", async ({
  page,
}) => {
  // Last week: every day of it has a daily update, with the roster's 11 members, all at the coin cap.
  const monday = new Date(Date.parse(mondayOf(lastRosterDay())) - 7 * DAY_MS)
    .toISOString()
    .slice(0, 10);
  const memberDays = (A.names.length - 1) * 7;
  await page.goto(`${desk}/insights`);
  await expect(page.getByRole("heading", { level: 1, name: "Insights" })).toBeVisible();
  await deskFrame(page, A);
  const card = page.getByRole("region", { name: "The week’s pulse" });
  // One row per metric names the week; each opens the same days.
  const rows = card.getByRole("link", { name: new RegExp(`^${weekOf(monday)} `) });
  await expect(rows).toHaveCount(3);
  const coins = rows.nth(1);
  await hydrated(coins);
  expect((await coins.boundingBox())?.height).toBeGreaterThanOrEqual(44);
  await coins.scrollIntoViewIfNeeded();
  const y = await scrollOf(page);
  await coins.click();
  await expect(page).toHaveURL(`${desk}/insights?pulse=${monday}#insights-pulse`);
  const path = card.getByRole("navigation", { name: "Where you are in this chart" });
  await sees(path, "The week’s pulse");
  await sees(path, weekOf(monday));
  // The week rows gave way to the week's seven days; the coin cap's days add up to its week.
  await expect(card.getByText("Week by week")).toHaveCount(0);
  await sees(
    card,
    `${weekOf(monday)}: ${memberDays} of ${memberDays} member-days (each daily update counts each member once). Its days add up to this.`,
  );
  // Under each day's share, the count it is of: all 11 members at the cap, every day.
  const perDay = `${A.names.length - 1}/${A.names.length - 1}`;
  const coinsDays = card
    .getByRole("heading", { level: 3, name: "At the 1,000 coin cap" })
    .locator("xpath=..");
  await expect(coinsDays.getByText(perDay, { exact: true })).toHaveCount(7);
  await stays(page, y);
  const back = path.getByRole("link", { name: "All weeks" });
  expect((await back.boundingBox())?.height).toBeGreaterThanOrEqual(44);
  await back.click();
  await expect(page).toHaveURL(`${desk}/insights#insights-pulse`);
  await expect(path).toHaveCount(0);
  await expect(rows).toHaveCount(3);
  await stays(page, y);
  // The address keeps the level: a link to it opens the days.
  await page.goto(`${desk}/insights?pulse=${monday}`);
  await sees(
    page.getByRole("region", { name: "The week’s pulse" }),
    `${memberDays} of ${memberDays}`,
  );
});

test("Insights: the week someone joined and left opens its days, which add up to the week, and Back keeps the place (D158 rule 7 (b))", async ({
  page,
}) => {
  // The joiner and the leaver changed places at the last event: its day's read is the first to show it.
  const day = calendarOf(seededAt()).events[1] as string;
  const monday = mondayOf(day);
  await page.goto(`${desk}/insights`);
  await expect(page.getByRole("heading", { level: 1, name: "Insights" })).toBeVisible();
  await deskFrame(page, A);
  const card = page.getByRole("region", { name: "Membership flow" });
  const open = card.getByRole("link", { name: `${weekOf(monday)}, day by day ›` });
  await hydrated(open);
  expect((await open.boundingBox())?.height).toBeGreaterThanOrEqual(44);
  await open.scrollIntoViewIfNeeded();
  const y = await scrollOf(page);
  await open.click();
  await expect(page).toHaveURL(`${desk}/insights?flow=${monday}#insights-flow`);
  const path = card.getByRole("navigation", { name: "Where you are in this chart" });
  await sees(path, "Membership flow");
  await sees(path, weekOf(monday));
  const changed = card.getByRole("listitem").filter({ hasText: usDay(day) });
  await sees(changed, "+1");
  await sees(changed, "−1");
  await sees(card, `${weekOf(monday)}: 1 joined, 1 left. Its days add up to this.`);
  await sees(card, "Joined and left, day by day");
  await expect(card.getByRole("link", { name: /day by day/ })).toHaveCount(0);
  await stays(page, y);
  await path.getByRole("link", { name: "All weeks" }).click();
  await expect(page).toHaveURL(`${desk}/insights#insights-flow`);
  await expect(path).toHaveCount(0);
  await expect(open).toBeVisible();
  await stays(page, y);
});

// One level further (issue 752): a day of the flow, of the pulse and of a KvK's recovery.

test("Insights: a day someone joined and left opens where they came from and went, which add up to the day, and Back keeps the week (D158 rule 7 (b))", async ({
  page,
}) => {
  // The joiner and the leaver changed places at the last event; nobody saw them in another alliance.
  const day = calendarOf(seededAt()).events[1] as string;
  const monday = mondayOf(day);
  await page.goto(`${desk}/insights?flow=${monday}`);
  await deskFrame(page, A);
  const card = page.getByRole("region", { name: "Membership flow" });
  const open = card.getByRole("link", { name: new RegExp(`^${usDay(day)}`) });
  await hydrated(open);
  expect((await open.boundingBox())?.height).toBeGreaterThanOrEqual(44);
  await open.scrollIntoViewIfNeeded();
  const y = await scrollOf(page);
  await open.click();
  await expect(page).toHaveURL(`${desk}/insights?flow=${monday}&flowDay=${day}#insights-flow`);
  const path = card.getByRole("navigation", { name: "Where you are in this chart" });
  await sees(path, "Membership flow");
  await sees(path, weekOf(monday));
  await sees(path, usDay(day));
  // The day's places: one newcomer and one leaver, neither seen elsewhere; counts only, no names (D75).
  for (const head of ["Where newcomers came from", "Where leavers went"]) {
    const rows = card
      .getByRole("heading", { level: 3, name: head })
      .locator("xpath=following-sibling::ul[1]");
    await expect(rows.getByRole("listitem")).toHaveCount(1);
    await expect(rows).toContainText(/Not known\s*1/);
  }
  await sees(card, `${usDay(day)}: 1 joined, 1 left. The places below add up to this.`);
  for (const name of [...changedAtLastEvent("a", "joined"), ...changedAtLastEvent("a", "left")])
    await expect(card.getByText(name)).toHaveCount(0);
  // The window's own places give way to the day's: one "Where newcomers came from" on the card.
  await expect(card.getByRole("heading", { name: "Where newcomers came from" })).toHaveCount(1);
  await stays(page, y);
  const back = path.getByRole("link", { name: weekOf(monday) }).first();
  expect((await back.boundingBox())?.height).toBeGreaterThanOrEqual(44);
  await back.click();
  await expect(page).toHaveURL(`${desk}/insights?flow=${monday}#insights-flow`);
  await expect(open).toBeVisible();
  await stays(page, y);
});

test("Insights: a day of the pulse opens who did each, in name order, and only them (D158 rule 7 (c))", async ({
  page,
  context,
}) => {
  // Moss Hollow: on the newest daily update its IDLE members sent no quest points and no donation.
  await signIn(context, "b", "officer");
  const B = ALLIANCES.b;
  const day = lastRosterDay();
  const did = B.names.filter((_, k) => !IDLE_UIDS.has(uidOf("b", k)));
  const idle = B.names.filter((_, k) => IDLE_UIDS.has(uidOf("b", k)));
  await page.goto(`/w/${B.slug}/insights`);
  await deskFrame(page, B);
  const card = page.getByRole("region", { name: "The week’s pulse" });
  const pick = card.getByRole("link", { name: usDay(day) });
  await hydrated(pick);
  const box = await pick.boundingBox();
  expect(Math.min(box?.width ?? 0, box?.height ?? 0)).toBeGreaterThanOrEqual(44);
  await pick.scrollIntoViewIfNeeded();
  const y = await scrollOf(page);
  await pick.click();
  await expect(page).toHaveURL(`/w/${B.slug}/insights?pulseDay=${day}#insights-pulse`);
  const path = card.getByRole("navigation", { name: "Where you are in this chart" });
  await sees(path, "The week’s pulse");
  await sees(path, usDay(day));
  await stays(page, y);
  // Each count is the day's: who did it out of the daily update's members. A tap names exactly them.
  const of = B.names.length;
  for (const [label, names] of [
    ["Earned daily quest points", did],
    ["At the 1,000 coin cap", B.names],
    ["Donated", did],
  ] as const) {
    const row = card.locator("summary").filter({ hasText: label });
    await sees(row, `${names.length} of ${of} members`);
    await row.click();
    const list = card.getByRole("list", {
      name: `${label} · ${usDay(day)}: ${names.length} members`,
    });
    await expect(list.getByRole("link")).toHaveText([...names].sort((a, b) => a.localeCompare(b)));
  }
  for (const name of idle)
    await expect(card.getByRole("list", { name: /^Donated/ }).getByText(name)).toHaveCount(0);
  await expect(card.getByText("Open these", { exact: false })).toHaveCount(0);
  // Back gives this week's columns again.
  await path.getByRole("link", { name: "This week" }).first().click();
  await expect(page).toHaveURL(`/w/${B.slug}/insights#insights-pulse`);
  await expect(path).toHaveCount(0);
  await expect(pick).toBeVisible();
});

test("Insights: a KvK recovery day opens its numbers, the share its column shows, and Back gives that KvK's days (D158 rule 7 (b))", async ({
  page,
}) => {
  const { events, today } = calendarOf(seededAt());
  const kvk = events[1] as string;
  const day = new Date(Date.parse(kvk) + DAY_MS).toISOString().slice(0, 10);
  await page.goto(`${desk}/insights`);
  await deskFrame(page, A);
  const card = page.getByRole("region", { name: "KvK cost and recovery" });
  await card.getByText("Show the details").first().click();
  const pick = card.getByRole("link", { name: usDay(day) });
  // On a Sunday the newest daily update is the KvK's own: no recovery day yet.
  if (day >= new Date(today).toISOString().slice(0, 10)) {
    await expect(pick).toHaveCount(0);
    return;
  }
  // Counted: in the Start, the End and the newest daily update (not the joiner, not the leaver).
  const counted = A.names.flatMap((_, k) => (k === JOINER || k === LEAVER ? [] : [k]));
  const before = eventTotals("a", "before").might - memberChange("a").left;
  const after = eventTotals("a", "after").might - memberChange("a").joined;
  const index = 14 - (today - Date.parse(day)) / DAY_MS;
  const then = counted.reduce((s, k) => s + rosterOf("a", k, index).might, 0);
  const back = new Intl.NumberFormat("en", { style: "percent", maximumFractionDigits: 0 }).format(
    (then - after) / (before - after),
  );
  // The newest KvK's column says the same share.
  const newest = card
    .getByRole("heading", { level: 3, name: `KvK ${usDay(kvk)}` })
    .locator("xpath=..");
  await expect(
    newest.getByText(`${shown(day, "en-US", { weekday: "short" })}: ${back}`),
  ).toHaveCount(1);
  await hydrated(pick);
  expect((await pick.boundingBox())?.height).toBeGreaterThanOrEqual(44);
  await pick.click();
  await expect(page).toHaveURL(`${desk}/insights?kvk=${kvk}&kvkDay=${day}#insights-kvk`);
  const path = card.getByRole("navigation", { name: "Where you are in this chart" });
  await sees(path, "KvK cost and recovery");
  await sees(path, `KvK ${usDay(kvk)}`);
  await sees(path, usDay(day));
  await sees(card, `Counted: the ${counted.length} members this KvK counts.`);
  await expect(card).toContainText(
    new RegExp(`Before \\(Start read\\)\\s*${compactLarge(before, "en")}`),
  );
  await expect(card).toContainText(
    new RegExp(`After \\(End read\\)\\s*${compactLarge(after, "en")}`),
  );
  await expect(card).toContainText(new RegExp(`${compactLarge(then, "en")}\\s*${back} back`));
  await sees(
    card,
    `${usDay(day)}: ${back} of the might they lost is back. Its column shows the same.`,
  );
  // Back: that KvK with its days unfolded, the day's link again.
  await path
    .getByRole("link", { name: `KvK ${usDay(kvk)}` })
    .first()
    .click();
  await expect(page).toHaveURL(`${desk}/insights?kvk=${kvk}#insights-kvk`);
  await expect(card.getByRole("link", { name: usDay(day) })).toBeVisible();
  await path.getByRole("link", { name: "All KvKs" }).click();
  await expect(page).toHaveURL(`${desk}/insights#insights-kvk`);
  await expect(path).toHaveCount(0);
});
