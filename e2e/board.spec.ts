// The members' board for Lantern Keep's member, whose "This is me" link an officer approved (D142): their own
// page, and the desk closed to them (D105). Expected figures come from the seed's rows (rosterOf: the first
// and the newest of the 14 daily rosters) and are written with the pages' formatter (`big`).
import {
  ALLIANCES,
  calendarOf,
  daysAgo,
  LINKED,
  LINKED_MEMBER,
  questPointsOf,
  rosterOf,
  seededAt,
  shown,
  usDay,
} from "./fixtures/seed";
import { big, expect, noError, sees, signIn, test } from "./fixtures/test";

const A = ALLIANCES.a;
const linked = A.names[LINKED_MEMBER] as string;
const cal = calendarOf(seededAt());

test.beforeEach(async ({ context }) => {
  await signIn(context, "a", "member");
});

test("Me: the member's own page, with their own numbers only", async ({ page }) => {
  const res = await page.goto(`/w/${A.slug}/board/me`);
  // A private page: no shared or browser cache keeps it (proxy.ts).
  expect(res?.headers()["cache-control"]).toBe("private, no-store");
  await expect(page.getByRole("heading", { level: 1, name: "Your page" })).toBeVisible();
  await noError(page);
  const needed = page.getByRole("region", { name: "Where you’re needed" });
  // Raid prep marked this member "No shield" (the seed's Shield mark for them).
  await sees(needed, `Raid prep, ${usDay(cal.raid.day)} · your mark: “No shield”`);
  await sees(needed, `In the game, you are ${linked}.`);
  const progress = page.getByRole("region", { name: "Your progress" });
  const [first, newest] = [rosterOf("a", LINKED_MEMBER, 0), rosterOf("a", LINKED_MEMBER)];
  const since = usDay(daysAgo(14));
  await sees(
    progress,
    `Might ${big(newest.might)} · +${big(newest.might - first.might)} since ${since}`,
  );
  await sees(
    progress,
    `Kills ${big(newest.kills)} · +${big(newest.kills - first.kills)} since ${since}`,
  );
  const week = page.getByRole("region", { name: "This week" });
  await sees(week, "Daily quest points");
  // The game week's reads so far, Monday up to yesterday (none on a Monday, whose line then says so), and
  // last week's seven; the seed gives this member different quest points on each side of both Mondays.
  const reads = (new Date(cal.today).getUTCDay() + 6) % 7;
  const average = (from: number, n: number) => {
    const days = Array.from({ length: n }, (_, i) => daysAgo(from - i));
    return Math.round(days.reduce((s, d) => s + questPointsOf("a", LINKED.a, d), 0) / n);
  };
  // The quest points row comes first; coins and donations have lines of their own below it.
  if (reads > 0) {
    const days = `${reads} day${reads === 1 ? "" : "s"}`;
    await expect(
      week.getByText(`This week: Average ${average(reads, reads)} · ${days}`).first(),
    ).toBeVisible();
  } else {
    await expect(week.getByText("This week: no average yet").first()).toBeVisible();
  }
  await expect(
    week.getByText(`Last week: Average ${average(reads + 7, 7)} · 7 days`).first(),
  ).toBeVisible();
  for (const other of A.names.filter((n) => n !== linked)) {
    await expect(page.getByText(other)).toHaveCount(0);
  }
});

test("a member's session opens the board, not the desk", async ({ page }) => {
  await page.goto(`/w/${A.slug}/members`);
  await expect(page).toHaveURL(new RegExp(`/w/${A.slug}/board`));
  await expect(
    page.getByRole("heading", { level: 1, name: "Next 7 days in the alliance" }),
  ).toBeVisible();
  await noError(page);
  const days = page.getByRole("list", { name: "The next 7 days" });
  await expect(days.getByRole("listitem")).toHaveCount(7);
  const today = shown(daysAgo(0), "en-US", { weekday: "long", month: "long", day: "numeric" });
  await sees(days.getByRole("listitem").first(), `${today} · Today`);
  // The desk's Members list is not there: no member's might, no other member's name.
  await expect(page.getByRole("heading", { name: "Members", level: 1 })).toHaveCount(0);
  await expect(page.getByText(A.names[0] as string)).toHaveCount(0);
});
