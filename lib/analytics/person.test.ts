// The pseudonymous PostHog id (D115): stable, salted by the secret, never the raw id.
import { describe, expect, it } from "vitest";

import { analyticsPerson, analyticsPersonId } from "./person";

const SECRET = "a".repeat(32);
const ON = { CRON_SECRET: SECRET, VERCEL_ENV: "production", POSTHOG_KEY: "phc_test" };

describe("analyticsPersonId (D115)", () => {
  it("is stable for one user, differs between users and between secrets, and hides the raw id", () => {
    const id = analyticsPersonId(42, SECRET);
    expect(id).toMatch(/^ws_[0-9a-f]{32}$/);
    expect(analyticsPersonId(42, SECRET)).toBe(id);
    expect(analyticsPersonId(43, SECRET)).not.toBe(id);
    expect(analyticsPersonId(42, "b".repeat(32))).not.toBe(id);
    expect(id).not.toContain("42");
  });

  it("carries only the id, the tier, the slug and the alliance's tag, and is off without production analytics", () => {
    const person = analyticsPerson(ON, {
      userId: 42,
      tier: "member",
      slug: "ogs",
      alliance: { tag: "OGs" },
    });
    expect(person).toEqual({
      id: analyticsPersonId(42, SECRET),
      tier: "member",
      workspace: "ogs",
      alliance: "OGs",
    });
    expect(
      analyticsPerson(
        { ...ON, VERCEL_ENV: "preview" },
        { userId: 42, tier: "officer", slug: "ogs", alliance: { tag: "OGs" } },
      ),
    ).toBeNull();
    expect(
      analyticsPerson(
        { CRON_SECRET: SECRET, VERCEL_ENV: "production" },
        { userId: 42, tier: "officer", slug: "ogs", alliance: { tag: "OGs" } },
      ),
    ).toBeNull();
  });
});
