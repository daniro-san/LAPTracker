import { describe, expect, it } from "vitest";

import { buildInfo } from "./build-line";

const builtAt = new Date("2026-11-08T23:30:00Z");
const SHA = "88215d2f0c1e4b7a9d3e5f60718293a4b5c6d7e8";

describe("buildInfo", () => {
  it("shows the release on a main deploy of a release merge commit", () => {
    const env = {
      VERCEL_GIT_COMMIT_SHA: SHA,
      VERCEL_GIT_COMMIT_REF: "main",
      VERCEL_GIT_COMMIT_MESSAGE: "release: v2.0.0 (#190)\n\nNotes",
    };
    expect(buildInfo(env, builtAt)).toEqual({
      BUILD_LABEL: "v2.0.0 · 88215d2",
      BUILD_AT: "2026-11-08T23:30:00.000Z",
    });
  });

  it("shows the branch, not a version, on a dev deploy even of a release commit", () => {
    const env = {
      VERCEL_GIT_COMMIT_SHA: SHA,
      VERCEL_GIT_COMMIT_REF: "dev",
      VERCEL_GIT_COMMIT_MESSAGE: "release: v2.0.0 (#190)",
    };
    expect(buildInfo(env, builtAt).BUILD_LABEL).toBe("dev · 88215d2");
  });

  it("reads local, with no build time, when no Vercel commit is set", () => {
    expect(buildInfo({}, builtAt)).toEqual({ BUILD_LABEL: "local", BUILD_AT: "" });
  });
});
