// D110: a tab's preset is one of the kinds that save; anything else is a bad request, refused before the
// session is read.
import { describe, expect, it } from "vitest";

import { POST } from "./route";

const ORIGIN = "https://laptracker.test";
const send = (body: unknown) =>
  POST(
    new Request(`${ORIGIN}/api/w/ogs/shots`, {
      method: "POST",
      headers: {
        origin: ORIGIN,
        "sec-fetch-site": "same-origin",
        "content-type": "application/json",
      },
      body: JSON.stringify(body),
    }),
    { params: Promise.resolve({ slug: "ogs" }) },
  );

describe("POST /api/w/[slug]/shots preset (D110)", () => {
  it("answers 400 for a preset that is not a kind that saves", async () => {
    for (const preset of ["map", "elixir_teams", "nonsense", 3]) {
      const res = await send({ pictures: [{ lines: ["x"] }], preset });
      expect([res.status, await res.json()], String(preset)).toEqual([
        400,
        { code: "bad_request" },
      ]);
    }
  });
});
