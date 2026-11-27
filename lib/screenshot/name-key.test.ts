import { describe, expect, it } from "vitest";

import { nameKey, nameSegments } from "./name-key";

describe("nameKey", () => {
  it("drops emoji and decoration around a name", () => {
    expect(nameKey("⚜️💙 Moorwick 💙⚜️")).toBe("moorwick");
  });

  it("drops a leading R1 to R5 rank prefix", () => {
    expect(nameKey("R4 Olvendry")).toBe("olvendry");
    expect(nameKey("R5 Olvendry")).toBe(nameKey("Olvendry"));
  });

  it("drops a trailing ++ or +-", () => {
    expect(nameKey("Pellund07 ++")).toBe("pellund07");
    expect(nameKey("Pellund07 +-")).toBe("pellund07");
  });

  it("ignores case and accents", () => {
    expect(nameKey("Pi\u0144o")).toBe(nameKey("PINO"));
    expect(nameKey("No\u00EBmi52")).toBe("noemi52");
  });

  it("treats a Cyrillic look-alike as its Latin letter", () => {
    // The roster spells tinker with a Cyrillic i and e; the screen's OCR reads Latin letters.
    expect(nameKey("tіnkеr")).toBe("tinker");
  });

  it("treats a capital Greek or Cyrillic look-alike as its Latin letter", () => {
    // Capital omicron and the Cyrillic capital Er, written as escapes so the source shows which letters they are.
    expect(nameKey("\u039Fmega")).toBe("omega");
    expect(nameKey("\u0420aul")).toBe("paul");
  });

  it("maps every listed look-alike letter to its own Latin letter", () => {
    expect(nameKey("авекмнорстухіјѕαεικνορτυχ")).toBe("abekmhopctyxijsaeikvoptux");
  });

  it("removes zero-width and filler characters", () => {
    expect(nameKey("Vexoㅤ")).toBe("vexo");
    expect(nameKey("Ve​xo⁠﻿")).toBe("vexo");
  });

  it("leaves an empty key when only decoration is left", () => {
    expect(nameKey("💙⚜️")).toBe("");
  });

  it("keeps a joined name whole in the key and yields its segments", () => {
    expect(nameKey("Tavish•Fearne")).toBe("tavishfearne");
    expect(nameSegments("Tavish•Fearne")).toEqual(["tavish", "fearne"]);
    expect(nameSegments("Vexo")).toEqual(["vexo"]);
  });
});
