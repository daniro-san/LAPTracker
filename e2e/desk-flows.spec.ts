// The desk flows that end or change something for good (issue 477): Sign out, Follow-up's "Talked to them",
// a member fact edited on the card, and a feature switch. Each writes only rows no other test reads: its own
// session (signOutToken), its own quiet member (idleOf) or fact member (factMemberOf) per project and repeat,
// and the switch on a workspace of its own per repeat, phone only (switchWorkspaceOf). Not in the iphone
// project (its testMatch is desk.spec): the seed holds these rows for phone and wide only.
import type { Page } from "@playwright/test";

import {
  ALLIANCES,
  calendarOf,
  FACT_SEEDED,
  factMemberOf,
  IDLE_DAYS,
  idleOf,
  seededAt,
  shown,
  signOutToken,
  switchWorkspaceOf,
} from "./fixtures/seed";
import { expect, hydrated, leaksIn, noError, sees, signIn, test } from "./fixtures/test";

const A = ALLIANCES.a;
const B = ALLIANCES.b;
const cal = calendarOf(seededAt());
const DAY_MS = 86_400_000;
const usDay = (day: string) =>
  shown(day, "en-US", { weekday: "short", month: "short", day: "numeric" });
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

/** The desk's frame for an alliance: its tag and name, and no error screen. */
async function deskFrame(page: Page, a: { tag: string; name: string }) {
  await expect(page.getByText(`${a.tag} · ${a.name}`)).toBeVisible();
  await noError(page);
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
  // The page never reads the logout answer's body, so Chromium never finishes that request and the guards
  // cannot read it ("unreadable answer"). The test sends the request to the server itself, scans the
  // server's answer as the guards would, and gives the page that answer as plain text (it ignores the body).
  await page.route(`**/api/w/${A.slug}/logout`, async (route) => {
    const answer = await route.fetch();
    const body = await answer.text();
    expect(leaksIn(answer.url(), body)).toEqual([]);
    await route.fulfill({
      response: answer,
      body,
      headers: { ...answer.headers(), "content-type": "text/plain" },
    });
  });
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
  const checkIn = page.getByRole("region", { name: /^Check in · \d+$/ });
  // D127's offline proxy, in Follow-up's words: no quest points and no donations on the last 3 reads.
  await sees(checkIn.getByRole("listitem").filter({ has: named(page, "", name) }), name);
  await sees(row, `Quiet for ${IDLE_DAYS} days. Worth a hello.`);

  const talked = row.getByRole("button", { name: "Talked to them" });
  await hydrated(talked);
  await savedAndRefreshed(page, `/w/${B.slug}/follow-up`, () => talked.click());
  await expect(page.getByRole("status")).toContainText(
    new RegExp(`^Saved\\. ${isolated(name)} is off the list until Monday\\.$`),
  );
  await expect(row).toHaveCount(0);
  await page.reload();
  await expect(page.getByRole("heading", { level: 1, name: "Follow-up" })).toBeVisible();
  await deskFrame(page, B);
  await expect(named(page, "", name)).toHaveCount(0);
});

test("Member facts: a Troops edit shows on the card, stays after a reload, and History keeps the earlier value", async ({
  page,
  context,
}, info) => {
  await signIn(context, "a", "officer");
  const name = A.names[factMemberOf(info.project.name, info.repeatEachIndex)] as string;
  const tier = FACT_SEEDED.tier + 1;
  const earlier = `Troops: T${FACT_SEEDED.tier} · ${usDay(new Date(cal.today - FACT_SEEDED.daysAgo * DAY_MS).toISOString().slice(0, 10))}`;
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

  await card.getByRole("button", { name: "Edit info" }).click();
  const editor = page.getByRole("dialog", { name: new RegExp(`^Info: ${isolated(name)}$`) });
  await editor.getByRole("combobox", { name: "Troops" }).selectOption(String(tier));
  const save = editor.getByRole("button", { name: "Save" });
  await savedAndRefreshed(page, `/w/${A.slug}/members`, () => save.click());
  await expect(editor).toHaveCount(0);
  await sees(panel, `Troops T${tier}`);

  await page.reload();
  await expect(card.getByRole("heading", { name, level: 2 })).toBeVisible();
  await card.getByRole("tab", { name: "Info" }).click();
  await sees(panel, `Troops T${tier}`);
  await card.getByRole("tab", { name: "History" }).click();
  await expect(panel.getByRole("heading", { name: "Earlier values" })).toBeVisible();
  await sees(panel, earlier);
  await expect(panel.getByText(`Troops: T${tier}`)).toHaveCount(0);
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
