import { describe, expect, it } from "vitest";

import { patchNotes } from "./patch-notes";

/** v5.10.0 after v5.9.0: compare the numbers, not the letters. */
const newer = (a: string, b: string) => a.localeCompare(b, "en", { numeric: true }) > 0;

describe("patchNotes", () => {
  it("lists versions newest first, with dates that never go forward", () => {
    let prev = patchNotes[0];
    for (const note of patchNotes.slice(1)) {
      expect(newer(prev?.version ?? "", note.version), `${note.version}'s place`).toBe(true);
      expect((prev?.date ?? "") >= note.date, `${note.version}'s date`).toBe(true);
      prev = note;
    }
  });

  it("has each version once, written vX.Y.Z", () => {
    const versions = patchNotes.map((n) => n.version);
    expect(new Set(versions).size).toBe(versions.length);
    for (const v of versions) expect(v).toMatch(/^v\d+\.\d+\.\d+$/);
  });

  it("has real calendar dates written YYYY-MM-DD", () => {
    for (const { version, date } of patchNotes) {
      expect(date, version).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(new Date(`${date}T00:00:00Z`).toISOString().slice(0, 10), version).toBe(date);
    }
  });
});
