// A member tells their officers their time zone and languages (D154): on their own page they tap "Use this
// phone's time zone" and a language, and Send; the officer then sees both on the member's card, said by the
// member and apart from what the card holds, puts the languages on the card and marks the time zone seen,
// which a reload keeps. Phone only, on the repeat's own filler workspace
// (selfReportOf), so no other test's card or Home shows it. Put back: the member takes it back and the
// officer marks that seen. The languages stay on the card: the slot, like the others, is sized for 3 repeats.
import type { Page } from "@playwright/test";

import { daysAgo, selfReportOf, usDay } from "./fixtures/seed";
import {
  deskFrame,
  expect,
  hydrated,
  noError,
  savedAndRefreshed,
  sees,
  signIn,
  test,
} from "./fixtures/test";

test("a member's time zone and languages sent from Me show on their card as self-reported; “Put on the card” and “Seen, keep the card” hold after a reload", async ({
  context,
  page,
}, info) => {
  test.skip(info.project.name !== "phone", "one workspace per repeat, written once");
  const m = selfReportOf(info.repeatEachIndex);
  const w = m.workspace;
  const cookie = `__Host-lap_ws.${w.slug}`;
  const today = usDay(daysAgo(0));
  // The browser's zone (playwright.config.ts: Europe/London), as the card writes it in November.
  const zone = "Europe/London · UTC+0";

  /** The member, on their own page: the form's region. */
  const asMember = async () => {
    await context.clearCookies();
    await signIn(context, "a", "member", cookie, m.token);
    await page.goto(`/w/${w.slug}/board/me`);
    await expect(page.getByRole("heading", { level: 1, name: "Your page" })).toBeVisible();
    await noError(page);
    return page.getByRole("region", { name: "Tell your officers" });
  };
  /** The officer, on the member's card (a sheet at 360 px). */
  const asOfficer = async () => {
    await context.clearCookies();
    await signIn(context, "a", "officer", cookie, w.token);
    await page.goto(`/w/${w.slug}/members?m=${m.uid}`);
    await deskFrame(page, w);
    const card = page.getByRole("dialog", { name: m.name });
    await expect(card.getByRole("heading", { name: m.name, level: 2 })).toBeVisible();
    return card;
  };
  /** One field's line in the card's "Sent by the member" block. */
  const lineOf = (card: ReturnType<Page["getByRole"]>, field: string) =>
    card
      .getByRole("region", { name: "Sent by the member" })
      .getByRole("listitem")
      .filter({ hasText: field });
  /** Taps `button` on the field's line and sees the block's outcome line for it. */
  const answerOn = async (
    card: ReturnType<Page["getByRole"]>,
    field: string,
    button: string,
    outcome: string,
  ) => {
    const tap = lineOf(card, field).getByRole("button", { name: button });
    await hydrated(tap);
    await tap.click();
    const block = card.getByRole("region", { name: "Sent by the member" });
    await sees(block.getByRole("status").filter({ hasText: field }), `${field} · ${outcome}`);
  };
  const markSeen = (card: ReturnType<Page["getByRole"]>) =>
    answerOn(card, "Time zone", "Seen, keep the card", "Seen. The card stays as it is.");

  // The member sends the phone's zone.
  let form = await asMember();
  const phone = form.getByRole("button", { name: "Use this phone’s time zone (London)" });
  await hydrated(phone);
  await phone.click();
  await expect(form.getByRole("button", { name: /Your time zone/ })).toContainText("Europe/London");
  await form.getByRole("button", { name: "Português (Portuguese)" }).click();
  const send = form.getByRole("button", { name: "Send to your officers" });
  await savedAndRefreshed(page, `/w/${w.slug}/board/me`, () => send.click());
  await sees(form.getByRole("status"), "Sent. Your officers see it on your member card.");
  await sees(form, `You sent this on ${today} · not seen yet`);
  await page.reload();
  await sees(form, `You sent this on ${today} · not seen yet`);

  // The officer sees both said by the member, apart from the card's own value; puts the languages on the
  // card and marks the time zone seen.
  let card = await asOfficer();
  for (const [field, says] of [
    ["Time zone", zone],
    ["Languages", "Portuguese"],
  ] as const) {
    const line = lineOf(card, field);
    await sees(line, "New");
    await sees(line, `Member says: ${says}`);
    await sees(line, `Self-reported · ${today}`);
    await sees(line, "On the card: nothing yet");
  }
  await answerOn(card, "Languages", "Put on the card", "Put on the card.");
  await markSeen(card);
  await page.reload();
  card = page.getByRole("dialog", { name: m.name });
  await expect(card.getByRole("heading", { name: m.name, level: 2 })).toBeVisible();
  // The card is read (its tabs show) before the block is checked gone, so a card still loading cannot pass.
  await expect(card.getByRole("tab", { name: "Info" })).toBeVisible();
  await expect(card.getByRole("region", { name: "Sent by the member" })).toHaveCount(0);
  await card.getByRole("tab", { name: "Info" }).click();
  const infoTab = card.getByRole("tabpanel");
  await sees(infoTab, `Member says: ${zone} · ${today} · not on the card`);
  // The languages are the card's own fact now, said to come from the member.
  await sees(infoTab.getByRole("definition").filter({ hasText: "Portuguese" }), "from the member");

  // The member sees that an officer has seen it, never what the card holds.
  form = await asMember();
  await sees(form, `You sent this on ${today} · an officer has seen it`);

  // Put back: the member takes it back, the officer marks that seen.
  const clear = form.getByRole("button", { name: "Clear" });
  await hydrated(clear);
  await clear.click();
  await savedAndRefreshed(page, `/w/${w.slug}/board/me`, () => send.click());
  await sees(form, `You took back what you sent, on ${today} · not seen yet`);
  card = await asOfficer();
  await sees(
    card.getByRole("region", { name: "Sent by the member" }),
    "Member took back what they sent",
  );
  await markSeen(card);
});
