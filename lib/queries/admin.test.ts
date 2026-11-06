import { describe, expect, it } from "vitest";

import { runTrace } from "./admin";

const START = new Date("2026-11-07T12:00:00Z");
const at = (seconds: number) => new Date(START.getTime() + seconds * 1000);

describe("runTrace", () => {
  it("counts the quota call's retries on its row and in the total", () => {
    const logs = [
      { id: 1, at: at(1), code: "v1.retry", unionId: null, data: { retry_n: 1 } },
      { id: 2, at: at(2), code: "v1.retry", unionId: null, data: { retry_n: 2 } },
      { id: 3, at: at(3), code: "v1.fetch", unionId: null, data: { endpoint: "quota" } },
      { id: 4, at: at(4), code: "v1.retry", unionId: 7, data: { retry_n: 1 } },
      { id: 5, at: at(5), code: "v1.fetch", unionId: 7, data: { endpoint: "alliance" } },
    ];

    const trace = runTrace(logs, new Map([[7, "A7"]]), START);

    expect(trace.calls.map((c) => [c.endpoint, c.retries])).toEqual([
      ["quota", 2],
      ["alliance", 1],
    ]);
    expect(trace.total.retries).toBe(3);
  });
});
