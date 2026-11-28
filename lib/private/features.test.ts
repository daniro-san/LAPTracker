// D126, D134: each workspace's features as served and its daily allowances. OGs keeps everything on with no cap
// (today's behaviour, from code, with no data row); a new workspace starts with the paid features off; a
// cap stops at N, starts again the next UTC day, and holds when requests arrive together at the boundary.
// D160: the plan joins the owner's layer; nothing is deleted when it leaves a feature out.
import { beforeAll, beforeEach, describe, expect, it } from "vitest";

import { OWN_ALLIANCE_ID } from "../../config/alliances";
import type { Db } from "../db";
import { openTestDb, truncateAll } from "../db.test-helpers";
import {
  setAllianceSwitch,
  setCap,
  setDefault,
  setPaused,
  setPlan,
  setSwitch,
  settingsById,
} from "../repo/workspace-features";
import { saveWorkspace } from "../repo/workspaces";
import { workspaceUsage } from "../schema-features";
import {
  FEATURES,
  isPremium,
  NEW_PLAN,
  NO_DEFAULTS,
  PLAN_FEATURES,
  SPENDS,
  storedSettings,
  TRACKER_CALLS,
  trackerEstimate,
} from "../workspace-features";
import { featuresBySlug, giveBackAllowance, useAllowance } from "./features";

const NOW = new Date("2026-11-19T23:59:00Z");
const NEXT_DAY = new Date("2026-11-20T00:01:00Z");

let db: Db;
beforeAll(async () => {
  db = await openTestDb();
});
beforeEach(async () => {
  await truncateAll(db);
  await saveWorkspace(db, {
    unionId: OWN_ALLIANCE_ID,
    slug: "ogs",
    discordGuildId: "1",
    leaderRoleIds: ["2"],
  });
  await saveWorkspace(db, {
    unionId: 67109944,
    slug: "nse",
    discordGuildId: "3",
    leaderRoleIds: ["4"],
  });
});

const served = async (slug: string) => {
  const features = await featuresBySlug(db, slug);
  if (!features) throw new Error(`no workspace ${slug}`);
  return features;
};

describe("defaults (D126)", () => {
  it("OGs has every feature on and no cap; a new workspace has the paid and tracker ones off", async () => {
    const ogs = await served("ogs");
    expect([...ogs.on].sort()).toEqual([...FEATURES].sort());
    expect(ogs.caps).toEqual({ ai: null, translate: null });
    const nse = await served("nse");
    // D160: a new workspace is on the free plan, so its premium features are off too.
    const paid = FEATURES.filter((f) => SPENDS[f] || TRACKER_CALLS[f] || isPremium(f));
    expect(paid.filter((f) => nse.on.has(f))).toEqual([]);
    expect(FEATURES.filter((f) => !paid.includes(f) && !nse.on.has(f))).toEqual([]);
    expect(nse.caps).toEqual({ ai: 20, translate: 20 });
  });

  it("a global pause turns a paid allowance's features off for OGs too, and Resume brings them back", async () => {
    await setPaused(db, "translate", true, NOW);
    const paused = await served("ogs");
    expect(paused.on.has("discord_translate_me")).toBe(false);
    expect(paused.on.has("notice_translate")).toBe(true);
    await setPaused(db, "translate", false, NOW);
    expect((await served("ogs")).on.has("discord_translate_me")).toBe(true);
  });
});

