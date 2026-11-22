// Insights' Time zones card (owner, 2026-11-22) on Lantern Keep's seed. ZONE_FACTS records time zones with no
// summer time for some members, so the offsets and the reset's times hold on any seed date. The card says the
// largest group and its reset without a tap. Its rows (west to east), the members with none recorded and the
// hours most are within their usual hours sit behind the fold. "Add their time zone ›" opens Members
// filtered on Missing info: time zone. Read-only. Every expected value is computed from the seed below, with
// Intl as the clock, apart from the app's own code.
import type { Page } from "@playwright/test";

import { ALLIANCES, calendarOf, DAY_MS, LEAVER, seededAt, ZONE_FACTS } from "./fixtures/seed";
import { deskFrame, expect, sees, signIn, test } from "./fixtures/test";

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
