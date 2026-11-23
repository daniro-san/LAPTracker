// The catalog of optional posts (#713 part C, D159): an officer finds "This week in the alliance" off in
// Alliance settings → Posts, turns it on for the leaders' channel with a title of the alliance's own, and the
// card's next-post line says when and where it goes; it survives a reload, and the page's index counts it on.
// The test then turns it off again, as it found it. The tick that sends the post cannot be driven here (the
// server runs on the real clock, and a tick only opens the database when something is due):
// app/api/tick/posts.test.ts drives POST /api/tick on a Monday and asserts the webhook post instead.
import { NOTICE_CHANNELS } from "./env";
import { switchWorkspaceOf } from "./fixtures/seed";
import {
  deskFrame,
  expect,
  hydrated,
  savedAndRefreshed,
  sees,
  signIn,
  test,
} from "./fixtures/test";

test("Posts: an officer turns This week in the alliance on for a channel, and it stays on after a reload", async ({
  context,
  page,
}, info) => {
  // Phone only, on the repeat's own workspace: no other test reads its posts.
  test.skip(info.project.name !== "phone", "one project changes a workspace's posts");
  const w = switchWorkspaceOf(info.repeatEachIndex);
  const leaders = (NOTICE_CHANNELS[w.slug] as { name: string }).name;
  await signIn(context, "a", "officer", `__Host-lap_ws.${w.slug}`, w.token);

  const settings = `/w/${w.slug}/settings`;
  await page.goto(settings);
  await expect(page.getByRole("heading", { level: 1, name: "Alliance settings" })).toBeVisible();
  await deskFrame(page, w);
  const card = page.getByRole("region", { name: "Posts", exact: true });
  const post = card.getByRole("group", { name: "This week in the alliance" });
  const next = post.getByRole("figure");
  const on = post.getByRole("checkbox", { name: "Post it" });
  const channel = post.getByRole("combobox", { name: "Channel" });
  const title = post.getByRole("textbox", { name: "Title" });

  // Off until the alliance turns it on (D159), with the members' channel not set up on this workspace.
  await hydrated(on);
  await expect(on).not.toBeChecked();
  await sees(next, "Off: nothing is posted.");
  await sees(post, "Every Monday: the calendar week starts then.");
  await expect(channel.getByRole("option", { name: "Members’ channel (not set up)" })).toHaveCount(
    1,
  );

  await on.check();
  await sees(
    next,
    "Nothing is posted until the members’ channel is set up: paste its webhook under Discord, above.",
  );
  await channel.selectOption({ label: `Leaders’ channel (#${leaders})` });
  await title.fill(`${w.name} this week`);
  await sees(post, `${w.name.length + 10} of 80 characters`);
  await sees(next, `Every Monday, between 00:00 and 01:15 ST, in #${leaders}.`);
  await savedAndRefreshed(page, settings, () => card.getByRole("button", { name: "Save" }).click());
  await sees(card.getByRole("status"), "Saved.");

  // After a reload: on, the leaders' channel, the title, and the page's index counts it.
  await page.reload();
  await expect(on).toBeChecked();
  await expect(channel).toHaveValue("leaders");
  await expect(title).toHaveValue(`${w.name} this week`);
  await sees(next, `Every Monday, between 00:00 and 01:15 ST, in #${leaders}.`);
  const index = page.getByRole("region", { name: "On this page" });
  await expect(index.getByRole("link", { name: "Posts 1 of 3 on", exact: true })).toBeVisible();

  // As the test found it: off.
  await hydrated(on);
  await on.uncheck();
  await savedAndRefreshed(page, settings, () => card.getByRole("button", { name: "Save" }).click());
  await page.reload();
  await expect(on).not.toBeChecked();
  await sees(next, "Off: nothing is posted.");
});
