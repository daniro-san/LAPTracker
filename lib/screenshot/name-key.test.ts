import { describe, expect, it } from "vitest";

import { nameKey, nameSegments } from "./name-key";

describe("nameKey", () => {
  it("drops emoji and decoration around a name", () => {
    expect(nameKey("⚜️💙 Danirosan 💙⚜️")).toBe("danirosan");
  });

  it("drops a leading R1 to R5 rank prefix", () => {
    expect(nameKey("R4 Arephrey")).toBe("arephrey");
    expect(nameKey("R5 Arephrey")).toBe(nameKey("Arephrey"));
  });

  it("drops a trailing ++ or +-", () => {
    expect(nameKey("Barthez01 ++")).toBe("barthez01");
    expect(nameKey("Barthez01 +-")).toBe("barthez01");
  });

  it("ignores case and accents", () => {
    expect(nameKey("Vi\u0144s")).toBe(nameKey("VINS"));
    expect(nameKey("La\u00EBti38")).toBe("laeti38");
  });

  it("treats a Cyrillic look-alike as its Latin letter", () => {
    // The roster spells sinner with a Cyrillic i and e; the screen's OCR reads Latin letters.
    expect(nameKey("sіnnеr")).toBe("sinner");
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
    expect(nameKey("Trizㅤ")).toBe("triz");
    expect(nameKey("Tr​iz⁠﻿")).toBe("triz");
  });

  it("leaves an empty key when only decoration is left", () => {
    expect(nameKey("💙⚜️")).toBe("");
  });

  it("keeps a joined name whole in the key and yields its segments", () => {
    expect(nameKey("Kasoar•Thorne")).toBe("kasoarthorne");
    expect(nameSegments("Kasoar•Thorne")).toEqual(["kasoar", "thorne"]);
    expect(nameSegments("Triz")).toEqual(["triz"]);
  });
});
