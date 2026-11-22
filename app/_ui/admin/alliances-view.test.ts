import { describe, expect, it } from "vitest";

import { OWN_ALLIANCE_ID } from "@/config/alliances";
import type { AdminFeatures } from "@/lib/queries/workspace-features";
import type { AdminWorkspace } from "@/lib/queries/workspaces";
import { NO_DEFAULTS } from "@/lib/workspace-features";

import { allianceChoices, allianceRow, byAttention, keyState } from "./alliances-view";
import type { FeaturesView } from "./WorkspaceFeatures";

const NOW = new Date("2026-11-20T15:00:00Z");
const FP = "fp-now";

const workspace = (over: Partial<AdminWorkspace> = {}): AdminWorkspace => ({
  id: 1,
  slug: "amber",
  unionId: 101,
  discordGuildId: "1",
  leaderRoleIds: [],
  memberRoleIds: ["700000000000000204"],
  openSessions: 0,
  allowlist: [],
  signedIn: [],
  trackerKey: { set: false, status: "unset", statusAt: null, masterFp: null },
  deletion: null,
  discord: { botSeen: false, commands: null, webhooks: [] },
  ...over,
});
const key = (status: AdminWorkspace["trackerKey"]["status"], statusAt = NOW, masterFp = FP) =>
  workspace({ trackerKey: { set: true, status, statusAt, masterFp } });

const features: AdminFeatures = {
  settings: new Map(),
  defaults: NO_DEFAULTS,
  usage: new Map(),
  paused: [],
  members: new Map(),
};
const view = (over: Partial<FeaturesView> = {}): FeaturesView => ({
  off: [],
  changed: [],
  allianceOff: [],
  on: 0,
  caps: { ai: 20, translate: null },
  defaultOff: [],
  defaultCaps: { ai: 20, translate: 20 },
  changedCaps: [],
  used: { ai: 0, translate: 0 },
  estimate: "",
  ...over,
});
const row = (
  w: AdminWorkspace,
  v = view(),
  errors24h = 0,
  read: { first_read: Date | null; readSince: boolean } = { first_read: NOW, readSince: true },
) =>
  allianceRow({
    w,
    alliance: "AMB",
    features,
    view: v,
    usage: {
      callsToday: 40,
      calls7d: 300,
      postsToday: 2,
      postsFailed: 0,
      errors24h,
      officerSeenAt: null,
      setup: {
        created: NOW,
        member_role: w.memberRoleIds.length > 0 ? "done" : null,
        first_read: read.first_read,
        key_saved: null,
        webhook: null,
        first_roll_call: null,
        first_notice: null,
      },
      readSince: read.readSince,
    },
    current: FP,
    now: NOW,
    ago: () => "",
  });

describe("keyState (D124, as the squads read sees it)", () => {
  it("reads a key under another master key as re-enter, a refused one as paused, a usable one as ok", () => {
    expect(keyState(key("ok", NOW, "fp-old"), true, FP, NOW)).toMatchObject({
      state: "reenter",
      look: "key",
    });
    expect(keyState(key("invalid"), true, FP, NOW)).toMatchObject({
      state: "paused",
      note: "the tracker refused it",
      look: "key",
    });
    // Out of quota today mends itself at 00:00 UTC: it ranks with a used-up daily limit.
    expect(keyState(key("out_of_quota"), true, FP, NOW)).toMatchObject({
      state: "paused",
      look: "cap",
    });
    // Out of quota yesterday: usable again after 00:00 UTC.
    const yesterday = new Date("2026-11-19T23:50:00Z");
    expect(keyState(key("out_of_quota", yesterday), true, FP, NOW)).toMatchObject({
      state: "ok",
      which: "own",
    });
  });

  it("reads no key as fine for the own alliance (the site's key) and as a problem when the squads read is on", () => {
    expect(keyState(workspace({ unionId: OWN_ALLIANCE_ID }), true, FP, NOW)).toMatchObject({
      state: "none",
      which: "site",
      look: null,
    });
    expect(keyState(workspace(), true, FP, NOW)).toMatchObject({ look: "key" });
    expect(keyState(workspace(), false, FP, NOW)).toMatchObject({ look: null });
  });

  it("with the keys off, follows squadsKey: the own alliance on the site's key, a saved key unused and not a reason", () => {
    const own = { ...key("ok"), unionId: OWN_ALLIANCE_ID };
    expect(keyState(own, true, null, NOW)).toMatchObject({ which: "site", look: null });
    expect(keyState(key("ok"), true, null, NOW)).toMatchObject({
      state: "none",
      note: "keys are off on this site",
      which: "none",
      look: null,
    });
  });
});

