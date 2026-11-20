// D126, D134: each workspace's features as served and its daily allowances. OGs keeps everything on with no cap
// (today's behaviour, from code, with no data row); a new workspace starts with the paid features off; a
// cap stops at N, starts again the next UTC day, and holds when requests arrive together at the boundary.
import { beforeAll, beforeEach, describe, expect, it } from "vitest";

import { OWN_ALLIANCE_ID } from "../../config/alliances";
import type { Db } from "../db";
import { openTestDb, truncateAll } from "../db.test-helpers";
import {
  setAllianceSwitch,
  setCap,
  setDefault,
  setPaused,
  setSwitch,
} from "../repo/workspace-features";
import { saveWorkspace } from "../repo/workspaces";
import { allowancePauses, workspaceUsage } from "../schema-features";
import {
  FEATURES,
  NO_DEFAULTS,
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
  await db.delete(allowancePauses);
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
    const paid = FEATURES.filter((f) => SPENDS[f] || TRACKER_CALLS[f]);
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
    const nse = storedSettings(67109944, saved, NO_DEFAULTS);
    expect(nse.off).toContain("notice_fit");
    expect(nse.off).toContain("roll_call");
    expect(nse.off).not.toContain("notice_translate");
    expect(storedSettings(OWN_ALLIANCE_ID, saved, NO_DEFAULTS).off).toEqual(["roll_call"]);
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
    // D137: with the squads read on, Friday's shield read is that day's squads read.
    expect(trackerEstimate(new Set(["squads", "shield_check"]), 100)).toEqual({
      daily: 106,
      peak: 206,
    });
    expect(trackerEstimate(new Set(["shield_check"]), 100)).toEqual({ daily: 0, peak: 200 });
    expect(trackerEstimate(new Set(["thefts"]), 100)).toEqual({ daily: 0, peak: 0 });
  });
});
