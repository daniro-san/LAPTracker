// Notices (D81, D102, issue 477 flow 4): an officer writes a notice, translates it with the stub's Groq
// (e2e/stub-server.mjs: each word backwards), saves it, and publishes it to the leaders' Discord channel, a
// webhook the stub takes. The stub's copy of the post holds the notice's text and no private roster field.
import { NOTICE_CHANNELS, STUB_URL } from "./env";
import { switchWorkspaceOf } from "./fixtures/seed";
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

const GROQ = "/groq/openai/v1/chat/completions";

interface Received {
  path: string;
  body: { content?: string; messages?: { content: string }[] };
  answer?: string;
}

test("Notices: an officer writes a notice, translates it, and posts it to the leaders' Discord channel", async ({
  context,
  page,
  request,
}, info) => {
  // Phone only, on the repeat's own workspace and webhook: no other test reads its notices or its channel.
  test.skip(info.project.name !== "phone", "one project posts a workspace's notice");
  const w = switchWorkspaceOf(info.repeatEachIndex);
  const channel = NOTICE_CHANNELS[w.slug] as { url: string; name: string };
  const hook = new URL(channel.url).pathname.replace(/^\/api\/webhooks\//, "/discord/webhooks/");
  const received = async () =>
    (await (await request.get(`${STUB_URL}/__stub/received`)).json()) as Received[];
  const title = `Gate drill for ${w.name}`;
  const text = "Meet by the north gate before the rally starts";
  await signIn(context, "a", "officer", `__Host-lap_ws.${w.slug}`, w.token);

  await page.goto(`/w/${w.slug}/notices/new`);
  await expect(page.getByRole("heading", { level: 1, name: "New notice" })).toBeVisible();
  await deskFrame(page, w);
  const english = page.getByRole("textbox", { name: "English" });
  await hydrated(english);
  await page.getByLabel("Title").fill(title);
  await english.fill(text);
  await page.getByRole("button", { name: /^Translate/ }).click();

  // Each language's draft is the stub's answer to this text.
  const portuguese = page.getByRole("tab", { name: /^Português/ });
  await sees(portuguese, "Draft");
  const asked = (await received()).filter(
    (r) => r.path === GROQ && r.body.messages?.some((m) => m.content.includes(text)),
  );
  expect(asked.length).toBeGreaterThan(0);
  const translation = asked[0]?.answer as string;
  for (const name of ["Português", "Français"]) {
    await page.getByRole("tab", { name: new RegExp(`^${name}`) }).click();
    await expect(page.getByRole("textbox", { name })).toHaveValue(translation);
    await expect(page.getByText("Draft from Translate, not saved")).toBeVisible();
  }

  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page.getByRole("heading", { level: 1, name: title })).toBeVisible();
  const discord = page.getByRole("region", { name: "Discord" });
  await sees(discord, `A leadership notice goes to #${channel.name}.`);
  const publish = discord.getByRole("button", { name: "Publish to Discord" });
  await hydrated(publish);
  await publish.click();
  const sheet = page.getByRole("dialog", { name: `Post to #${channel.name}?` });
  await savedAndRefreshed(page, new URL(page.url()).pathname, () =>
    sheet.getByRole("button", { name: "Post", exact: true }).click(),
  );
  const postedLine = new RegExp(`Posted to #${channel.name} by ${isolated(`Officer ${w.tag}`)} · `);
  await expect(discord).toContainText(postedLine);
  await page.reload();
  await expect(discord).toContainText(postedLine);

  // What Discord got: the notice's title, its text and its translation, and no private roster field.
  const posted = (await received()).filter((r) => r.path === hook);
  expect(posted.length).toBeGreaterThan(0);
  const content = posted.map((r) => r.body.content ?? "").join("\n");
  expect(content).toContain(title);
  expect(content).toContain(text);
  expect(content).toContain(translation);
  const leaks = posted.flatMap((r) => leaksIn(`${STUB_URL}${r.path}`, JSON.stringify(r.body)));
  expect(leaks, "private roster fields in the post").toEqual([]);
});
