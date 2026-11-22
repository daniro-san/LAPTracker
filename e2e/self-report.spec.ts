// A member tells their officers their time zone (D154): on their own page they tap "Use this phone's time
// zone" and Send; the officer then sees it on the member's card, said by the member and apart from what the
// card holds, and marks it seen, which a reload keeps. Phone only, on the repeat's own filler workspace
// (selfReportOf), so no other test's card or Home shows it. Put back: the member takes it back and the
// officer marks that seen, so the next run starts from an empty form.
import type { Page } from "@playwright/test";

import { daysAgo, selfReportOf, usDay } from "./fixtures/seed";
import { deskFrame, expect, hydrated, noError, sees, signIn, test } from "./fixtures/test";

/** Waits until the page's refresh of `path` (router.refresh, an RSC answer) has come in whole. */
async function refreshedAfter(page: Page, path: string, action: () => Promise<void>) {
  const refreshed = page.waitForResponse(
    (r) => new URL(r.url()).pathname === path && r.request().headers()["rsc"] === "1",
  );
  await action();
  await (await refreshed).finished();
}

test("a member's time zone sent from Me shows on their card as self-reported, and “Seen, keep the card” holds after a reload", async ({
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
  const markSeen = async (card: ReturnType<Page["getByRole"]>) => {
    const block = card.getByRole("region", { name: "Sent by the member" });
    const seen = block.getByRole("button", { name: "Seen, keep the card" });
    await hydrated(seen);
    await seen.click();
    await sees(block.getByRole("status"), "Time zone · Seen. The card stays as it is.");
  };

  // The member sends the phone's zone.
  let form = await asMember();
  const phone = form.getByRole("button", { name: "Use this phone’s time zone (London)" });
  await hydrated(phone);
  await phone.click();
  await expect(form.getByRole("button", { name: /Your time zone/ })).toContainText("Europe/London");
  const send = form.getByRole("button", { name: "Send to your officers" });
  await refreshedAfter(page, `/w/${w.slug}/board/me`, () => send.click());
  await sees(form.getByRole("status"), "Sent. Your officers see it on your member card.");
  await sees(form, `You sent this on ${today} · not seen yet`);
  await page.reload();
  await sees(form, `You sent this on ${today} · not seen yet`);

  // The officer sees it said by the member, apart from the card's own value, and marks it seen.
  let card = await asOfficer();
  const block = card.getByRole("region", { name: "Sent by the member" });
  await sees(block, "Time zone");
  await sees(block, "New");
  await sees(block, `Member says: ${zone}`);
  await sees(block, `Self-reported · ${today}`);
  await sees(block, "On the card: nothing yet");
  await markSeen(card);
  await page.reload();
  card = page.getByRole("dialog", { name: m.name });
  await expect(card.getByRole("heading", { name: m.name, level: 2 })).toBeVisible();
  // The card is read (its tabs show) before the block is checked gone, so a card still loading cannot pass.
  await expect(card.getByRole("tab", { name: "Info" })).toBeVisible();
  await expect(card.getByRole("region", { name: "Sent by the member" })).toHaveCount(0);
  await card.getByRole("tab", { name: "Info" }).click();
  await sees(card.getByRole("tabpanel"), `Member says: ${zone} · ${today} · not on the card`);

  // The member sees that an officer has seen it, never what the card holds.
  form = await asMember();
  await sees(form, `You sent this on ${today} · an officer has seen it`);

  // Put back: the member takes it back, the officer marks that seen.
  const clear = form.getByRole("button", { name: "Clear" });
  await hydrated(clear);
  await clear.click();
  await refreshedAfter(page, `/w/${w.slug}/board/me`, () => send.click());
  await sees(form, `You took back what you sent, on ${today} · not seen yet`);
  card = await asOfficer();
  await sees(
    card.getByRole("region", { name: "Sent by the member" }),
    "Member took back what they sent",
  );
  await markSeen(card);
});
