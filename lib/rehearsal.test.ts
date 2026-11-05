import { describe, expect, it } from "vitest";

import { rehearsalVerdict } from "./rehearsal";
import type { VerdictPhase } from "./repo/rehearsals";

const BEFORE_AT = new Date("2026-11-04T12:15:00Z");
const AFTER_AT = new Date("2026-11-04T12:45:00Z");
const at = (base: Date, seconds: number) => new Date(base.getTime() + seconds * 1000);

/** A clean run of three alliances: 4 calls (quota check + 3 reads), quota 900 → 897. */
function phase(scheduledAt: Date, overrides: Partial<VerdictPhase> = {}): VerdictPhase {
  const startedAt = at(scheduledAt, 180);
  return {
    status: "complete",
    scheduledAt,
    startedAt,
    callsUsed: 4,
    quotaRemainingBefore: 900,
    quotaRemainingAfter: 897,
    quotaUnseenCalls: 0,
    durationMs: 15_000,
    alliances: [1, 2, 3].map((unionId) => ({
      unionId,
      tag: `A${unionId}`,
      isFresh: true,
      sourceUpdatedAt: at(startedAt, unionId),
    })),
    ...overrides,
  };
}

describe("rehearsalVerdict", () => {
  it("passes a complete, fresh pair whose rosters advanced and whose calls match the quota drop", () => {
    const verdict = rehearsalVerdict({ before: phase(BEFORE_AT), after: phase(AFTER_AT) }, 45);

    expect(verdict.pass).toBe(true);
    expect(verdict.lines.map((l) => l.text)).toEqual([
      "both snapshots complete",
      "every alliance fresh in both (before 3/3, after 3/3)",
      "data time moved forward for every alliance (3/3)",
      "calls used = quota drop (before 4 = 4, after 4 = 4)",
      "each run under 120 s (before 15.0 s, after 15.0 s)",
      "started within 45 min of schedule (before +3 min, after +3 min)",
    ]);
  });

  it("fails naming the alliance whose source_updated_at did not advance", () => {
    const before = phase(BEFORE_AT);
    const after = phase(AFTER_AT);
    const stuck = after.alliances[1];
    if (stuck) stuck.sourceUpdatedAt = before.alliances[1]?.sourceUpdatedAt ?? null;

    const verdict = rehearsalVerdict({ before, after }, 45);

    expect(verdict.pass).toBe(false);
    expect(verdict.lines.filter((l) => !l.ok).map((l) => l.text)).toEqual([
      "data time did not move forward: A2",
    ]);
  });

  it("fails naming the numbers when calls_used differs from the quota drop", () => {
    // Someone else used the key during AFTER: 4 calls, but quota fell by 6.
    const after = phase(AFTER_AT, { quotaRemainingAfter: 895 });

    const verdict = rehearsalVerdict({ before: phase(BEFORE_AT), after }, 45);

    expect(verdict.pass).toBe(false);
    expect(verdict.lines.filter((l) => !l.ok).map((l) => l.text)).toEqual([
      "calls used ≠ quota drop: after 4 ≠ 6",
    ]);
  });

  it("passes when calls_used equals the quota drop plus the attempts that returned no quota", () => {
    // The last alliance's /v1 attempt failed (503, no quota) and the internal fallback filled it.
    const after = phase(AFTER_AT, {
      callsUsed: 21,
      quotaRemainingBefore: 900,
      quotaRemainingAfter: 881,
      quotaUnseenCalls: 1,
    });

    const verdict = rehearsalVerdict({ before: phase(BEFORE_AT), after }, 45);

    expect(verdict.pass).toBe(true);
    expect(verdict.lines.map((l) => l.text)).toContain(
      "calls used = quota drop (before 4 = 4, after 21 = 20 + 1 without quota)",
    );
  });
});
