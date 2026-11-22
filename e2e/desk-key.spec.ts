// Alliance settings → Tracker key (D124, issue 477 flow 7): an officer saves and tests the alliance's own key
// against the stub (e2e/stub-server.mjs), sees what the server says about it, then removes it. The key goes
// to the tracker in the Authorization header and comes back to the browser in no answer at all.
import { readFileSync } from "node:fs";

import { STUB_URL } from "./env";
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

/** The quota the stub answers a key's test with: the recorded fixture. */
const QUOTA = (
  JSON.parse(readFileSync("fixtures/v1-20261116T105019Z/quota-before.json", "utf8")) as {
    quota: { remaining: number };
  }
).quota;

test("Tracker key: an officer saves and tests a key, no answer carries it, and Remove takes it away", async ({
  context,
  page,
  request,
}, info) => {
  // Phone only, on the repeat's own workspace: the key is the workspace's, and no other test reads it.
  test.skip(info.project.name !== "phone", "one project saves a workspace's key");
  const w = switchWorkspaceOf(info.repeatEachIndex);
  // Invented, one per repeat, in the tracker's lap_ shape.
  const key = `lap_e2eInventedKey${w.tag}${"0".repeat(20)}${info.repeatEachIndex}x9Qz`;
  const last4 = key.slice(-4);
  const carrying: string[] = [];
  const reads: Promise<void>[] = [];
  page.on("response", (response) => {
    // A redirect has no body to read.
    if (response.status() >= 300 && response.status() < 400) return;
    reads.push(
      response.body().then(
        (body) => {
          if (body.includes(key)) carrying.push(response.url());
        },
        () => {
          carrying.push(`unreadable answer ${response.url()}`);
        },
      ),
    );
  });
  await signIn(context, "a", "officer", `__Host-lap_ws.${w.slug}`, w.token);
  const card = page.getByRole("region", { name: "Tracker key" });
  const settings = `/w/${w.slug}/settings`;
  await page.goto(settings);
  await expect(page.getByRole("heading", { level: 1, name: "Alliance settings" })).toBeVisible();
  await deskFrame(page, w);
  await sees(card, "No key yet. Squads from the tracker stay off until you add one.");

  const field = card.getByLabel("Your tracker key");
  await hydrated(field);
  await field.fill(key);
  await savedAndRefreshed(page, settings, () =>
    card.getByRole("button", { name: "Save and test" }).click(),
  );
  await sees(card.getByRole("status"), "Key saved and tested.");
  await sees(card, `Key set, ends in ••••${last4}`);
  await sees(card, "Working.");
  await sees(card, `Quota left: ${QUOTA.remaining}`);
  // The test went to the tracker on this key, in the header the tracker reads.
  const received = (await (await request.get(`${STUB_URL}/__stub/received`)).json()) as {
    path: string;
    authorization: string | null;
  }[];
  expect(received).toContainEqual({ path: "/v1/quota", authorization: `Bearer ${key}` });

  await page.reload();
  await sees(card, `Key set, ends in ••••${last4}`);
  await sees(card, "Working.");

  // Remove, so the workspace ends as it was seeded.
  const remove = card.getByRole("button", { name: "Remove" });
  await hydrated(remove);
  await remove.click();
  const ask = page.getByRole("alertdialog", { name: "Remove the tracker key?" });
  await savedAndRefreshed(page, settings, () =>
    ask.getByRole("button", { name: "Remove" }).click(),
  );
  await sees(card.getByRole("status"), "Key removed.");
  await page.reload();
  await sees(card, "No key yet. Squads from the tracker stay off until you add one.");
  await expect(card.getByText(`••••${last4}`)).toHaveCount(0);

  await Promise.all(reads);
  expect(reads.length).toBeGreaterThan(0);
  expect(carrying, "answers to the browser that carry the key").toEqual([]);
});
