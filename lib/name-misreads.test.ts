// Alliance names (plan §3.8): a name the source read once is not a rename (withoutMisreads, owner report 2026-11-22).
import { describe, expect, it } from "vitest";

import { nameHistory, withoutMisreads } from "./compute";

describe("withoutMisreads (alliance names)", () => {
  const at = (iso: string) => new Date(iso);
  const yaho = { tag: "YAHO", name: "Aggressor" };
  const names = (rows: ReturnType<typeof withoutMisreads>) =>
    nameHistory(rows).map((e) => `${e.tag} / ${e.name}`);

  it("drops a name the source read once while the usual name was seen before and after it", () => {
    // Event 9 of 2026-11-07: the Before (12:00) read "PKM / Pokemon", the After (15:00) read YAHO again.
    const rows = [
      { ...yaho, at: at("2026-11-05T21:57Z") },
      { tag: "PKM", name: "Pokemon", at: at("2026-11-07T14:00Z"), seenAt: at("2026-11-07T12:00Z") },
      { ...yaho, at: at("2026-11-07T14:00Z"), seenAt: at("2026-11-07T15:00Z") },
      { ...yaho, at: at("2026-11-14T14:00Z") },
    ];
    expect(names(withoutMisreads(rows))).toEqual(["YAHO / Aggressor"]);
  });

  it("keeps a rename seen once in the newest snapshot", () => {
    const rows = [
      { ...yaho, at: at("2026-11-05T21:57Z") },
      { tag: "NEW", name: "Renamed", at: at("2026-11-07T14:00Z") },
    ];
    expect(names(withoutMisreads(rows))).toEqual(["YAHO / Aggressor", "NEW / Renamed"]);
  });

  it("keeps a rename between the Before and the After of one event, which share the event's time", () => {
    const rows = [
      { ...yaho, at: at("2026-11-05T21:57Z") },
      { ...yaho, at: at("2026-11-07T14:00Z"), seenAt: at("2026-11-07T12:00Z") },
      { tag: "NEW", name: "Renamed", at: at("2026-11-07T14:00Z"), seenAt: at("2026-11-07T15:00Z") },
    ];
    expect(names(withoutMisreads(rows))).toEqual(["YAHO / Aggressor", "NEW / Renamed"]);
  });

  it("keeps a short-lived name that was seen in two snapshots", () => {
    const rows = [
      { ...yaho, at: at("2026-11-05T21:57Z") },
      { tag: "PKM", name: "Pokemon", at: at("2026-11-07T14:00Z"), seenAt: at("2026-11-07T12:00Z") },
      { tag: "PKM", name: "Pokemon", at: at("2026-11-07T14:00Z"), seenAt: at("2026-11-07T15:00Z") },
      { ...yaho, at: at("2026-11-14T14:00Z") },
    ];
    expect(names(withoutMisreads(rows))).toEqual(["YAHO / Aggressor", "PKM / Pokemon"]);
  });
});
