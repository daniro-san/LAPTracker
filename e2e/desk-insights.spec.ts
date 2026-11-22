// Insights' Time zones card (owner, 2026-11-22) on Lantern Keep's seed: ZONE_FACTS records Manila for two
// members and São Paulo for one, zones with no summer time, so the offsets and the reset's time hold on any
// date. The card says the largest group and its reset without a tap, then the rows west to east, the 8
// members with none recorded, and the hours most are within their usual hours; "Add their time zone ›" opens
// Members filtered on Missing info: time zone. Read-only. Expected values come from e2e/fixtures/seed.ts.
import type { Page } from "@playwright/test";

import { ALLIANCES, daysAgo, shown } from "./fixtures/seed";
import { deskFrame, expect, sees, signIn, test } from "./fixtures/test";

const A = ALLIANCES.a;
const desk = `/w/${A.slug}`;

/** A Members line: a button whose name starts with the rank and the member's name (in isolates). */
const memberLine = (page: Page, name: string) =>
  page.getByRole("button", { name: new RegExp(`^R\\d \\u2068?${name}\\u2069?`) });

test.beforeEach(async ({ context }) => {
  await signIn(context, "a", "officer");
});

test("Time zones: the largest group and its reset, the groups west to east, and the members to ask", async ({
  page,
}) => {
  await page.goto(`${desk}/insights`);
  await expect(page.getByRole("heading", { level: 1, name: "Insights" })).toBeVisible();
  await deskFrame(page, A);
  const card = page.getByRole("region", { name: "Time zones" });
  await sees(
    card,
    "Largest group: Manila (UTC+8), 2 of the 3 members with a time zone. The 00:00 ST reset is 10:00 for them.",
  );
  await sees(card, "Time zone recorded for 3 of the 11 members in the newest daily update.");
  // The last card, its rows behind the fold.
  await expect(page.locator("section.drawn-card").last()).toHaveAttribute(
    "aria-labelledby",
    "insights-zones",
  );
  await expect(card.getByText("Not recorded yet")).toBeHidden();

  await card.getByText("Show the details").click();
  const rows = card.getByRole("listitem");
  await expect(rows).toHaveCount(3);
  // The next reset is tomorrow 00:00 ST: still today, 23:00, in São Paulo (UTC−3).
  const today = shown(daysAgo(0), "en-US", { weekday: "short" });
  await sees(rows.nth(0), "Sao Paulo · UTC−3");
  await sees(rows.nth(0), `Reset ${today} 23:00`);
  await sees(rows.nth(1), "Manila · UTC+8");
  await sees(rows.nth(1), "Reset 10:00");
  await sees(rows.nth(2), "Not recorded yet");
  await sees(rows.nth(2), "Not counted in any group.");
  await expect(rows.nth(2).locator(".h-2")).toHaveCount(0);
  await expect(rows.nth(2).locator(".tabular-nums")).toHaveText("8");
  await sees(
    card,
    "Within their usual hours for the most: 09:00–12:59 and 22:00–23:59 ST, 3 of the 3 members with a time zone (8 not recorded).",
  );

  const add = card.getByRole("link", { name: "Add their time zone ›" });
  expect((await add.boundingBox())?.height).toBeGreaterThanOrEqual(44);
  await add.click();
  await expect(page).toHaveURL(`${desk}/members?ask=timeZone`);
  await expect(page.getByRole("heading", { level: 1, name: "Members" })).toBeVisible();
  await expect(memberLine(page, A.names[1] as string)).toBeVisible();
  await expect(memberLine(page, A.names[0] as string)).toHaveCount(0);
});
