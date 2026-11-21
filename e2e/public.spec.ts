// The public pages (issue 477): the home ledger, the alliance list, a player page, and an event's ledger with
// the member-change mark (D69 amendment) on the alliance whose members changed. No sign-in.
import type { Page } from "@playwright/test";

import { ALLIANCES, memberUid } from "./fixtures/seed";
import { expect, hydrated, test } from "./fixtures/test";

const A = ALLIANCES.a;

/** The page scrolls sideways when its content is wider than the window. */
const sideways = (page: Page) =>
  page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);

test("the home page shows the last event's ledger", async ({ page }) => {
  await page.goto("/");
  for (const a of Object.values(ALLIANCES)) {
    await expect(page.getByText(`[${a.tag}] ${a.name}`).first()).toBeVisible();
  }
  expect(await sideways(page)).toBe(false);
});

test("the alliance list shows the tracked alliances", async ({ page }) => {
  await page.goto("/alliances");
  await expect(page.getByRole("heading", { name: "All alliances" })).toBeVisible();
  await expect(page.getByText("Read every day (5)")).toBeVisible();
  await expect(page.getByRole("link", { name: /Lantern Keep/ }).first()).toBeVisible();
  expect(await sideways(page)).toBe(false);
});

test("a player page shows the player's numbers", async ({ page }) => {
  await page.goto(`/players/${memberUid("a", 0)}`);
  await expect(page.getByRole("heading", { name: A.names[0] as string })).toBeVisible();
  await expect(page.getByText(/^might$/i).first()).toBeVisible();
  expect(await sideways(page)).toBe(false);
});

test("an event's ledger marks the change that members who joined or left moved", async ({
  page,
}) => {
  await page.goto("/events/2");
  await expect(page.getByText(`[${A.tag}] ${A.name}`).first()).toBeVisible();
  // One member joined Lantern Keep and one left during the event; no other alliance's members changed.
  const marks = page.locator("summary:visible", {
    hasText: "Includes member changes: show the split, Might",
  });
  await expect(marks).toHaveCount(1);
  await expect(marks).toContainText(A.name);
  await hydrated(page);
  await marks.click();
  await expect(page.getByText("Came in with 1 who joined").first()).toBeVisible();
  await expect(page.getByText("Went with 1 who left").first()).toBeVisible();
  expect(await sideways(page)).toBe(false);
});