describe("allianceRow (issue 485)", () => {
  it("counts the calls against its own key's 1,000 and marks a daily limit used up", () => {
    const r = row(key("ok"), view({ used: { ai: 20, translate: 7 } }));
    expect(r.calls.today).toBe("40 of 1,000 today");
    expect(r.allowances.ai).toEqual({ text: "20 of 20", usedUp: true });
    expect(r.allowances.translate).toEqual({ text: "7 · no cap", usedUp: false });
    expect(r.attention).toEqual(["cap"]);
    expect(r.reason).toBe("Daily limit used up");
  });

  it("counts the owner's changes from the defaults and the features the alliance turned off", () => {
    const v = view({ changed: ["ocr", "squads"], changedCaps: ["ai"], allianceOff: ["thefts"] });
    expect(row(workspace(), v).changed).toBe("3 changed by you · 1 turned off by the alliance");
    expect(row(workspace()).changed).toBe("defaults");
  });
});

describe("setup gaps (issue 585, F12)", () => {
  it("counts no member role, and no read once a daily read since the workspace was made has finished, as setup to do", () => {
    const closed = workspace({ memberRoleIds: [] });
    expect(row(closed)).toMatchObject({
      attention: ["setup"],
      gaps: ["member_role"],
      reason: "Setup: no member role",
    });
    // A daily read finished since it was made, and still no roster of its alliance that did not fail.
    expect(row(workspace(), view(), 0, { first_read: null, readSince: true })).toMatchObject({
      gaps: ["first_read"],
      reason: "Setup: no read yet",
    });
    // Made after the newest finished read began: the next daily read takes it, nothing to do yet.
    expect(row(workspace(), view(), 0, { first_read: null, readSince: false })).toMatchObject({
      attention: [],
      gaps: [],
      reason: "",
    });
    expect(row(closed, view(), 0, { first_read: null, readSince: true }).gaps).toEqual([
      "member_role",
      "first_read",
    ]);
  });
});

describe("allianceChoices (F13)", () => {
  it("keeps a workspace's own alliance in the select, by its id, when no board or roster names it yet", () => {
    const known = [{ unionId: 101, label: "AMB · Amber Hall" }];
    expect(allianceChoices(known, [101, 900802, 900802])).toEqual([
      { unionId: 101, label: "AMB · Amber Hall" },
      { unionId: 900802, label: "900802 · not read yet" },
    ]);
  });
});

describe("byAttention", () => {
  it("puts a key that cannot be used first, then errors, then setup, then a used-up limit, then the rest by address", () => {
    const full = view({ used: { ai: 20, translate: 0 } });
    const rows = [
      row(workspace({ id: 1, slug: "a-fine" })),
      row(workspace({ id: 2, slug: "b-cap" }), full),
      row(workspace({ id: 3, slug: "c-errors" }), view(), 2),
      row({ ...key("invalid"), id: 4, slug: "d-key" }),
      row(workspace({ id: 5, slug: "e-setup", memberRoleIds: [] }), full),
    ];
    expect(rows.map((r) => r.reason)).toEqual([
      "",
      "Daily limit used up",
      "Page errors: 2",
      "Key: paused",
      "Setup: no member role",
    ]);
    expect(rows.sort(byAttention).map((r) => r.slug)).toEqual([
      "d-key",
      "c-errors",
      "e-setup",
      "b-cap",
      "a-fine",
    ]);
  });
});
