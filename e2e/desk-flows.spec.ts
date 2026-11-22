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
  clearHelpOf,
  daysAgo,
  FACT_SEEDED,
  factMemberOf,
  IDLE_DAYS,
  NEEDS_HELP,
  idleOf,
  signOutToken,
  switchWorkspaceOf,
  usDay,
} from "./fixtures/seed";
import {
  deskFrame,
  expect,
  hydrated,
  isolated,
  noError,
  savedAndRefreshed,
  sees,
  signIn,
  test,
} from "./fixtures/test";

const A = ALLIANCES.a;
const B = ALLIANCES.b;
/** A button whose name starts with the member's name (a Members line, a Follow-up row). */
const named = (page: Page, prefix: string, name: string) =>
  page.getByRole("button", { name: new RegExp(`^${prefix}${isolated(name)}`) });

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
  // D127's offline proxy, in Follow-up's words: no quest points and no donations on the last 3 reads. Every
  // quiet member of the seed has the same days, so the group may say it once for all its rows (issue 585 S3),
  // and other runs take their own members off meanwhile: the reason is checked on the group.
  const quiet = `Quiet for ${IDLE_DAYS} days. Worth a hello.`;
  await sees(checkIn.getByRole("listitem").filter({ has: named(page, "", name) }), name);
  await sees(checkIn, quiet);
  // Issue 585 S3: one action per row besides the name (which opens the panel), and the member's card.
  const uid = Number(await named(page, "", name).getAttribute("data-uid"));
  await expect(row.getByRole("button")).toHaveCount(2);
  await expect(row.getByRole("button", { name: "Add a note" })).toHaveCount(0);
  const cardLink = row.getByRole("link", { name: new RegExp(`^${isolated(name)}’s card$`) });
  await expect(cardLink).toHaveText("Card ›");
  await expect(cardLink).toHaveAttribute("href", `/w/${B.slug}/members?m=${uid}`);
  // "How this list works" is closed on every visit, the first too (issue 585 batch 4 S2): the groups stay
  // on the first screen. One tap opens the owner's line (D104).
  const help = page.locator("details").filter({ hasText: "How this list works" });
  await expect(help).not.toHaveAttribute("open");
  await help.locator("summary").click();
  await expect(help).toHaveAttribute("open", "");
  await sees(
    help,
    "These are notes for you. Nothing is sent and nobody is removed from the alliance.",
  );

  const talked = row.getByRole("button", { name: "Talked to them" });
  const path = `/w/${B.slug}/follow-up`;
  const sent = page.waitForRequest((r) => r.url().endsWith(`/api${path}`));
  await hydrated(talked);
  await savedAndRefreshed(page, path, () => talked.click());
  await expect(page.getByRole("status")).toContainText(
    new RegExp(`^Saved\\. ${isolated(name)} is off the list until Monday\\.$`),
  );
  await expect(row).toHaveCount(0);
  const { requestId, ...saved } = (await sent).postDataJSON() as { uid: number; requestId: string };
  expect(saved.uid).toBe(uid);
  // "Officer MSH · Sat, Nov 21: Talked to them": the officer and today first, the rank after the name.
  const by = new RegExp(`${isolated(`Officer ${B.tag}`)} · ${usDay(daysAgo(0))}: Talked to them`);
  await expect(notedRow).toContainText(by);
  await expect(notedRow).toContainText(/ · R\d/);
  await page.reload();
  await expect(page.getByRole("heading", { level: 1, name: "Follow-up" })).toBeVisible();
  await deskFrame(page, B);
  await expect(help).not.toHaveAttribute("open");
  // Closed again after a reload, it still says how to reach the other answers: the name.
  await sees(
    help.locator("summary"),
    "Tap a name to write down what they said. How this list works",
  );
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
  await sees(checkIn, quiet);
  await expect(row).toHaveCount(1);
  await expect(notedRow).toHaveCount(0);

  // "Card ›" opens this member's card on Members: a sheet below 1024 px, the pane beside the list from 1024.
  await hydrated(cardLink);
  await cardLink.click();
  await expect(page.getByRole("heading", { level: 1, name: "Members" })).toBeVisible();
  const card =
    (page.viewportSize()?.width ?? 0) < 1024
      ? page.getByRole("dialog", { name })
      : page.locator("main");
  await expect(card.getByRole("heading", { name, level: 2 })).toBeVisible();
});

test("Follow-up: No longer needs help takes a member off Needs help, after a refusal and a reload too", async ({
  context,
  page,
}, info) => {
  // Phone only, on the repeat's own feature-switch workspace: Lantern Keep's counts never move meanwhile.
  test.skip(info.project.name !== "phone", "one project clears a mark");
  const w = switchWorkspaceOf(info.repeatEachIndex);
  const member = clearHelpOf(info.repeatEachIndex);
  await signIn(context, "a", "officer", `__Host-lap_ws.${w.slug}`, w.token);
  const path = `/w/${w.slug}/follow-up`;
  const group = page.getByRole("region", { name: /^Needs help · \d+$/ });
  const facts = (version: number, value: "help" | null) =>
    page.request.post(`/api/w/${w.slug}/members/${member.uid}/facts`, {
      headers: { origin: BASE_URL },
      data: { changes: [{ field: "status", version, value, source: "officer" }] },
    });
  await page.goto(path);
  await expect(page.getByRole("heading", { level: 1, name: "Follow-up" })).toBeVisible();
  await deskFrame(page, w);
  await sees(group, `“${NEEDS_HELP.note}”`);
  const open = named(page, "", member.name);
  await hydrated(open);
  await open.click();
  const panel = page.getByRole("dialog", { name: member.name });
  const clear = panel.getByRole("button", { name: "No longer needs help" });
  await expect(clear).toBeVisible();

  // Another officer saves the status meanwhile (Needs help again, version 2): the page's version 1 is refused.
  expect((await facts(1, "help")).status()).toBe(200);
  await savedAndRefreshed(page, path, () => clear.click());
  await expect(panel.getByRole("alert")).toHaveText("Could not save. Try again.");
  await expect(group).toHaveCount(1);

  // The list was read again with the newer version, so the second tap clears the mark.
  await savedAndRefreshed(page, path, () => clear.click());
  await expect(page.getByRole("status")).toContainText(
    new RegExp(`^Saved\\. ${isolated(member.name)} no longer needs help\\.$`),
  );
  await expect(panel).toHaveCount(0);
  await expect(group).toHaveCount(0);
  await page.reload();
  await expect(page.getByRole("heading", { level: 1, name: "Follow-up" })).toBeVisible();
  await deskFrame(page, w);
  await expect(group).toHaveCount(0);
  await expect(named(page, "", member.name)).toHaveCount(0);

  // Put back (Edit info's write, version 3 → 4), checked on screen: a later repeat finds the mark again.
  expect((await facts(3, "help")).status()).toBe(200);
  await page.reload();
  await expect(group).toContainText(
    new RegExp(`Since ${usDay(daysAgo(0))} · added by ${isolated(`Officer ${w.tag}`)}`),
  );
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
