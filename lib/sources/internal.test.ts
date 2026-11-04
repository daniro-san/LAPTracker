import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { fetchAlliance, fetchRanks } from "./internal";
import { headersOf, mockFetch, readFixture, respond, stubSourceEnv } from "./test-helpers";
import { NotFoundError, NotLiveError, SchemaError } from "./types";
import * as v1 from "./v1";

const OGS_LIVE = "probe-67111155-20261104T153457Z/01-before.json";
const URSA_STUB = "probe-67110320-20261104T153605Z/01-before.json";
const RANKS = "ranks-325-20261104T201831Z/ranks.json";

/** Key → typeof, so two parses can be compared by shape. */
const shape = (o: object) =>
  Object.fromEntries(Object.entries(o).map(([k, v]) => [k, v === null ? "null" : typeof v]));

beforeEach(stubSourceEnv);
afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("internal.fetchAlliance", () => {
  it("parses the live: true roster into the same type as v1 for the same alliance", async () => {
    mockFetch(respond(readFixture(OGS_LIVE)));
    const internal = await fetchAlliance(67111155);
    mockFetch(respond(readFixture("v1-20261104T155902Z/alliance-67111155.json")));
    const fromV1 = await v1.fetchAlliance(67111155);

    expect({ cached: internal.cached, quota: internal.quota }).toEqual({
      cached: null,
      quota: null,
    });
    // Same keys and same value types; cached/quota are null on internal by design.
    const comparable = (o: object) => ({ ...shape(o), cached: "-", quota: "-" });
    expect(comparable(internal)).toEqual(comparable(fromV1));
    expect(shape(internal.members[0] ?? {})).toEqual(shape(fromV1.members[0] ?? {}));

    const raw = JSON.parse(readFixture(OGS_LIVE)) as { members: { kills: number | null }[] };
    expect(internal).toMatchObject({ unionId: 67111155, tag: "OGs", memberCount: 100 });
    expect(internal.totalKills).toBe(raw.members.reduce((t, m) => t + (m.kills ?? 0), 0));
    expect(internal.sourceUpdatedAt?.toISOString()).toMatch(/^2026-11-04T15:34/);
  });

  it("throws NotLiveError on the URSA live: false stub", async () => {
    mockFetch(respond(readFixture(URSA_STUB)));
    await expect(fetchAlliance(67110320)).rejects.toBeInstanceOf(NotLiveError);
  });

  it("maps 404 'alliance not found' to NotFoundError", async () => {
    mockFetch(respond(readFixture("probe-67110250-20261104T153123Z/01-before.json"), 404));
    await expect(fetchAlliance(67110250)).rejects.toBeInstanceOf(NotFoundError);
  });

  it("throws SchemaError internal.schema when a read field is renamed", async () => {
    mockFetch(respond(readFixture(OGS_LIVE).replaceAll('"union_id"', '"alliance_id"')));
    await expect(fetchAlliance(67111155)).rejects.toMatchObject({ code: "internal.schema" });
  });

  it("sends a plain GET with User-Agent and no Origin, Referer or Cookie", async () => {
    const mock = mockFetch(respond(readFixture(OGS_LIVE)));
    await fetchAlliance(67111155);
    const headers = headersOf(mock, 0);
    expect(String(mock.mock.calls[0]?.[0])).toBe("https://site.test/api/alliances/67111155");
    expect(mock.mock.calls[0]?.[1]?.method).toBe("GET");
    expect(headers.get("user-agent")).toMatch(/^laptracker\/1\.0 /);
    for (const h of ["origin", "referer", "cookie", "authorization"])
      expect(headers.has(h)).toBe(false);
  });
});

describe("internal.fetchRanks", () => {
  it("parses alliance_power and alliance_kills into maps keyed by union_id", async () => {
    const mock = mockFetch(respond(readFixture(RANKS)));
    const board = await fetchRanks(325);
    expect(String(mock.mock.calls[0]?.[0])).toBe("https://site.test/api/servers/catalog/325/ranks");
    expect(board.power.size).toBe(98);
    expect(board.kills.size).toBe(97);
    expect(board.power.get(67111155)).toBe(3_934_102_584);
    expect(board.kills.get(67111155)).toBe(34_213_081);
    expect(board.pulledAt.toISOString()).toBe("2026-11-04T16:41:48.809Z");
  });

  it("throws SchemaError when an alliance board is missing", async () => {
    mockFetch(respond(readFixture(RANKS).replace('"alliance_kills"', '"alliance_kill"')));
    await expect(fetchRanks(325)).rejects.toBeInstanceOf(SchemaError);
  });
});
