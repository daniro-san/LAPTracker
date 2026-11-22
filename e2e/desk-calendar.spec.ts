// The Calendar flow (issue 477, flow 3): an officer adds an entry, deletes it, taps Undo and sees it back,
// after a reload too. Each project and repeat writes its own entry (calendarAddOf: its own title on a Monday
// of its own weeks ahead, on Moss Hollow's workspace), and deletes it again at the end through the page.
import type { Page } from "@playwright/test";

import { ALLIANCES, calendarAddOf, seededAt, shown } from "./fixtures/seed";
import { deskFrame, expect, hydrated, labelled, sees, signIn, test } from "./fixtures/test";

const B = ALLIANCES.b;

/** The day's card on the Calendar: the list item headed by its long date ("Monday, January 4"). */
const dayCard = (page: Page, day: string) =>
  page.getByRole("listitem").filter({
    has: page.getByRole("heading", {
      level: 2,
      name: shown(day, "en-US", { weekday: "long", month: "long", day: "numeric" }),
    }),
  });

/** Delete from the day card, answered Delete in its question; the Undo line then shows. */
async function deleteFromCard(page: Page, title: string) {
  const remove = page.getByRole("button", { name: labelled("Delete: ", title) });
  await hydrated(remove);
  await remove.click();
  const ask = page.getByRole("alertdialog", { name: "Delete this event?" });
  await sees(ask, title);
  await ask.getByRole("button", { name: "Delete", exact: true }).click();
  await expect(ask).toHaveCount(0);
  await expect(page.getByRole("status").filter({ hasText: "Event deleted." })).toBeVisible();
}

test("Calendar: an added entry is deleted, comes back on Undo, and stays after a reload", async ({
  context,
  page,
}, info) => {
  const entry = calendarAddOf(seededAt(), info.project.name, info.repeatEachIndex);
  await signIn(context, "b", "officer");
  await page.goto(`/w/${B.slug}/calendar?week=${entry.day}`);
  await expect(page.getByRole("heading", { level: 1, name: "Calendar" })).toBeVisible();
  await deskFrame(page, B);
  const card = dayCard(page, entry.day);
  const title = card.getByText(entry.title, { exact: true });
  await sees(card, "Nothing planned.");

  // Add: the sheet opens on the week's Monday (today is in another week), an Other event at 20:00 ST.
  const add = page.getByRole("button", { name: "Add an event" });
  await hydrated(add);
  await add.click();
  const sheet = page.getByRole("dialog", { name: "Add an event" });
  await sheet.getByRole("radio", { name: "Other event" }).check();
  await sheet.getByLabel("Name").fill(entry.title);
  await expect(sheet.getByRole("textbox", { name: "Day" })).toHaveValue(entry.day);
  await sheet.getByLabel("Time (ST)").fill(entry.time);
  await sheet.getByRole("button", { name: "Save" }).click();
  await expect(sheet).toHaveCount(0);
  await expect(title).toBeVisible();
  await sees(card, `${entry.time} ST`);
  await expect(card.getByText("Nothing planned.")).toHaveCount(0);

  // Delete, then Undo: the entry leaves the day and comes back.
  await deleteFromCard(page, entry.title);
  await expect(title).toHaveCount(0);
  await sees(card, "Nothing planned.");
  await card.getByRole("button", { name: "Undo" }).click();
  await expect(title).toBeVisible();
  await sees(card, `${entry.time} ST`);
  await expect(page.getByRole("button", { name: "Undo" })).toHaveCount(0);

  // The restored entry is stored, not only drawn again.
  await page.reload();
  await expect(page.getByRole("heading", { level: 1, name: "Calendar" })).toBeVisible();
  await deskFrame(page, B);
  await expect(title).toBeVisible();
  await sees(card, `${entry.time} ST`);

  // Put back: the entry deleted again, so a later run on this slot starts from an empty day.
  await deleteFromCard(page, entry.title);
  await expect(title).toHaveCount(0);
  await page.reload();
  await expect(page.getByRole("heading", { level: 1, name: "Calendar" })).toBeVisible();
  await sees(card, "Nothing planned.");
});
