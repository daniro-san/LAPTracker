import { describe, expect, it } from "vitest";

import { POST } from "./route";

describe("POST /api/tick (placeholder)", () => {
  it("answers 501 with a JSON body until Session 4 implements the tick", async () => {
    const res = POST();
    expect(res.status).toBe(501);
    expect(await res.json()).toEqual({ error: "not implemented" });
  });
});
