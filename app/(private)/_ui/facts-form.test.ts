// The facts editor's AD Tech field (issue 297, D80): 0–100 with a decimal comma or point.
import { describe, expect, it } from "vitest";

import { percentOf } from "./facts-form";

describe("AD Tech %", () => {
  it("reads 0–100 with a decimal comma or point, and an empty field as no value", () => {
    expect(percentOf("69,5")).toBe(69.5);
    expect(percentOf("69.5")).toBe(69.5);
    expect(percentOf("100")).toBe(100);
    expect(percentOf("0")).toBe(0);
    expect(percentOf("55%")).toBe(55);
    expect(percentOf("")).toBeNull();
  });

  it("refuses above 100 and what is not a number", () => {
    expect(percentOf("100,1")).toBeUndefined();
    expect(percentOf("101")).toBeUndefined();
    expect(percentOf("6,9,5")).toBeUndefined();
    expect(percentOf("-5")).toBeUndefined();
  });
});
