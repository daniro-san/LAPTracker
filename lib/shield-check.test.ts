// The Raid Shield check's rules (D137): when each read runs on the server clock (UTC−2 here), and what a
// reading says about a shield's end.
import { describe, expect, it } from "vitest";

import { TEST_ENV } from "./app-context.test-helpers";
import {
  mayEndBeforeKvk,
  morningMinuteOf,
  shieldEndsBy,
  shieldPassAt,
  shieldWindowOpen,
} from "./shield-check";

const at = (iso: string) => new Date(iso);
const pass = (iso: string, morning = 600) => shieldPassAt(at(iso), TEST_ENV, morning)?.pass ?? null;

describe("the Raid Shield check's rules (D137)", () => {
  it("runs Friday from 23:30 ST until the reset, and Saturday from the morning time until 12:00 ST", () => {
    expect(pass("2026-11-21T01:29:00Z")).toBeNull(); // Fri 23:29 ST
    expect(shieldPassAt(at("2026-11-21T01:30:00Z"), TEST_ENV, 600)).toEqual({
      pass: "night",
      day: "2026-11-20",
      endsAt: at("2026-11-21T02:00:00Z"),
    });
    expect(pass("2026-11-21T11:59:00Z")).toBeNull(); // Sat 09:59 ST
    expect(pass("2026-11-21T12:00:00Z")).toBe("morning");
    expect(pass("2026-11-21T12:20:00Z", 645)).toBeNull(); // before the alliance's 10:45
    expect(pass("2026-11-21T13:59:00Z")).toBe("morning");
    expect(pass("2026-11-21T14:00:00Z")).toBeNull(); // 12:00 ST: KvK
    expect(pass("2026-11-20T01:40:00Z")).toBeNull(); // Thursday night
    // The tick reads no workspace outside the windows.
    expect(shieldWindowOpen(at("2026-11-21T11:59:00Z"), TEST_ENV)).toBe(false);
    expect(shieldWindowOpen(at("2026-11-21T01:30:00Z"), TEST_ENV)).toBe(true);
    expect(morningMinuteOf(720)).toBe(660);
    expect(morningMinuteOf(null)).toBe(600);
  });

  it("gives an 8-hour shield's latest end, only for shield_type 0 while shielding", () => {
    const seen = {
      shielding: 1,
      shieldType: 0,
      mapAt: at("2026-11-21T00:32:00Z"),
      readAt: at("2026-11-21T01:31:00Z"),
    };
    expect(shieldEndsBy(seen)).toEqual(at("2026-11-21T08:32:00Z"));
    expect(mayEndBeforeKvk(seen, at("2026-11-21T14:00:00Z"))).toBe(true);
    expect(shieldEndsBy({ ...seen, shieldType: 1 })).toBeNull();
    expect(shieldEndsBy({ ...seen, shielding: 0 })).toBeNull();
    expect(
      mayEndBeforeKvk({ ...seen, mapAt: at("2026-11-21T10:10:00Z") }, at("2026-11-21T14:00:00Z")),
    ).toBe(false);
  });
});