describe("useAllowance (D126)", () => {
  const ws = async (cap: number | null) => {
    await setCap(db, 1, "ai", cap, NOW);
    return { workspaceId: 1, features: await served("ogs") };
  };

  it("stops at the cap without counting, and starts again the next UTC day", async () => {
    const holder = await ws(3);
    expect(await useAllowance(db, holder, "ai", 2, NOW)).toBe("ok");
    // Two more would pass 3: refused, and nothing is counted, so one still fits.
    expect(await useAllowance(db, holder, "ai", 2, NOW)).toBe("cap_reached");
    expect(await useAllowance(db, holder, "ai", 1, NOW)).toBe("ok");
    expect(await useAllowance(db, holder, "ai", 1, NOW)).toBe("cap_reached");
    // Another allowance and another workspace count apart.
    expect(await useAllowance(db, holder, "translate", 5, NOW)).toBe("ok");
    expect(await useAllowance(db, holder, "ai", 3, NEXT_DAY)).toBe("ok");
    expect(await useAllowance(db, holder, "ai", 1, NEXT_DAY)).toBe("cap_reached");
  });

  it("lets at most N through when requests arrive together at the boundary", async () => {
    const holder = await ws(5);
    expect(await useAllowance(db, holder, "ai", 3, NOW)).toBe("ok");
    const answers = await Promise.all(
      Array.from({ length: 6 }, () => useAllowance(db, holder, "ai", 1, NOW)),
    );
    expect(answers.filter((a) => a === "ok")).toHaveLength(2);
    // No cap: every request counts and none is refused.
    const open = await ws(null);
    const free = await Promise.all(
      Array.from({ length: 4 }, () => useAllowance(db, open, "ai", 1, NOW)),
    );
    expect(free.every((a) => a === "ok")).toBe(true);
  });

  it("gives units back without going below 0, so they can be spent again", async () => {
    const holder = await ws(2);
    expect(await useAllowance(db, holder, "ai", 2, NOW)).toBe("ok");
    await giveBackAllowance(db, holder, "ai", 1, NOW);
    expect(await useAllowance(db, holder, "ai", 1, NOW)).toBe("ok");
    expect(await useAllowance(db, holder, "ai", 1, NOW)).toBe("cap_reached");
    await giveBackAllowance(db, holder, "ai", 5, NOW);
    expect(await db.select({ used: workspaceUsage.used }).from(workspaceUsage)).toEqual([
      { used: 0 },
    ]);
  });
});

describe("a feature added to the catalog later (D126)", () => {
  it("keeps the workspace's default: off for a paid one in a workspace that has a row, on for OGs", () => {
    // A row saved before `notice_fit` existed: only its own keys.
    const saved = {
      switches: { notice_translate: true, roll_call: false },
      caps: {},
      alliance: {},
    };
    const nse = storedSettings(67109944, saved, NO_DEFAULTS, NEW_PLAN);
    expect(nse.off).toContain("notice_fit");
    expect(nse.off).toContain("roll_call");
    expect(nse.off).not.toContain("notice_translate");
    expect(storedSettings(OWN_ALLIANCE_ID, saved, NO_DEFAULTS, NEW_PLAN).off).toEqual([
      "roll_call",
    ]);
  });
});

describe("two layers over the defaults (D134)", () => {
  it("a changed default moves every workspace on it, never one with its own value, nor OGs", async () => {
    await saveWorkspace(db, {
      unionId: 67110000,
      slug: "abc",
      discordGuildId: "5",
      leaderRoleIds: ["6"],
    });
    await setSwitch(db, 3, "thefts", true, NOW);
    await setDefault(db, "switches", "thefts", false, NOW);
    await setDefault(db, "caps", "ai", 50, NOW);
    expect((await served("nse")).on.has("thefts")).toBe(false);
    expect((await served("nse")).caps.ai).toBe(50);
    expect((await served("abc")).on.has("thefts")).toBe(true);
    expect((await served("ogs")).on.has("thefts")).toBe(true);
    // Back to the default: the workspace follows it again.
    await setSwitch(db, 3, "thefts", null, NOW);
    expect((await served("abc")).on.has("thefts")).toBe(false);
  });

  it("a feature is on only when the owner allows it and the alliance turns it on", async () => {
    await setPlan(db, 2, { plan: "premium", grandfathered: false });
    await setSwitch(db, 2, "squads", true, NOW);
    // Allowed, but tracker calls wait for the alliance's own yes.
    expect((await served("nse")).on.has("squads")).toBe(false);
    await setAllianceSwitch(db, 2, "squads", true, NOW);
    expect((await served("nse")).on.has("squads")).toBe(true);
    await setAllianceSwitch(db, 2, "thefts", false, NOW);
    expect((await served("nse")).on.has("thefts")).toBe(false);
    // The owner's "not allowed" wins over the alliance's "on".
    await setSwitch(db, 2, "squads", false, NOW);
    expect((await served("nse")).on.has("squads")).toBe(false);
  });

  it("estimates tracker calls from the members: squads every day, the shield check on Saturdays", () => {
    expect(trackerEstimate(new Set(["squads"]), 101)).toEqual({ daily: 108, peak: 108 });
    // D137: three shield reads (issue 827: the after-reset check); with the squads read on, Friday's
    // shield read is that day's squads read. Issue 861: the raid opponent's 6 calls a week at most.
    expect(trackerEstimate(new Set(["squads", "shield_check"]), 100)).toEqual({
      daily: 106,
      peak: 312,
    });
    expect(trackerEstimate(new Set(["shield_check"]), 100)).toEqual({ daily: 0, peak: 306 });
    expect(trackerEstimate(new Set(["thefts"]), 100)).toEqual({ daily: 0, peak: 0 });
    // Issue 833: the recruit check counts its whole daily cap, whatever the roster's size.
    expect(trackerEstimate(new Set(["recruit_check"]), 100)).toEqual({ daily: 20, peak: 20 });
  });
});

