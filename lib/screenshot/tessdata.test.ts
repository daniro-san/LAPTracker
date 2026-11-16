import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

describe("the committed English model", () => {
  it("is the file D74 recorded, byte for byte", () => {
    const file = readFileSync(join(import.meta.dirname, "tessdata/eng.traineddata.gz"));
    expect(createHash("sha256").update(file).digest("hex")).toBe(
      "45b4cb346724ac1774f1c36f42f182b887bcdb28ebe63e6fff90ac41f3fcff91",
    );
  });
});
