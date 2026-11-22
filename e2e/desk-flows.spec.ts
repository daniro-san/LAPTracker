// The desk flows that end or change something (issue 477): Sign out, Follow-up's "Talked to them", a member
// fact edited on the card, and a feature switch. Each writes only rows no other test reads: its own session
// (signOutToken), its own quiet member (idleOf) or fact member (factMemberOf) per project and repeat, and the
// switch on a workspace of its own per repeat, phone only (switchWorkspaceOf). Each puts back what it changed,
// checked on screen, except the ended session, which cannot come back. Not in the iphone project (its
// testMatch is desk.spec): the seed holds these rows for phone and wide only.
import { randomUUID } from "node:crypto";

import type { Page } from "@playwright/test";

import { BASE_URL } from "./env";
import {
  ALLIANCES,
  daysAgo,
  FACT_SEEDED,
  factMemberOf,
  IDLE_DAYS,
  idleOf,
  signOutToken,
  switchWorkspaceOf,
  usDay,
} from "./fixtures/seed";
import { deskFrame, expect, hydrated, noError, sees, signIn, test } from "./fixtures/test";

const A = ALLIANCES.a;
const B = ALLIANCES.b;
/** A name inside Unicode isolates, as isolate() writes it into a label or a line. */
const isolated = (name: string) => `\\u2068?${name}\\u2069?`;
/** A button whose name starts with the member's name (a Members line, a Follow-up row). */
const named = (page: Page, prefix: string, name: string) =>
  page.getByRole("button", { name: new RegExp(`^${prefix}${isolated(name)}`) });

/**
 * Runs `action` (a tap that saves), then waits until the page's refresh of `path` (router.refresh, an RSC
 * answer) has come in whole: a reload or a new page cut short would leave that answer unread by the guards.
 */
async function savedAndRefreshed(page: Page, path: string, action: () => Promise<void>) {
  const refreshed = page.waitForResponse(
    (r) => new URL(r.url()).pathname === path && r.request().headers()["rsc"] === "1",
  );
  await action();
  await (await refreshed).finished();
}

/** The sign-in screen (D99), with none of Lantern Keep's members on it. */
async function signInScreen(page: Page) {
  const screen = page.getByRole("region", { name: "Sign in" });
  await expect(screen.getByRole("heading", { level: 1, name: "Sign in" })).toBeVisible();
  await expect(screen.getByRole("link", { name: "Sign in with Discord" })).toBeVisible();
  await noError(page);
  for (const name of A.names) await expect(page.getByText(name)).toHaveCount(0);
}

test("Sign out: the sign-in screen shows, and Members then shows no member", async ({
  context,
  page,
}, info) => {
  // A session of its own, so the officer's main session and the other runs' stay signed in.
  const token = signOutToken(info.project.name, info.repeatEachIndex);
  await signIn(context, "a", "officer", undefined, token);
  await page.goto(`/w/${A.slug}/members`);
  await expect(page.getByRole("heading", { level: 1, name: "Members" })).toBeVisible();
  await deskFrame(page, A);
  await expect(named(page, "R\\d ", A.names[0] as string).first()).toBeVisible();

  const signOut = page.getByRole("button", { name: "Sign out" });
  await hydrated(signOut);
  await savedAndRefreshed(page, `/w/${A.slug}/members`, () => signOut.click());
  await signInScreen(page);
  await expect(page.getByRole("heading", { level: 1, name: "Members" })).toHaveCount(0);
  await page.goto(`/w/${A.slug}/members`);
  await signInScreen(page);
});

