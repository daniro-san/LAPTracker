// Alliance settings' "On this page" index (issue 585, F28): one row per card in page order, each with its state
// in words, and yarn only where something stops working (D75: a key is optional, so no key is no alarm).
import { describe, expect, it } from "vitest";

import { WORKSPACE_DICTIONARIES } from "@/lib/private/dictionary";

import { settingsIndex, type SettingsIndexInput } from "./settings-index";

const t = WORKSPACE_DICTIONARIES.en;

/** A workspace that has everything set up: key working, 19 of 20 features, 3 channels, summary posting. */
const ready: SettingsIndexInput = {
  key: "ok",
  features: { on: 19, allowed: 20 },
  shield: { discord: true, channel: "ok" },
  push: true,
  discord: { channels: ["set", "set", "set"], botOff: false },
  posts: { on: 1, n: 1 },
  callouts: { set: 1, n: 3 },
  data: { download: true, deletionDate: null },
};

const row = (input: SettingsIndexInput, id: string) =>
  settingsIndex(input, t).find((r) => r.id === id);

describe("Alliance settings' index", () => {
  it("lists every card the page shows, in page order, each with its state in words", () => {
    expect(settingsIndex(ready, t)).toEqual([
      { id: "tracker-key", label: "Tracker key", state: "Working", attention: false },
      { id: "features", label: "Features", state: "19 of 20 on", attention: false },
      {
        id: "raid-prep",
        label: "Raid Shield check",
        state: "Summary to Discord: on",
        attention: false,
      },
      { id: "push", label: "Notifications", state: null, attention: false },
      { id: "discord", label: "Discord", state: "3 of 3 channels set", attention: false },
      { id: "posts", label: "Posts", state: "1 of 1 on", attention: false },
      { id: "callouts", label: "Your line on our posts", state: "1 of 3 set", attention: false },
      { id: "workspace-data", label: "Your alliance’s data", state: null, attention: false },
    ]);

    // The Raid Shield check is off, the site has no push keys and no Discord app, no catalog post is
    // allowed, the lines on our posts and export are off.
    const plain = settingsIndex(
      {
        ...ready,
        key: "site",
        shield: null,
        push: false,
        discord: { channels: ["set", "none", "none"], botOff: true },
        posts: null,
        callouts: null,
        data: { download: false, deletionDate: null },
      },
      t,
    );
    expect(plain.map((r) => [r.id, r.state])).toEqual([
      ["tracker-key", "Site’s key"],
      ["features", "19 of 20 on"],
      ["discord", "1 of 3 channels set · commands off on this site"],
      ["workspace-delete-head", null],
    ]);
  });

  it("says a card needs a look only when something stops working", () => {
    expect(settingsIndex(ready, t).some((r) => r.attention)).toBe(false);
    // No key at all is a choice (D134), not a problem.
    expect(row({ ...ready, key: "none" }, "tracker-key")).toMatchObject({
      state: "Not set",
      attention: false,
    });
    for (const key of ["invalid", "out_of_quota", "reenter"] as const)
      expect(row({ ...ready, key }, "tracker-key")?.attention, key).toBe(true);
    expect(row({ ...ready, key: "invalid" }, "tracker-key")?.state).toBe("Refused");

    // A webhook the site can no longer open must be pasted again.
    expect(
      row({ ...ready, discord: { channels: ["set", "reenter", "set"], botOff: false } }, "discord")
        ?.attention,
    ).toBe(true);

    // The summary is switched on, but there is no Raid Shield channel to post it to.
    expect(
      row({ ...ready, shield: { discord: true, channel: "none" } }, "raid-prep"),
    ).toMatchObject({
      state: "Summary to Discord: on",
      attention: true,
    });
    // Off with no channel is fine: nothing is expected to post.
    expect(
      row({ ...ready, shield: { discord: false, channel: "none" } }, "raid-prep"),
    ).toMatchObject({
      state: "Summary to Discord: off",
      attention: false,
    });

    expect(
      row({ ...ready, data: { download: true, deletionDate: "Sun, Dec 6" } }, "workspace-data"),
    ).toMatchObject({ state: "Deletion asked: Sun, Dec 6", attention: true });
  });
});
