// Drilldown on Raid prep and the Roll call list (2026-11-22): a tap on a count shows exactly the members it
// names. Raid prep's "Show the n" beside "To remind: n", and the Roll call card's ✗ and "Not set" counts,
// which open the marking page on that chip. Read only: this week's seeded Raid prep, which no test marks.
// Expected members are computed from the seed (e2e/fixtures/seed.ts).
import type { Page } from "@playwright/test";

import {
  ALLIANCES,
  calendarOf,
  KVK_ENTRY,
  LEAVER,
  LINKED_MEMBER,
  seededAt,
  SHIELD_MARKED,
} from "./fixtures/seed";
import { deskFrame, expect, hydrated, sees, signIn, test } from "./fixtures/test";

const A = ALLIANCES.a;
const desk = `/w/${A.slug}`;
/** Lantern Keep's roster today: the leaver is gone. */
const ROSTER = A.names.length - 1;
const cal = calendarOf(seededAt());

/** This week's seeded Raid prep: ✓ for SHIELD_MARKED but LINKED_MEMBER, who is ✗; the rest not set. */
const asked = A.names.filter((_, k) => k !== LEAVER);
const up = SHIELD_MARKED.filter((k) => k !== LINKED_MEMBER).map((k) => A.names[k] as string);
const notSet = A.names.filter((_, k) => k !== LEAVER && !SHIELD_MARKED.includes(k));
const no = [A.names[LINKED_MEMBER] as string];

test.beforeEach(async ({ context }) => {
  await signIn(context, "a", "officer");
});

/** Raid prep's tiles on screen: each has its Shield ✓ button. */
const prepTiles = (page: Page) =>
  page.getByRole("listitem").filter({ has: page.getByRole("button", { name: /^Shield up: / }) });

/** Exactly these members' tiles are on screen. */
async function tilesAre(page: Page, names: string[]) {
  await expect(prepTiles(page)).toHaveCount(names.length);
  for (const name of names) await expect(prepTiles(page).filter({ hasText: name })).toHaveCount(1);
}

test("Raid prep: Show the n beside To remind puts exactly those members in the grid", async ({
  page,
}) => {
  await page.goto(`${desk}/roll-call/mark?entry=${KVK_ENTRY}&week=${cal.raid.week}`);
  await expect(page.getByRole("heading", { level: 1, name: "Raid prep" })).toBeVisible();
  await deskFrame(page, A);
  // The Raid Shield check is off in the seed, so nobody is seen with a shield: all but the ✓ are to remind.
  const remind = asked.filter((name) => !up.includes(name));
  const main = page.locator("main");
  await sees(main, `To remind: ${remind.length}`);
  const show = page.getByRole("button", { name: `Show the ${remind.length}`, exact: true });
  await hydrated(show);
  await show.click();
  await sees(main, `The ${remind.length} to remind`);
  await tilesAre(page, remind);
  // A chip brings its own members back: "To mark" holds only the not set.
  await page.getByRole("button", { name: `To mark ${notSet.length}`, exact: true }).click();
  await tilesAre(page, notSet);
});

test("Roll call list: Raid prep's ✗ and Not set counts open its page on that chip, with exactly those members", async ({
  page,
}) => {
  const card = page
    .getByRole("listitem")
    .filter({ has: page.getByRole("heading", { name: "Raid prep", exact: true }) });
  const open = async (link: string) => {
    await page.goto(`${desk}/roll-call?week=${cal.raid.week}`);
    await expect(page.getByRole("heading", { level: 1, name: "Roll call" })).toBeVisible();
    await sees(card, `${SHIELD_MARKED.length} of ${ROSTER} marked`);
    await card.getByRole("link", { name: link, exact: true }).click();
    await expect(page.getByRole("heading", { level: 1, name: "Raid prep" })).toBeVisible();
    // The answer is read whole by the privacy guards before the next page replaces it.
    await page.waitForLoadState("load");
  };
  await open(`No shield ${no.length}`);
  const noChip = page.getByRole("button", { name: `${no.length} marked ✗`, exact: true });
  await expect(noChip).toHaveAttribute("aria-pressed", "true");
  await tilesAre(page, no);
  await open(`Not set ${notSet.length}`);
  const todo = page.getByRole("button", { name: `To mark ${notSet.length}`, exact: true });
  await expect(todo).toHaveAttribute("aria-pressed", "true");
  await tilesAre(page, notSet);
});
