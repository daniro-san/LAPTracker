import { describe, expect, it } from "vitest";

import { buildVersion } from "./build-version";

describe("buildVersion", () => {
  it("shows the release on a main deploy of a release merge commit", () => {
    const env = {
      VERCEL_GIT_COMMIT_REF: "main",
      VERCEL_GIT_COMMIT_MESSAGE: "release: v2.0.0 (#190)\n\nNotes",
    };
    expect(buildVersion(env)).toBe("v2.0.0");
  });

  it("shows dev, not a version, on a dev deploy even of a release commit", () => {
    const env = {
      VERCEL_GIT_COMMIT_REF: "dev",
      VERCEL_GIT_COMMIT_MESSAGE: "release: v2.0.0 (#190)",
    };
    expect(buildVersion(env)).toBe("dev");
  });

  it("reads local outside Vercel", () => {
    expect(buildVersion({})).toBe("local");
  });
});
