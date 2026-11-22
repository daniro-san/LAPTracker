// lib/words (issue 592): one placeholder rule and one plural rule for pages, push and Discord.
import { afterEach, describe, expect, it, vi } from "vitest";

import { fill, plural } from "./words";

afterEach(() => vi.unstubAllEnvs());

describe("fill", () => {
  it("puts each value in every place its placeholder appears; 0 and an empty text are values", () => {
    expect(fill("{n} of {total}, {n} seen", { n: 3, total: 8 })).toBe("3 of 8, 3 seen");
    expect(fill("{n} waiting{team}", { n: 0, team: "" })).toBe("0 waiting");
  });

  it("throws outside production on a placeholder with no value, so a test or next dev finds it", () => {
    expect(() => fill("{n} waiting in {place}", { n: 2 })).toThrow("{place}");
  });

  it("leaves the placeholder visible in production, never an empty word in a push or Discord message", () => {
    vi.stubEnv("NODE_ENV", "production");
    expect(fill("{n} waiting in {place}", { n: 2 })).toBe("2 waiting in {place}");
  });
});

describe("plural", () => {
  const forms = { one: "one", other: "other" };

  it("follows each language's own rule: 0 is plural in English, singular in French and Portuguese", () => {
    expect([0, 1, 2].map((n) => plural(n, forms, "en"))).toEqual(["other", "one", "other"]);
    expect([0, 1, 2].map((n) => plural(n, forms, "fr"))).toEqual(["one", "one", "other"]);
    expect([0, 1, 2].map((n) => plural(n, forms, "pt-BR"))).toEqual(["one", "one", "other"]);
  });
});
