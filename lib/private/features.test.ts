// D126: each workspace's features as served and its daily allowances. OGs keeps everything on with no cap
// (today's behaviour, from code, with no data row); a new workspace starts with the paid features off; a
// cap stops at N, starts again the next UTC day, and holds when requests arrive together at the boundary.
import { beforeAll, beforeEach, describe, expect, it } from "vitest";

import { OWN_ALLIANCE_ID } from "../../config/alliances";
import type { Db } from "../db";
import { openTestDb, truncateAll } from "../db.test-helpers";
import { setCap, setPaused } from "../repo/workspace-features";
import { saveWorkspace } from "../repo/workspaces";
import { allowancePauses, workspaceUsage } from "../schema-features";
import { FEATURES, SPENDS, storedSettings } from "../workspace-features";
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
  it("OGs has every feature on and no cap; a new workspace has the paid ones off", async () => {
    const ogs = await served("ogs");
    expect([...ogs.on].sort()).toEqual([...FEATURES].sort());
    expect(ogs.caps).toEqual({ ai: null, translate: null });
    const nse = await served("nse");
    const paid = FEATURES.filter((f) => SPENDS[f]);
    expect(paid.filter((f) => nse.on.has(f))).toEqual([]);
    expect(FEATURES.filter((f) => !SPENDS[f] && !nse.on.has(f))).toEqual([]);
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
    const saved = { notice_translate: true, roll_call: false };
    const caps = { ai: null, translate: null };
    const nse = storedSettings(67109944, saved, caps);
    expect(nse.off).toContain("notice_fit");
    expect(nse.off).toContain("roll_call");
    expect(nse.off).not.toContain("notice_translate");
    expect(storedSettings(OWN_ALLIANCE_ID, saved, caps).off).toEqual(["roll_call"]);
  });
});
