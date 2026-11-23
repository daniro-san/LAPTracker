// "Send feedback" (D157): an officer sends a problem from the desk's Home and sees "Received, thank you.";
// the owner unlocks /admin/feedback with the PIN, finds it with its workspace, area and tier, marks it Read,
// and the status holds after a reload. Phone only: the feedback IP limit (5 a day) counts every repeat, and
// the text names the repeat so each finds its own row. The send carries a tiny generated PNG with an invented
// eXIf chunk (D157 amended 2026-11-22): the owner sees it on /admin/feedback, re-encoded, the chunk gone.
import { crc32, deflateSync } from "node:zlib";

import { SERVER_ENV } from "./env";
import { ALLIANCES } from "./fixtures/seed";
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

/** Invented metadata the browser's re-encode must drop (D119). */
const EXIF_MARKER = "INVENTED-EXIF-MARKER";

/** A 4 × 4 plain red PNG with an eXIf chunk holding EXIF_MARKER; nothing real in it. */
function tinyPng(): Buffer {
  const chunk = (type: string, data: Buffer) => {
    const length = Buffer.alloc(4);
    length.writeUInt32BE(data.length);
    const body = Buffer.concat([Buffer.from(type, "latin1"), data]);
    const crc = Buffer.alloc(4);
    crc.writeUInt32BE(crc32(body));
    return Buffer.concat([length, body, crc]);
  };
  const header = Buffer.alloc(13);
  header.writeUInt32BE(4, 0);
  header.writeUInt32BE(4, 4);
  header.set([8, 2, 0, 0, 0], 8);
  const rows = Buffer.concat(
    Array.from({ length: 4 }, () => Buffer.from([0, ...Array(4).fill([255, 0, 0]).flat()])),
  );
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", header),
    chunk("eXIf", Buffer.from(`MM\0*${EXIF_MARKER}`, "latin1")),
    chunk("IDAT", deflateSync(rows)),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

test("an officer's feedback from the desk says “Received, thank you.” and the owner finds it on /admin/feedback and marks it Read, which a reload keeps", async ({
  context,
  page,
}, info) => {
  test.skip(info.project.name !== "phone", "the IP limit counts every send");
  const a = ALLIANCES.a;
  const text = `The roll call list jumps back to the top after a save (repeat ${info.repeatEachIndex})`;

  await signIn(context, "a", "officer");
  await page.goto(`/w/${a.slug}`);
  await deskFrame(page, a);
  const open = page.getByRole("button", { name: "Send feedback" });
  await hydrated(open);
  await open.click();
  const sheet = page.getByRole("dialog", { name: "Send feedback" });
  await expect(sheet.getByText("They read it without your name and do not reply.")).toBeVisible();
  const send = sheet.getByRole("button", { name: "Send", exact: true });
  await expect(send).toBeDisabled();
  await sheet.getByRole("radio", { name: "Problem" }).check();
  await sheet.getByRole("textbox", { name: "Your message" }).fill(text);
  await expect(sheet.getByText(`${text.length} of 1,000 characters`)).toBeVisible();
  await expect(sheet.getByText("Picture (optional)")).toBeVisible();
  await expect(
    sheet.getByText("Leave out screens that show members’ map positions or online times.", {
      exact: false,
    }),
  ).toBeVisible();
  const add = sheet.getByRole("button", { name: "Add a picture" });
  expect((await add.boundingBox())?.height).toBeGreaterThanOrEqual(44);
  const chooser = page.waitForEvent("filechooser");
  await add.click();
  await (await chooser).setFiles({ name: "screen.png", mimeType: "image/png", buffer: tinyPng() });
  await expect(sheet.getByRole("img", { name: "The picture you chose" })).toBeVisible();
  await expect(sheet.getByRole("button", { name: "Remove the picture" })).toBeVisible();
  // The answer read whole before the page moves on, so the guards can check it.
  const answer = page.waitForResponse(
    (r) =>
      new URL(r.url()).pathname === `/api/w/${a.slug}/feedback` && r.request().method() === "POST",
  );
  await send.click();
  await (await answer).finished();
  await sees(sheet.getByRole("status"), "Received, thank you.");
  await expect(sheet.getByRole("textbox", { name: "Your message" })).toHaveCount(0);

  // The owner: the PIN card first, then the list.
  await page.goto("/admin/feedback");
  await page
    .getByLabel("Admin PIN", { exact: true })
    .and(page.locator("input"))
    .fill(SERVER_ENV.EDIT_PIN ?? "");
  await page.getByRole("button", { name: "Unlock" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Feedback" })).toBeVisible();
  await noError(page);
  const item = page.getByRole("listitem").filter({ hasText: text });
  await expect(item).toHaveCount(1);
  await sees(item, `/w/${a.slug} · desk · officer · en`);
  await expect(item.getByText("Problem", { exact: true })).toBeVisible();
  const picture = item.getByRole("img", { name: "The picture sent with it" });
  await expect(picture).toBeVisible();
  // Re-encoded in the browser (D119), so the invented metadata never reached the server.
  const served = await page.request.get((await picture.getAttribute("src")) ?? "");
  expect(served.status()).toBe(200);
  expect(served.headers()["content-type"]).toMatch(/^image\/(webp|jpeg)$/);
  expect((await served.body()).includes(EXIF_MARKER)).toBe(false);
  await expect(item.getByRole("button", { name: "New" })).toHaveAttribute("aria-pressed", "true");
  const read = item.getByRole("button", { name: "Read" });
  await hydrated(read);
  const saved = page.waitForResponse(
    (r) => new URL(r.url()).pathname === "/api/admin/feedback" && r.request().method() === "POST",
  );
  await savedAndRefreshed(page, "/admin/feedback", () => read.click());
  await (await saved).finished();
  await expect(read).toHaveAttribute("aria-pressed", "true");
  await page.reload();
  const again = page.getByRole("listitem").filter({ hasText: text });
  await expect(again.getByRole("button", { name: "Read" })).toHaveAttribute("aria-pressed", "true");
  await expect(again.getByRole("button", { name: "New" })).toHaveAttribute("aria-pressed", "false");
});

// The floating badge (issue 713): from 1280, where the desk's sidebar shows, a "Feedback" badge opens the same
// sheet; below it, only the end-of-page button.
test("from 1280 a “Feedback” badge opens the same sheet and gives way to it, and the end-of-page button stays", async ({
  context,
  page,
}, info) => {
  test.skip(info.project.name !== "wide", "the badge shows from 1280");
  const a = ALLIANCES.a;
  await signIn(context, "a", "officer");
  await page.goto(`/w/${a.slug}`);
  await deskFrame(page, a);
  const badge = page.getByRole("button", { name: "Feedback", exact: true });
  const end = page.getByRole("button", { name: "Send feedback" });
  await expect(badge).toBeVisible();
  await expect(end).toHaveCount(1);
  expect((await badge.boundingBox())?.height).toBeGreaterThanOrEqual(44);
  await hydrated(badge);
  await badge.click();
  const sheet = page.getByRole("dialog", { name: "Send feedback" });
  await expect(sheet.getByText("They read it without your name and do not reply.")).toBeVisible();
  await expect(badge).toHaveCount(0);
  await sheet.getByRole("button", { name: "Close" }).first().click();
  await expect(sheet).toHaveCount(0);
  await expect(badge).toBeVisible();
});

test("on a phone there is no floating “Feedback” badge, only the end-of-page button", async ({
  context,
  page,
}, info) => {
  test.skip(info.project.name !== "phone", "the badge shows from 1280");
  const a = ALLIANCES.a;
  await signIn(context, "a", "officer");
  await page.goto(`/w/${a.slug}`);
  await deskFrame(page, a);
  await expect(page.getByRole("button", { name: "Send feedback" })).toHaveCount(1);
  await expect(page.getByRole("button", { name: "Feedback", exact: true })).toHaveCount(0);
});
