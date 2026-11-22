// The Officers' Desk for Lantern Keep's officer (issue 477): Home, Members (a card opens and stays closed once
// closed, #573), a roll call mark that is kept, and Raid prep's "To mark", which counts the Shield mark only
// (#590 F1).
import {
  ALLIANCES,
  calendarOf,
  CHEESE_ENTRY,
  KVK_ENTRY,
  seededAt,
  SHIELD_MARKED,
} from "./fixtures/seed";
import { expect, hydrated, signIn, test } from "./fixtures/test";

const A = ALLIANCES.a;
const desk = `/w/${A.slug}`;
/** Lantern Keep's roster today: the leaver is gone. */
const ROSTER = A.names.length - 1;
/** Each project marks its own member, so the two can run at once on one database. */
const MARKED_BY = { phone: A.names[6], wide: A.names[7], iphone: A.names[8] } as Record<
  string,
  string
>;
const isolated = (name: string) => new RegExp(`⁨?${name}⁩?`);

test.beforeEach(async ({ context }) => {
  await signIn(context, "a", "officer");
});

test("Home shows the alliance and its day", async ({ page }) => {
  await page.goto(desk);
  await expect(page.getByText(`${A.tag} · ${A.name}`)).toBeVisible();
  await expect(page.getByRole("heading", { name: "Home" })).toBeVisible();
  await expect(page.getByText("Recent activity")).toBeVisible();
});

test("Members: a card opens from the list and stays closed once closed", async ({ page }) => {
  await page.goto(`${desk}/members`);
  await hydrated(page);
  await expect(page.getByText(`${ROSTER} of ${ROSTER} members`)).toBeVisible();
  const name = A.names[3] as string;
  await page
    .getByRole("button", { name: isolated(name) })
    .first()
    .click();
  // Below 1024 px the card is a sheet (a dialog); from 1024 px a pane beside the list (D122).
  const card =
    (page.viewportSize()?.width ?? 0) < 1024
      ? page.getByRole("dialog", { name })
      : page.locator("main");
  await expect(card.getByRole("heading", { name, level: 2 })).toBeVisible();
  await expect(card.getByText("Last 7 days")).toBeVisible();
  await expect(page).toHaveURL(/[?&]m=\d+/);
  await card.getByRole("button", { name: "Close" }).click();
  await expect(page.getByRole("heading", { name, level: 2 })).toBeHidden();
  // #573: the card used to open again a moment after closing, with "Loading…".
  await page.waitForTimeout(1500);
  await expect(page.getByRole("heading", { name, level: 2 })).toBeHidden();
  await expect(page.getByText("Loading…")).toBeHidden();
  await expect(page).not.toHaveURL(/[?&]m=/);
});

test("Roll call: a mark is saved and kept", async ({ page }, info) => {
  const name = MARKED_BY[info.project.name] as string;
  await page.goto(`${desk}/roll-call`);
  await page.getByRole("link", { name: "Mark ›" }).first().click();
  await expect(page).toHaveURL(new RegExp(`entry=${CHEESE_ENTRY}&`));
  await expect(page.getByRole("heading", { name: /Cheese Trap/ })).toBeVisible();
  await hydrated(page);
  const tile = page.getByRole("listitem").filter({ hasText: name });
  const tookPart = tile.getByRole("button", { name: new RegExp(`^Took part: \u2068?${name}`) });
  const save = () => page.waitForResponse((r) => r.url().endsWith(`/api/w/${A.slug}/roll-call`));
  let saved = save();
  await tookPart.click();
  expect((await saved).status()).toBe(200);
  await page.reload();
  await hydrated(page);
  await page.getByRole("button", { name: /^All \d+/ }).click();
  await expect(tile).toContainText("Took part");
  // A second tap clears the mark, so a repeated run (--repeat-each, --ui) finds the member unmarked again.
  saved = save();
  await tookPart.click();
  expect((await saved).status()).toBe(200);
});

test("Raid prep: To mark counts the members with no Shield mark", async ({ page }) => {
  await page.goto(
    `${desk}/roll-call/mark?entry=${KVK_ENTRY}&week=${calendarOf(seededAt()).raid.week}`,
  );
  await expect(page.getByRole("heading", { name: "Raid prep" })).toBeVisible();
  // Two members have a squads-off-the-wall mark and no Shield mark: they are still to mark (#590 F1).
  const toMark = ROSTER - SHIELD_MARKED.length;
  await expect(page.getByRole("button", { name: `To mark ${toMark}` })).toBeVisible();
  await expect(page.getByText(`${SHIELD_MARKED.length} of ${ROSTER} marked`)).toBeVisible();
});
