import { describe, expect, it } from "vitest";

import { returnPath } from "./sign-in";

describe("the return path after sign-in (ADV-7)", () => {
  it("keeps a path of the same workspace with its query, without the fragment", () => {
    expect(returnPath("ogs", "/w/ogs")).toBe("/w/ogs");
    expect(returnPath("ogs", "/w/ogs/shots/12")).toBe("/w/ogs/shots/12");
    expect(returnPath("ogs", "/w/ogs/calendar?week=2026-11-16#x")).toBe(
      "/w/ogs/calendar?week=2026-11-16",
    );
  });

  it.each([
    "https://evil.example/w/ogs",
    "//evil.example/w/ogs",
    "/\\evil.example/w/ogs",
    "\\\\evil.example",
    "javascript:alert(1)",
    "/w/ogs/../../admin",
    "/w/ogs/%2e%2e/%2e%2e/admin",
    "/w/ogsx",
    "/w/nse/members",
    "/w/ogs\n/members",
    " /w/ogs",
    "w/ogs",
    "",
    `/w/ogs/${"a".repeat(600)}`,
  ])("refuses %j", (raw) => {
    expect(returnPath("ogs", raw)).toBeNull();
  });
});
