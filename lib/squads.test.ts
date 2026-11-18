// The squads read's pure rules (D117): the quota it leaves (the KvK's quota day), the main squad, and when
// the tracker's main squad becomes a new "Main squad might" version.
import { describe, expect, it } from "vitest";

import { TEST_ENV } from "./app-context.test-helpers";
import { requiredQuota } from "./budget";
import {
  eventReserve,
  mainSquad,
  SQUADS_SAFETY_MARGIN,
  squadsReserve,
  trackerMightWrite,
} from "./squads";

// Server time is UTC−2; KvK is Saturday 10:00–14:00 server time (12:00–16:00 UTC), a sample every 15 min.
const CFG = { ...TEST_ENV, SAMPLE_EVERY_MIN: 15 };
const THU_NIGHT = new Date("2026-11-20T01:39:00Z"); // Thursday 23:39 server time
const FRI_NIGHT = new Date("2026-11-21T01:39:00Z"); // Friday 23:39 server time = Saturday UTC
const SAT_NIGHT = new Date("2026-11-22T01:39:00Z"); // Saturday 23:39 server time = Sunday UTC
const KVK_READS = requiredQuota(20) + 15 * 21; // Before + After, and 15 samples of 1 + 20 calls

describe("the squads read's quota guard (D117)", () => {
  it("keeps the KvK's reads on its quota day: Friday night's read spends from Saturday UTC", () => {
    expect(eventReserve(FRI_NIGHT, CFG, 20)).toBe(KVK_READS);
    expect(squadsReserve(FRI_NIGHT, CFG, 20)).toBe(SQUADS_SAFETY_MARGIN + KVK_READS);
  });

  it("leaves only the safety margin on other quota days, Saturday night included (KvK is over)", () => {
    expect(squadsReserve(THU_NIGHT, CFG, 20)).toBe(SQUADS_SAFETY_MARGIN);
    expect(squadsReserve(SAT_NIGHT, CFG, 20)).toBe(SQUADS_SAFETY_MARGIN);
    // Saturday UTC after the After: nothing of the event is left to keep.
    expect(eventReserve(new Date("2026-11-21T17:00:00Z"), CFG, 20)).toBe(0);
  });

  it("counts no samples when they are off", () => {
    expect(eventReserve(FRI_NIGHT, { ...CFG, SAMPLE_EVERY_MIN: 0 }, 20)).toBe(requiredQuota(20));
  });
});

describe("the main squad and its version (D117)", () => {
  const at = (iso: string) => new Date(iso);
  const squad = (n: number, power: number, seen: string | null = "2026-11-16T20:00:00Z") => ({
    squad: n,
    power,
    seenAt: seen === null ? null : at(seen),
    readAt: at("2026-11-17T01:40:00Z"),
  });

  it("is the strongest squad; a tie goes to the lower number", () => {
    expect(mainSquad([squad(2, 40), squad(1, 50), squad(3, 45)])?.squad).toBe(1);
    expect(mainSquad([squad(3, 50), squad(2, 50)])?.squad).toBe(2);
    expect(mainSquad([])).toBeNull();
  });

  it("writes only a different value, and never over an officer's value typed after the sighting", () => {
    const main = squad(1, 62_000_000);
    expect(trackerMightWrite(null, main)).toBe(true);
    const tracker = { source: "tracker", writtenAt: at("2026-11-15T01:40:00Z") };
    expect(trackerMightWrite({ ...tracker, value: 62_000_000 }, main)).toBe(false);
    expect(trackerMightWrite({ ...tracker, value: 60_000_000 }, main)).toBe(true);
    // An officer typed 63M after the tracker saw the squad: it stays.
    const typed = { value: 63_000_000, source: "officer", writtenAt: at("2026-11-16T21:00:00Z") };
    expect(trackerMightWrite(typed, main)).toBe(false);
    // The tracker sees the squad again later: a new version, the officer's stays in the history.
    expect(trackerMightWrite(typed, squad(1, 64_000_000, "2026-11-17T18:00:00Z"))).toBe(true);
    // No seen_at: our first read of that squad is the sighting.
    expect(trackerMightWrite(typed, squad(1, 64_000_000, null))).toBe(true);
    expect(trackerMightWrite({ ...typed, source: "sheet" }, main)).toBe(false);
  });
});
