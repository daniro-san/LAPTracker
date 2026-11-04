import { describe, expect, it } from "vitest";

import { REDACTED, redact } from "./redact";

describe("redact", () => {
  it("masks secret headers, known secret values and LAP keys at any depth", () => {
    const input = {
      headers: { Authorization: "Bearer abc", "x-edit-pin": "123456" },
      url: "https://example.test/?pin=987654",
      nested: [{ note: "key lap_AbCdEf0123456789 leaked" }],
      count: 3,
    };
    expect(redact(input, ["987654"])).toEqual({
      headers: { Authorization: REDACTED, "x-edit-pin": REDACTED },
      url: `https://example.test/?pin=${REDACTED}`,
      nested: [{ note: `key ${REDACTED} leaked` }],
      count: 3,
    });
  });
});