describe("plans (D160)", () => {
  const PREMIUM_PLAN = { plan: "premium", grandfathered: false } as const;
  const FREE_PLAN = { plan: "free", grandfathered: false } as const;

  it("maps each plan to its features: the core is free, premium is everything", () => {
    expect(PLAN_FEATURES.premium).toEqual(FEATURES);
    expect(PLAN_FEATURES.free).toEqual(FEATURES.filter((f) => !isPremium(f)));
    // The owner's examples are premium; privacy, safety, export, the board and Discord sending stay free.
    for (const f of [
      "garrison",
      "insights",
      "shield_check",
      "squads",
      "notice_translate",
    ] as const) {
      expect(PLAN_FEATURES.free).not.toContain(f);
    }
    for (const f of [
      "export",
      "board",
      "roll_call",
      "notices",
      "discord_send",
      "post_shield_up",
    ] as const) {
      expect(PLAN_FEATURES.free).toContain(f);
    }
  });

  it("hides a premium feature on the free plan, even allowed and turned on", async () => {
    // Insights spends nothing, so the owner's defaults allow it and the alliance's switch is on.
    expect((await served("nse")).on.has("insights")).toBe(false);
    expect((await served("nse")).on.has("thefts")).toBe(true);
  });

  it("unlocks it on the premium plan", async () => {
    await setPlan(db, 2, PREMIUM_PLAN);
    expect((await served("nse")).on.has("insights")).toBe(true);
  });

  it("keeps it for a grandfathered workspace on the free plan", async () => {
    await setPlan(db, 2, { plan: "free", grandfathered: true });
    expect((await served("nse")).on.has("insights")).toBe(true);
  });

  it("deletes nothing on a downgrade: every switch comes back as it was", async () => {
    await setPlan(db, 2, PREMIUM_PLAN);
    await setSwitch(db, 2, "squads", true, NOW);
    await setAllianceSwitch(db, 2, "squads", true, NOW);
    expect((await served("nse")).on.has("squads")).toBe(true);
    await setPlan(db, 2, FREE_PLAN);
    expect((await served("nse")).on.has("squads")).toBe(false);
    const stored = (await settingsById(db, 2))?.stored;
    expect([stored?.switches.squads, stored?.alliance.squads]).toEqual([true, true]);
    await setPlan(db, 2, PREMIUM_PLAN);
    expect((await served("nse")).on.has("squads")).toBe(true);
  });

  it("leaves OGs with every feature on, whatever its plan says", async () => {
    await setPlan(db, 1, FREE_PLAN);
    expect([...(await served("ogs")).on].sort()).toEqual([...FEATURES].sort());
  });
});
