import { describe, expect, it } from "vitest";

import { isSameOriginJson, isSameOriginPicture, isShareTarget, privately } from "./http";

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

describe("isSameOriginPicture (issue 299 uploads)", () => {
  const picture = { ...ours, "content-type": "image/jpeg" };

  it("accepts a PNG, JPEG or WebP picture from the app's own origin", () => {
    for (const type of ["image/png", "image/jpeg", "image/webp"])
      expect(isSameOriginPicture(write({ ...picture, "content-type": type }))).toBe(true);
  });

  it("refuses a picture from another origin or marked cross-site", () => {
    expect(isSameOriginPicture(write({ ...picture, origin: "https://evil.test" }))).toBe(false);
    expect(isSameOriginPicture(write({ ...picture, "sec-fetch-site": "cross-site" }))).toBe(false);
  });

  it("refuses another content type", () => {
    for (const type of ["image/gif", "image/svg+xml", "text/plain"])
      expect(isSameOriginPicture(write({ ...picture, "content-type": type }))).toBe(false);
  });
});

describe("isShareTarget (D110, the phone's share)", () => {
  const multipart = "multipart/form-data; boundary=x";
  const android = { origin: "null", "sec-fetch-site": "none", "content-type": multipart };

  it("accepts Android's browser-made share and a multipart post from our own origin", () => {
    expect(isShareTarget(write(android))).toBe(true);
    expect(isShareTarget(write({ ...ours, "content-type": multipart }))).toBe(true);
  });

  it("refuses a foreign Origin even marked none, a body that is not multipart, and no headers", () => {
    expect(isShareTarget(write({ ...android, origin: "https://evil.test" }))).toBe(false);
    expect(isShareTarget(write({ ...android, "content-type": "application/json" }))).toBe(false);
    expect(isShareTarget(write({}))).toBe(false);
  });
});

describe("privately (D80)", () => {
  it("rethrows an error as its code alone, without the message or cause that quote typed text", async () => {
    const typed = new Error('Failed query: insert … params: 1,12,notes,"Away on Sundays"', {
      cause: new Error('Key (value)=("Away on Sundays") already exists'),
    });
    const thrown = await privately("member_facts.save", () => Promise.reject(typed)).catch(
      (e: unknown) => e as Error,
    );

    expect(thrown.message).toBe("member_facts.save");
    expect(thrown.cause).toBeUndefined();
  });
});
