// Follow-up's "After KvK, offer help" (issue 585 slice 5): the seed's HEAVY_HIT lost more than a quarter of
// their might at the last KvK and is still under 80% of it, and nobody wrote anything about them since, so
// for the week after that KvK Follow-up offers help: a jump in the head, the group with its rule and the KvK's
// day, their row; and Insights' help list links to it. Read-only. Home's numbers that count it are in
// desk.spec.ts; Members' head is below. Expected values come from the seed (e2e/fixtures/seed.ts).
import { toLookOf } from "./fixtures/follow-up-list";
import {
  ALLIANCES,
  calendarOf,
  HEAVY_HIT,
  kvkWeek,
  seededAt,
  shown,
  uidOf,
  usDay,
} from "./fixtures/seed";
import { deskFrame, expect, hydrated, sees, signIn, test } from "./fixtures/test";

const A = ALLIANCES.a;
const desk = `/w/${A.slug}`;
const name = A.names[HEAVY_HIT.k] as string;
const GROUP = "After KvK, offer help · 1";

test.beforeEach(async ({ context }) => {
  await signIn(context, "a", "officer");
});

test("After KvK, offer help: Follow-up offers help to the member who took a heavy hit, and Insights links to it", async ({
  page,
}) => {
  await page.goto(`${desk}/follow-up`);
  await expect(page.getByRole("heading", { level: 1, name: "Follow-up" })).toBeVisible();
  await deskFrame(page, A);
  const jump = page.getByRole("link", { name: "1 to offer help after the KvK ↓" });
  const group = page.getByRole("region", { name: GROUP });
  // On the next KvK day (a Saturday, server days) the week is over: no group, no jump, no link.
  if (!kvkWeek(seededAt())) {
    await expect(jump).toHaveCount(0);
    await expect(group).toHaveCount(0);
    return;
  }
  const kvk = calendarOf(seededAt()).events[1] as string;
  const day = usDay(kvk);
  // A line that ends with the date writes it as in a sentence: "November 21" (issue 585 batch 4).
  const sentence = shown(kvk, "en-US", { month: "long", day: "numeric" });
  await sees(
    group,
    `Lost over a quarter of their might in the KvK of ${day}, and still below 80% of what they had. Here for the week after it, or until someone writes down what they said.`,
  );
  // The row: their name opens their panel; the hint says the KvK line, so the row does not repeat it.
  const row = group.getByRole("button", { name: new RegExp(`^\\u2068?${name}\\u2069?`) });
  await expect(row).toBeVisible();
  await expect(group).not.toContainText(`Still rebuilding after the KvK of ${sentence}.`);
  await expect(jump).toHaveAttribute("href", "#follow-up-kvk");
  await hydrated(jump);
  await jump.click();
  await expect(page.getByRole("heading", { name: GROUP })).toBeInViewport();

  // Insights keeps its help list, the name to the member's card, and links to the group.
  await page.goto(`${desk}/insights`);
  await expect(page.getByRole("heading", { level: 1, name: "Insights" })).toBeVisible();
  const card = page.getByRole("region", { name: "KvK cost and recovery" });
  await expect(card.getByRole("link", { name })).toHaveAttribute(
    "href",
    `${desk}/members?m=${uidOf("a", HEAVY_HIT.k)}`,
  );
  await sees(card, "Offer help: Follow-up ›");
  const offer = card.getByRole("link", { name: "Follow-up ›" });
  await hydrated(offer);
  await offer.click();
  await expect(page.getByRole("heading", { level: 1, name: "Follow-up" })).toBeVisible();
  await expect(page.getByRole("heading", { name: GROUP })).toBeInViewport();
});

test("Members' head says Follow-up's numbers, the KvK group counted", async ({ page }) => {
  await page.goto(`${desk}/members`);
  await expect(page.getByRole("heading", { level: 1, name: "Members" })).toBeVisible();
  // The same list as Follow-up and Home (slice 5); the noted part races (see desk.spec.ts's Home test).
  const line = new RegExp(`^Follow-up: ${toLookOf()} to look at( · 1 noted this week)?$`);
  await expect(page.locator("main").getByRole("link", { name: line })).toHaveAttribute(
    "href",
    `${desk}/follow-up`,
  );
});
