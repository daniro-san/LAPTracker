import { describe, expect, it } from "vitest";

import { en } from "@/lib/copy";
import type { AllianceMove } from "@/lib/queries";

import { moveText, movesByDay } from "./AllianceMoves";

const move = (
  day: string,
  kind: AllianceMove["kind"],
  uid: number,
  tag?: string,
): AllianceMove => ({
  day,
  kind,
  uid,
  name: `P${uid}`,
  other: tag ? { unionId: 8, tag } : null,
});

describe("moveText", () => {
  it("names the alliance a member came from or went to", () => {
    expect(moveText(move("2026-11-27", "joined", 1, "FSPN"), en)).toBe("Joined · from [FSPN]");
    expect(moveText(move("2026-11-27", "left", 1, "CROW"), en)).toBe("Left · to [CROW]");
  });

  it("says not in a tracked alliance when the other side is unknown, never no alliance", () => {
    const lines = [moveText(move("d", "joined", 1), en), moveText(move("d", "left", 1), en)];
    expect(lines).toEqual([
      "Joined · was not in a tracked alliance",
      "Left · not in a tracked alliance",
    ]);
    expect(lines.join(" ")).not.toMatch(/no alliance/i);
  });
});

describe("movesByDay", () => {
  const moves = [
    move("2026-11-27", "joined", 1),
    move("2026-11-27", "left", 2),
    move("2026-11-20", "left", 3),
  ];

  it("keeps all, joins only or leaves only, grouped by day in order", () => {
    const uids = (f: "all" | "joined" | "left") =>
      movesByDay(moves, f).map(([day, list]) => [day, list.map((m) => m.uid)]);
    expect(uids("all")).toEqual([
      ["2026-11-27", [1, 2]],
      ["2026-11-20", [3]],
    ]);
    expect(uids("joined")).toEqual([["2026-11-27", [1]]]);
    expect(uids("left")).toEqual([
      ["2026-11-27", [2]],
      ["2026-11-20", [3]],
    ]);
  });
});
