import { describe, expect, it } from "vitest";

import { neutraliseFixture } from "./neutralise-fixture";

describe("neutraliseFixture", () => {
  it("neutralises the five keys at every depth, keeps every key and leaves other bytes as they were", () => {
    const real =
      '{"power":0.0,"members":[{"uid":7,"name":"x","x":412,"y":977,"online":true,"last_online_at":1731700000,' +
      '"joined_at":"2026-01-02","daily_tech":5,"nested":{"x":-3.5,"online":null}}],"rosters":[{"y":8,"online":false}]}';
    const neutral = neutraliseFixture(real);
    expect(neutral).toBe(
      '{"power":0.0,"members":[{"uid":7,"name":"x","x":0,"y":0,"online":false,"last_online_at":0,' +
        '"joined_at":"","daily_tech":5,"nested":{"x":0,"online":null}}],"rosters":[{"y":0,"online":false}]}',
    );
    const keys = (text: string) => [...text.matchAll(/"([a-z_]+)":/g)].map((m) => m[1]);
    expect(keys(neutral)).toEqual(keys(real));
  });

  it("leaves key-like text inside a string value alone, escaped quotes included", () => {
    const real = String.raw`{"note":"moved "x": 5 and "online":true","x":9}`;
    expect(neutraliseFixture(real)).toBe(
      String.raw`{"note":"moved "x": 5 and "online":true","x":0}`,
    );
  });
});
