// Request ids where crypto.randomUUID is missing (issue 395, D115).
import { afterEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";

import { newRequestId } from "./request-id";

afterEach(() => vi.unstubAllGlobals());

describe("newRequestId", () => {
  it("makes a v4 UUID the routes accept, also in a browser without crypto.randomUUID", () => {
    vi.stubGlobal("crypto", { getRandomValues: crypto.getRandomValues.bind(crypto) });
    const ids = Array.from({ length: 50 }, newRequestId);
    for (const id of ids) {
      expect(z.uuid().safeParse(id).success).toBe(true);
      expect(id[14]).toBe("4");
    }
    expect(new Set(ids).size).toBe(50);
  });
});
