import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import { en } from "@/lib/copy";
import type { Race } from "@/lib/queries";

import type { Clock } from "./format";

const flag = vi.hoisted(() => ({ on: true }));
vi.mock("@/lib/flags", () => ({ isOn: async () => flag.on }));
const race: Race = {
  today: "2026-11-29",
  from: "2026-11-07",
  to: "2026-11-28",
  rows: [
    {
      unionId: 2,
      tag: "LNK",
      name: "Link",
      badgeId: null,
      might: 150e6,
      rank: 1,
      projected: 154e6,
      projectedRank: 2,
      pace: 1e6,
      low: 1e6,
      high: 1e6,
    },
    {
      unionId: 1,
      tag: "IRT",
      name: "Iron Tide",
      badgeId: null,
      might: 140e6,
      rank: 2,
      projected: 180e6,
      projectedRank: 1,
      pace: 10e6,
      low: -5e6,
      high: 20e6,
    },
  ],
  left: [
    { unionId: 3, tag: "ASH", name: "Ash Council", reason: "moved" },
    { unionId: 4, tag: "TDE", name: "Tide", reason: "few" },
  ],
};
const sharedRace = vi.hoisted(() => vi.fn());
vi.mock("./public-reads", () => ({ sharedRace }));

const { RacePace } = await import("./RacePace");

const clock = { day: () => "Nov 7" } as unknown as Clock;
const render = async () => renderToStaticMarkup(await RacePace({ clock, locale: "en", copy: en }));

describe("RacePace", () => {
  it("draws both columns, the summary, the chosen alliance's readout and the alliances left out", async () => {
    flag.on = true;
    sharedRace.mockResolvedValue(race);
    const html = await render();
    expect(html).toContain("Race to #1");
    expect(html).toContain("[IRT] passes [LNK] for #1 at this pace.");
    expect(html).toContain("In 4 weeks at this pace");
    expect(html).toContain("[LNK]");
    expect(html).toContain("[LNK] Link</span> · #1 → #2 in 4 weeks at this pace · +1.00M a week");
    expect(html).toContain("[ASH] Ash Council: membership changed a lot");
    expect(html).toContain("[TDE] Tide: not enough weeks yet");
  });

  it("is not drawn and reads nothing while the flag is off", async () => {
    flag.on = false;
    sharedRace.mockClear();
    expect(await render()).toBe("");
    expect(sharedRace).not.toHaveBeenCalled();
  });
});
