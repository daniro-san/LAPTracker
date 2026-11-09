import { describe, expect, it } from "vitest";

import { buildLine } from "./build-line";

const builtAt = new Date("2026-11-08T23:30:00Z");
const SHA = "88215d2f0c1e4b7a9d3e5f60718293a4b5c6d7e8";

describe("buildLine", () => {
  it("shows the release on a main deploy of a release merge commit", () => {
    const env = {
      VERCEL_GIT_COMMIT_SHA: SHA,
      VERCEL_GIT_COMMIT_REF: "main",
      VERCEL_GIT_COMMIT_MESSAGE: "release: v2.0.0 (#190)\n\nNotes",
    };
    expect(buildLine(env, builtAt)).toBe("v2.0.0 · 88215d2 · 2026-11-08");
  });

  it("shows the branch, not a version, on a dev deploy even of a release commit", () => {
    const env = {
      VERCEL_GIT_COMMIT_SHA: SHA,
      VERCEL_GIT_COMMIT_REF: "dev",
      VERCEL_GIT_COMMIT_MESSAGE: "release: v2.0.0 (#190)",
    };
    expect(buildLine(env, builtAt)).toBe("dev · 88215d2 · 2026-11-08");
  });

  it("reads local when no Vercel commit is set", () => {
    expect(buildLine({}, builtAt)).toBe("local");
  });
});
