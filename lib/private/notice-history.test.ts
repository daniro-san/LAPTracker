// A notice's earlier versions (D102): one save is the rows with one time and one officer, newest first;
// the text a save replaced, and every field as it stood after a save.
import { describe, expect, it } from "vitest";

import { before, fieldsAt, versionsOf } from "./notice-history";

const at = (minute: number) => new Date(Date.UTC(2026, 10, 17, 12, minute));

describe("notice versions", () => {
  it("groups each save's rows, newest first, and reads the text before and the fields at a save", () => {
    // As the repo reads them: newest edit id first.
    const versions = versionsOf([
      { id: 5, field: "en", value: "Apply on Monday.", by: "Wren", at: at(9) },
      { id: 4, field: "fr", value: "Postulez.", by: "Rook", at: at(5) },
      { id: 3, field: "en", value: "Apply today.", by: "Rook", at: at(5) },
      { id: 2, field: "en", value: "Apply.", by: "Rook", at: at(1) },
      { id: 1, field: "title", value: "Queen", by: "Rook", at: at(1) },
    ]);
    expect(versions.map((v) => [v.id, v.by, v.changes.map((c) => c.field)])).toEqual([
      [5, "Wren", ["en"]],
      [4, "Rook", ["en", "fr"]],
      [2, "Rook", ["title", "en"]],
    ]);
    expect(before(versions, 0, "en")).toBe("Apply today.");
    expect(before(versions, 2, "en")).toBeNull();
    expect(fieldsAt(versions, 1)).toEqual({ en: "Apply today.", fr: "Postulez.", title: "Queen" });
  });
});
