// "Send feedback" (D157): an officer sends a problem from the desk's Home and sees "Received, thank you.";
// the owner unlocks /admin/feedback with the PIN, finds it with its workspace, area and tier, marks it Read,
// and the status holds after a reload. Phone only: the feedback IP limit (5 a day) counts every repeat, and
// the text names the repeat so each finds its own row.
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
