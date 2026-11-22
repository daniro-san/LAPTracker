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

// These tests check the drawing, not the 3 s cap: a loaded machine must not turn a slow render into
// a missing picture (issue 313).
const DRAW = { limitMs: 30_000 };

describe("the event picture (D58)", () => {
  it("leaves out what the brand fonts cannot draw and keeps Cyrillic and accents", () => {
    expect(drawable("꧁Black Raven꧂")).toBe("Black Raven");
    expect(drawable("Fire 🔥 Squad 👍🏽")).toBe("Fire Squad");
    expect(drawable("龍の会 Dragon")).toBe("Dragon");
    expect(drawable("Берсерк Ölüm Meleği")).toBe("Берсерк Ölüm Meleği");
  });

  it(
    "draws both phases 720 px wide without fetching a font or an emoji",
    { timeout: 40_000 },
    async () => {
      // next/og loads its own WASM from a data: URL; anything else would be a font or emoji download.
      const real = globalThis.fetch;
      const fetch = vi
        .spyOn(globalThis, "fetch")
        .mockImplementation((url, init) =>
          String(url).startsWith("data:")
            ? real(url, init)
            : Promise.reject(new Error("no network")),
        );
      const before = input({ phase: "before", alliances: BEFORE, before: [], beforeAt: null });
      for (const e of [before, input()]) {
        const png = await eventImage(e, DRAW);
        // IHDR: the width is the big-endian word at byte 16.
        expect(png && new DataView(png.buffer).getUint32(16)).toBe(720);
      }
      const downloads = fetch.mock.calls
        .map((c) => String(c[0]))
        .filter((u) => !u.startsWith("data:"));
      expect(downloads).toEqual([]);
    },
  );

  it(
    "adds the turnout block to the End's picture only, 211 px (2×: 422) taller, with no network",
    { timeout: 40_000 },
    async () => {
      vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("no network"));
      const t = (unionId: number, gainers: number) => ({
        unionId,
        tag: `T${unionId}`,
        name: null,
        badgeId: null,
        n: 100,
        gainers,
        gained: 10,
        top: 5,
      });
      const rows = [t(1, 54), t(2, 48), t(3, 41), t(4, 33), t(5, 12)];
      const turnout = { withKills: rows, topShare: rows };
      // IHDR: the height is the big-endian word at byte 20.
      const height = async (e: EventImageInput) => {
        const png = await eventImage(e, DRAW);
        return png && new DataView(png.buffer).getUint32(20);
      };
      const without = await height(input());
      // Section 36 + 4 rows of 35 + the concentration line 35, drawn at 2×.
      expect(await height(input({ turnout }))).toBe((without ?? 0) + 2 * 211);
      expect(await height(input({ turnout: null }))).toBe(without);
      const before = input({ phase: "before", alliances: BEFORE, before: [], beforeAt: null });
      expect(await height({ ...before, turnout })).toBe(await height(before));
    },
  );

  it(
    "adds the KvK block to the End's picture only, 106 px (2×: 212) taller, and none when a side counts no alliance (D152)",
    { timeout: 40_000 },
    async () => {
      vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("no network"));
      const height = async (e: EventImageInput) => {
        const png = await eventImage(e, DRAW);
        return png && new DataView(png.buffer).getUint32(20);
      };
      const side = (counted: number) => ({ counted, might: -2_000_000_000, kills: 40_000_000 });
      const kvk = { server: 326, us: side(14), them: side(12) };
      const without = await height(input());
      // Section 36 + 2 rows of 35, drawn at 2×.
      expect(await height(input({ kvk }))).toBe((without ?? 0) + 2 * 106);
      expect(await height(input({ kvk: { ...kvk, them: side(0) } }))).toBe(without);
      const before = input({ phase: "before", alliances: BEFORE, before: [], beforeAt: null });
      expect(await height({ ...before, kvk })).toBe(await height(before));
    },
  );

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
