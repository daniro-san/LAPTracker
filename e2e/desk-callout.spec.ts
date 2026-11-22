// The alliance's own line on our posts (#713, D156): an officer saves a line for the garrison post in Alliance
// settings, it survives a reload, and the garrison plan posted to the leaders' Discord channel (a webhook
// the stub takes, e2e/stub-server.mjs) opens with it, above our title, with @everyone broken so it pings no
// one. Home then says who changed the line, never the text.
import { NOTICE_CHANNELS, STUB_URL } from "./env";
import { calendarOf, seededAt, SIEGE_ENTRY, switchWorkspaceOf, usDay } from "./fixtures/seed";
import {
  deskFrame,
  expect,
  hydrated,
  isolated,
  leaksIn,
  savedAndRefreshed,
  sees,
  signIn,
  test,
} from "./fixtures/test";

interface Received {
  path: string;
  body: { content?: string; allowed_mentions?: unknown };
}

test("Lines on our posts: an officer's line for the garrison post opens the plan posted to Discord", async ({
  context,
  page,
  request,
}, info) => {
  // Phone only, on the repeat's own workspace and siege: no other test reads its line or its garrison plan.
  test.skip(info.project.name !== "phone", "one project posts a workspace's garrison plan");
  const w = switchWorkspaceOf(info.repeatEachIndex);
  const channel = NOTICE_CHANNELS[w.slug] as { url: string; name: string };
  const hook = new URL(channel.url).pathname.replace(/^\/api\/webhooks\//, "/discord/webhooks/");
  const { raid } = calendarOf(seededAt());
  const line = `Hold the gates, ${w.name} @everyone`;
  await signIn(context, "a", "officer", `__Host-lap_ws.${w.slug}`, w.token);

  // Alliance settings: the line, its count, and its preview above our title.
  const settings = `/w/${w.slug}/settings`;
  await page.goto(settings);
  await expect(page.getByRole("heading", { level: 1, name: "Alliance settings" })).toBeVisible();
  await deskFrame(page, w);
  const card = page.getByRole("region", { name: "Your line on our posts" });
  const garrison = card.getByRole("group", { name: "Garrison post" });
  const field = garrison.getByRole("textbox", { name: "Garrison post" });
  await hydrated(field);
  await field.fill(line);
  await sees(garrison, `${line.length} of 120 characters`);
  await sees(garrison.getByRole("figure"), `${line} Garrison plan`);
  await savedAndRefreshed(page, settings, () => card.getByRole("button", { name: "Save" }).click());
  await sees(card.getByRole("status"), "Saved.");
  await page.reload();
  await expect(garrison.getByRole("textbox", { name: "Garrison post" })).toHaveValue(line);

  // The siege's garrison page: save the enemy might, then post the plan to the leaders' channel.
  const plan = `/w/${w.slug}/calendar/garrison?entry=${SIEGE_ENTRY + (info.repeatEachIndex % 3)}&week=${raid.week}`;
  await page.goto(plan);
  await expect(page.getByRole("heading", { level: 1, name: "Garrison plan" })).toBeVisible();
  const might = page.getByLabel("Enemy might");
  await hydrated(might);
  await might.fill("8");
  await page.getByRole("button", { name: "Save enemy might" }).click();
  const post = page.getByRole("button", { name: "Post to Discord" });
  await expect(post).toBeEnabled();
  await post.click();
  await sees(page.getByRole("status").filter({ hasText: "Posted" }), "Posted to Discord.");

  // What Discord got: our line first, @everyone broken, then our title; no mention allowed.
  const posted = (
    (await (await request.get(`${STUB_URL}/__stub/received`)).json()) as Received[]
  ).filter((r) => r.path === hook && r.body.content?.includes("**Garrison plan"));
  expect(posted).toHaveLength(1);
  const [first, title] = String(posted[0]?.body.content).split("\n");
  expect(first).toBe(line.replace("@everyone", "@\u200beveryone"));
  expect(title).toBe(`**Garrison plan · Undead Siege · Lv.6 · ${usDay(raid.day)}**`);
  expect(posted[0]?.body.allowed_mentions).toEqual({ parse: [] });
  expect(leaksIn(`${STUB_URL}${hook}`, JSON.stringify(posted[0]?.body))).toEqual([]);

  // Home's recent activity says who changed the line, never the line itself.
  await page.goto(`/w/${w.slug}`);
  const activity = page.getByRole("region", { name: "Recent activity" }).first();
  await expect(activity).toContainText(
    new RegExp(`${isolated(`Officer ${w.tag}`)} changed the line on the garrison post`),
  );
  await expect(activity).not.toContainText(line);
});