test("Follow-up: Talked to them takes a quiet member off the list, after a reload too", async ({
  context,
  page,
}, info) => {
  await signIn(context, "b", "officer");
  const name = B.names[idleOf(info.project.name, info.repeatEachIndex)] as string;
  // The member's row, found by the button that opens their panel (its name starts with theirs).
  const row = page.getByRole("listitem").filter({ has: named(page, "", name) });
  await page.goto(`/w/${B.slug}/follow-up`);
  await expect(page.getByRole("heading", { level: 1, name: "Follow-up" })).toBeVisible();
  await deskFrame(page, B);
  const checkIn = page.getByRole("region", { name: /^Worth a hello · \d+$/ });
  // #585: who an officer noted this week, the officer's name first; other runs note their own members.
  const notedRow = page
    .getByRole("region", { name: /^Noted this week · \d+$/ })
    .getByRole("listitem")
    .filter({ has: page.getByRole("link", { name }) });
  // D127's offline proxy, in Follow-up's words: no quest points and no donations on the last 3 reads.
  await sees(checkIn.getByRole("listitem").filter({ has: named(page, "", name) }), name);
  await sees(row, `Quiet for ${IDLE_DAYS} days. Worth a hello.`);

  const talked = row.getByRole("button", { name: "Talked to them" });
  const path = `/w/${B.slug}/follow-up`;
  const sent = page.waitForRequest((r) => r.url().endsWith(`/api${path}`));
  await hydrated(talked);
  await savedAndRefreshed(page, path, () => talked.click());
  await expect(page.getByRole("status")).toContainText(
    new RegExp(`^Saved\\. ${isolated(name)} is off the list until Monday\\.$`),
  );
  await expect(row).toHaveCount(0);
  const { uid, requestId } = (await sent).postDataJSON() as { uid: number; requestId: string };
  // "Officer MSH · Sat, Nov 21: Talked to them": the officer and today first, the rank after the name.
  const by = new RegExp(`${isolated(`Officer ${B.tag}`)} · ${usDay(daysAgo(0))}: Talked to them`);
  await expect(notedRow).toContainText(by);
  await expect(notedRow).toContainText(/ · R\d/);
  await page.reload();
  await expect(page.getByRole("heading", { level: 1, name: "Follow-up" })).toBeVisible();
  await deskFrame(page, B);
  await expect(named(page, "", name)).toHaveCount(0);
  await expect(notedRow).toContainText(by);
  // The name opens this member's own card.
  await expect(notedRow.getByRole("link", { name })).toHaveAttribute(
    "href",
    `/w/${B.slug}/members?m=${uid}`,
  );

  // Put back, so a later run on this slot finds the member on the list again. The page offers Undo only
  // until it is left, so this is the Undo it sends, for the record the tap made; then checked on screen.
  const undo = await page.request.post(`/api${path}`, {
    headers: { origin: BASE_URL },
    data: { uid, action: "undo", target: requestId, requestId: randomUUID() },
  });
  expect(undo.status()).toBe(200);
  await page.reload();
  await expect(page.getByRole("heading", { level: 1, name: "Follow-up" })).toBeVisible();
  await sees(row, `Quiet for ${IDLE_DAYS} days. Worth a hello.`);
  await expect(notedRow).toHaveCount(0);
});

