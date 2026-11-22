// The documented lookup by tag (plan §2), used only by the KvK opponent's Start read (D152).
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { mockFetch, readFixture, respond, stubSourceEnv } from "./test-helpers";
import { UpstreamError } from "./types";
import { fetchAllianceByTag } from "./v1";

const OGS = "v1-20261104T155902Z/alliance-67111155.json";

beforeEach(() => stubSourceEnv());
afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("v1.fetchAllianceByTag (the KvK opponent's Start, D152)", () => {
  it("asks for one tag of another server as one encoded path segment, live, and keeps the body's sid", async () => {
    const body = readFixture(OGS)
      .replace('"abbr":"OGs"', '"abbr":"Бер/с"')
      .replace('"sid":325', '"sid":326');
    const mock = mockFetch(respond(body));
    const a = await fetchAllianceByTag(326, "Бер/с");
    expect(String(mock.mock.calls[0]?.[0])).toBe(
      "https://v1.test/v1/alliances/326/%D0%91%D0%B5%D1%80%2F%D1%81?fresh=1",
    );
    expect(a).toMatchObject({ unionId: 67111155, tag: "Бер/с", sid: 326 });
  });

  it("sends a 502 once when the call allows no retry, and answers a 409 (tag not unique) as UpstreamError 409", async () => {
    const once = mockFetch(respond("error code: 502", 502));
    const failed = await fetchAllianceByTag(326, "AAA", undefined, undefined, {
      maxRetries: 0,
    }).catch((e: unknown) => e);
    expect(once).toHaveBeenCalledTimes(1);
    expect(failed).toMatchObject({ name: "UpstreamError", status: 502 });
    mockFetch(respond('{"detail":"ambiguous"}', 409));
    const conflict = await fetchAllianceByTag(326, "AAA").catch((e: unknown) => e);
    expect(conflict).toBeInstanceOf(UpstreamError);
    expect(conflict).toMatchObject({ status: 409 });
  });
});
