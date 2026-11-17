// "Read from a screenshot" (D109): the text read from a picture goes into the paste box and fills the
// editor's fields as pasted text does. Invented chat lines.
import { describe, expect, it } from "vitest";

import { parseOnboarding } from "@/lib/private/onboarding-parse";

import { formOf, propose } from "./facts-form";
import { pictureText } from "./screenshot-upload";

describe("Read from a screenshot (D109)", () => {
  it("puts the picture's lines into the paste box, and the paste's reading fills the fields", () => {
    const pages = [["Lv.27 [OGs] Ana", "  Main squad 12.3 M  ", ""], ["AD Tech 74%"]];
    const text = pictureText(pages);
    expect(text).toBe("Lv.27 [OGs] Ana\nMain squad 12.3 M\nAD Tech 74%");
    const [form, filled] = propose(
      formOf({}, "en"),
      parseOnboarding(text, new Date(), "UTC"),
      "en",
    );
    expect(filled).toEqual(["squadMight", "adTech"]);
    expect(form).toMatchObject({ squadMight: "12,300,000", adTech: "74" });
  });
});