test("Member facts: a Troops edit shows on the card, stays after a reload, and History keeps the earlier value", async ({
  page,
  context,
}, info) => {
  await signIn(context, "a", "officer");
  const name = A.names[factMemberOf(info.project.name, info.repeatEachIndex)] as string;
  const tier = FACT_SEEDED.tier + 1;
  const earlier = `Troops: T${FACT_SEEDED.tier} · ${usDay(daysAgo(FACT_SEEDED.daysAgo))}`;
  // Below 1024 px the card is a sheet (a dialog); from 1024 px a pane beside the list (D122).
  const card =
    (page.viewportSize()?.width ?? 0) < 1024
      ? page.getByRole("dialog", { name })
      : page.locator("main");
  const panel = card.getByRole("tabpanel");
  await page.goto(`/w/${A.slug}/members`);
  await expect(page.getByRole("heading", { level: 1, name: "Members" })).toBeVisible();
  await deskFrame(page, A);
  const line = named(page, "R\\d ", name).first();
  await hydrated(line);
  await line.click();
  await expect(card.getByRole("heading", { name, level: 2 })).toBeVisible();
  await card.getByRole("tab", { name: "Info" }).click();
  await sees(panel, `Troops T${FACT_SEEDED.tier}`);

  /** Edit info → Troops `to` → Save: the editor closes and Info shows it, then again after a reload. */
  const saveTroops = async (to: number) => {
    await card.getByRole("tab", { name: "Info" }).click();
    await card.getByRole("button", { name: "Edit info" }).click();
    const editor = page.getByRole("dialog", { name: new RegExp(`^Info: ${isolated(name)}$`) });
    await editor.getByRole("combobox", { name: "Troops" }).selectOption(String(to));
    const save = editor.getByRole("button", { name: "Save" });
    await savedAndRefreshed(page, `/w/${A.slug}/members`, () => save.click());
    await expect(editor).toHaveCount(0);
    await sees(panel, `Troops T${to}`);
    await page.reload();
    await expect(card.getByRole("heading", { name, level: 2 })).toBeVisible();
    await card.getByRole("tab", { name: "Info" }).click();
    await sees(panel, `Troops T${to}`);
  };

  await saveTroops(tier);
  await card.getByRole("tab", { name: "History" }).click();
  await expect(panel.getByRole("heading", { name: "Earlier values" })).toBeVisible();
  await sees(panel, earlier);

  // Put back: T10 again, so a later run on this slot starts from the seeded value; T11 is now an earlier one.
  await saveTroops(FACT_SEEDED.tier);
  await card.getByRole("tab", { name: "History" }).click();
  await sees(panel, `Troops: T${tier} · ${usDay(daysAgo(0))}`);
  await sees(panel, earlier);
});

test("Features: Thefts turned off leaves the navigation, stays off after a reload, then turns on again", async ({
  context,
  page,
}, info) => {
  // Phone only, on a workspace of its own per repeat: no other test's navigation changes meanwhile.
  test.skip(info.project.name !== "phone", "one project switches a workspace's feature");
  const w = switchWorkspaceOf(info.repeatEachIndex);
  await signIn(context, "a", "officer", `__Host-lap_ws.${w.slug}`, w.token);
  const views = page.getByRole("navigation", { name: "Calendar views" });
  const features = page.getByRole("region", { name: "Features" });
  const thefts = features.getByRole("checkbox", { name: "Thefts", exact: true });
  /** The calendar's views on a phone: Week always, Thefts while it is on. */
  const calendarHasThefts = async (on: boolean) => {
    await page.goto(`/w/${w.slug}/calendar`);
    await deskFrame(page, w);
    await expect(views.getByRole("link", { name: "Week" })).toBeVisible();
    await expect(views.getByRole("link", { name: "Thefts" })).toHaveCount(on ? 1 : 0);
  };
  const openSettings = async () => {
    await page.goto(`/w/${w.slug}/settings`);
    await expect(page.getByRole("heading", { level: 1, name: "Alliance settings" })).toBeVisible();
    await deskFrame(page, w);
  };
  /** Ticks Thefts to `on`, sees "Not saved yet", taps Save, sees "Saved." and the box as saved. */
  const switchTo = async (on: boolean) => {
    await hydrated(thefts);
    await thefts.setChecked(on);
    await sees(features, "Not saved yet: 1 change");
    const save = features.getByRole("button", { name: "Save" });
    await savedAndRefreshed(page, `/w/${w.slug}/settings`, () => save.click());
    await sees(features.getByRole("status"), "Saved.");
    await expect(thefts).toBeChecked({ checked: on });
  };

  await calendarHasThefts(true);
  await openSettings();
  await expect(thefts).toBeChecked();
  await switchTo(false);
  await page.reload();
  await expect(thefts).not.toBeChecked();
  await calendarHasThefts(false);

  // Back on, checked on screen the same way.
  await openSettings();
  await switchTo(true);
  await page.reload();
  await expect(thefts).toBeChecked();
  await calendarHasThefts(true);
});
