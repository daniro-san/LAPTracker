// GET /v1/players/{uid} (D117): the undocumented `squads` array, present, absent or partial. Bodies are
// built here with invented values; no network.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { mockFetch, respond, stubSourceEnv } from "./test-helpers";
import { SchemaError } from "./types";
import { fetchPlayer } from "./v1";

const QUOTA = { limit: 1000, used: 120, remaining: 880 };
/** What the body carries beside squads; none of it may reach the result. */
const REST = {
  nick: "Invented",
  history: [{ power: 1 }],
  alliance_members: [{ uid: 9, x: 1, y: 2, daily_tech: 3, active: 4 }],
};

beforeEach(() => stubSourceEnv());
afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

const body = (extra: Record<string, unknown>) =>
  respond(JSON.stringify({ uid: 501, ...REST, ...extra, quota: QUOTA }));

describe("v1.fetchPlayer (D117)", () => {
  it("reads the squads with their heroes and troops, from the cached copy", async () => {
    const fetch = mockFetch(
      body({
        squads: [
          {
            squad: 2,
            power: 61_234_567.4,
            soldiers: 4000,
            soldier_load: 3800,
            sid: 77,
            seen_at: 1_763_340_000,
            heroes: [{ id: 10005, lv: 80, star: 22, q: 5, awaken: 1, honor: 3, ue: 0 }],
            troops: [{ id: 1009, tier: 9, n: 2150 }],
          },
        ],
      }),
    );
    const player = await fetchPlayer(501);
    expect(fetch.mock.calls[0]?.[0]).toBe("https://v1.test/v1/players/501");
    expect(player).toMatchObject({
      uid: 501,
      quota: QUOTA,
      squads: [
        {
          squad: 2,
          power: 61_234_567.4,
          soldiers: 4000,
          soldierLoad: 3800,
          seenAt: new Date(1_763_340_000 * 1000),
          heroes: [{ id: 10005, lv: 80, star: 22, q: 5, awaken: 1, honor: 3 }],
          troops: [{ id: 1009, tier: 9, n: 2150 }],
        },
      ],
    });
  });

  it("keeps the facts, the history rows and the body less alliance_members (D132)", async () => {
    mockFetch(
      body({
        shielding: 1,
        shield_type: 0,
        map_updated_at: 1_763_340_000.5,
        language: "pt",
        power: 81_000_000,
        union_id: 777,
        home_sid: 325,
        vip: "twelve",
        x: 98765,
        avatar_url: "https://avatar.example.test/a.png",
        alliance: { updated_at: 1_763_340_100 },
        history: [
          { observed_at: 1_763_300_000, power: 80e6, kills: 9, union_abbr: "INV", x: 1, y: 2 },
          { power: 1 },
        ],
      }),
    );
    const player = await fetchPlayer(501);
    expect(player.facts).toMatchObject({
      shielding: 1,
      shieldType: 0,
      mapUpdatedAt: new Date(1_763_340_000_500),
      language: "pt",
      unionId: 777,
      homeSid: 325,
      // A field of another type is null; it never fails the read.
      vip: null,
    });
    // The row without `observed_at` is dropped; x and y are not kept in a row.
    expect(player.history).toEqual([
      expect.objectContaining({ t: new Date(1_763_300_000_000), power: 80e6, unionAbbr: "INV" }),
    ]);
    expect(player.history[0]).not.toHaveProperty("x");
    // The roster's uids only, for the queue; the body keeps everything but the roster.
    expect(player.roster).toEqual({
      unionId: 777,
      updatedAt: new Date(1_763_340_100_000),
      uids: [9],
    });
    expect(player.raw).not.toHaveProperty("alliance_members");
    expect(player.raw).toMatchObject({ nick: "Invented", shielding: 1 });
  });

  it("answers no squads when the field is absent or null", async () => {
    mockFetch(body({}), body({ squads: null }));
    expect((await fetchPlayer(501)).squads).toEqual([]);
    expect((await fetchPlayer(501)).squads).toEqual([]);
  });

  it("keeps a partial squad (no soldiers, no heroes, an ISO seen_at, a hero without quality)", async () => {
    mockFetch(
      body({
        squads: [
          { squad: 1, power: 5, seen_at: "2026-11-16T20:00:00Z" },
          { squad: 3, power: 7, heroes: [{ id: 10010 }] },
          { squad: 4, power: 9, seen_at: "1763340000" },
        ],
      }),
    );
    const { squads } = await fetchPlayer(501);
    // An all-digit string is epoch seconds, as the number always was (2026-11-18).
    expect(squads[2]?.seenAt).toEqual(new Date(1_763_340_000 * 1000));
    expect(squads[0]).toMatchObject({
      soldiers: null,
      soldierLoad: null,
      heroes: [],
      seenAt: new Date("2026-11-16T20:00:00Z"),
    });
    expect(squads[1]).toMatchObject({
      seenAt: null,
      heroes: [{ id: 10010, lv: null, star: null, q: null, awaken: null }],
    });
  });

  it("fails as v1.schema with the path only when a squad lost its power", async () => {
    mockFetch(body({ squads: [{ squad: 1, power: "lots" }] }));
    const e = await fetchPlayer(501).catch((err: unknown) => err);
    expect(e).toBeInstanceOf(SchemaError);
    expect((e as SchemaError).paths).toEqual(["squads.0.power"]);
  });
});
