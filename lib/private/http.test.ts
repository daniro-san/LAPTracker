import { describe, expect, it } from "vitest";

import { isSameOriginJson } from "./http";

const write = (headers: Record<string, string>) =>
  new Request("https://laptracker.test/api/w/ogs/logout", { method: "POST", headers, body: "{}" });
const ours = {
  origin: "https://laptracker.test",
  "sec-fetch-site": "same-origin",
  "content-type": "application/json",
};

describe("isSameOriginJson (D71 writes)", () => {
  it("accepts a JSON write from the app's own origin", () => {
    expect(isSameOriginJson(write(ours))).toBe(true);
  });

  it("refuses a write from another origin", () => {
    expect(isSameOriginJson(write({ ...ours, origin: "https://evil.test" }))).toBe(false);
  });

  it("refuses a write with no Origin header", () => {
    const noOrigin = { "sec-fetch-site": "same-origin", "content-type": "application/json" };
    expect(isSameOriginJson(write(noOrigin))).toBe(false);
  });

  it("refuses a write the browser marks cross-site", () => {
    expect(isSameOriginJson(write({ ...ours, "sec-fetch-site": "cross-site" }))).toBe(false);
  });

  it("refuses a form body", () => {
    const form = { ...ours, "content-type": "application/x-www-form-urlencoded" };
    expect(isSameOriginJson(write(form))).toBe(false);
  });
});
