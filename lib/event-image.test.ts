import { afterEach, describe, expect, it, vi } from "vitest";

import { TEST_ENV } from "./app-context.test-helpers";
import { discordClock } from "./discord-format";
import { drawable, eventImage, type EventImageInput, type ImageAlliance } from "./event-image";

const row = (unionId: number, tag: string, name: string, power: number): ImageAlliance => ({
  unionId,
  tag,
  name,
  isFresh: true,
  failed: false,
  totalPower: power,
  totalKills: power / 100,
  memberCount: 98,
});
const BEFORE = [
  row(1, "BRAV", "꧁Black Raven꧂", 3_000_000_000),
  row(2, "404", "Берсерк", 2_000_000_000),
  row(3, "龍", "龍の会 🔥", 1_000_000_000),
];
const AFTER = BEFORE.map((a) => ({ ...a, totalPower: (a.totalPower ?? 0) + 5_000_000 }));
const input = (over: Partial<EventImageInput> = {}): EventImageInput => ({
  eventId: 9,
  name: "Saturday Event 2026-11-07",
  manual: false,
  phase: "after",
  clock: discordClock(TEST_ENV.SERVER_TZ),
  at: new Date("2026-11-07T16:01:00Z"),
  beforeAt: new Date("2026-11-07T12:01:00Z"),
  nextAt: null,
  alliances: AFTER,
  before: BEFORE,
  ...over,
});

afterEach(() => vi.restoreAllMocks());

describe("the event picture (D58)", () => {
  it("leaves out what the brand fonts cannot draw and keeps Cyrillic and accents", () => {
    expect(drawable("꧁Black Raven꧂")).toBe("Black Raven");
    expect(drawable("Fire 🔥 Squad 👍🏽")).toBe("Fire Squad");
    expect(drawable("龍の会 Dragon")).toBe("Dragon");
    expect(drawable("Берсерк Ölüm Meleği")).toBe("Берсерк Ölüm Meleği");
  });

  it("draws both phases 720 px wide without fetching a font or an emoji", async () => {
    // next/og loads its own WASM from a data: URL; anything else would be a font or emoji download.
    const real = globalThis.fetch;
    const fetch = vi
      .spyOn(globalThis, "fetch")
      .mockImplementation((url, init) =>
        String(url).startsWith("data:") ? real(url, init) : Promise.reject(new Error("no network")),
      );
    const before = input({ phase: "before", alliances: BEFORE, before: [], beforeAt: null });
    for (const e of [before, input()]) {
      const png = await eventImage(e);
      // IHDR: the width is the big-endian word at byte 16.
      expect(png && new DataView(png.buffer).getUint32(16)).toBe(720);
    }
    const downloads = fetch.mock.calls
      .map((c) => String(c[0]))
      .filter((u) => !u.startsWith("data:"));
    expect(downloads).toEqual([]);
  });

  it("gives null and logs no name when the picture cannot be drawn", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    const clock = {
      ...discordClock(TEST_ENV.SERVER_TZ),
      day: () => {
        throw new TypeError("bad date");
      },
    };
    expect(await eventImage(input({ clock }))).toBeNull();
    expect(error).toHaveBeenCalledWith("notify.image_failed", { event_id: 9, reason: "TypeError" });
  });
});
