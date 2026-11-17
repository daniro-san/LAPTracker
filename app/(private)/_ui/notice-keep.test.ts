import { describe, expect, it } from "vitest";

import { keepKey, keptKeys, restorable } from "./notice-keep";

const opened = {
  title: "Winter fair",
  en: "Bring wool.",
  "pt-BR": "",
  fr: "",
  for_members: "false",
  ends_on: "",
};

describe("the notice text kept on this device (ADV-5)", () => {
  it("keeps one entry per notice, and one for a new notice", () => {
    expect(keepKey("ogs", 4)).toBe("lap:notice:ogs:4");
    expect(keepKey("ogs", null)).toBe("lap:notice:ogs:new");
  });

  it("finds every kept notice entry, and only those, for sign-out to remove", () => {
    expect(keptKeys(["lap:notice:ogs:4", "theme", null, "lap:notice:afr:new", "lap_pin"])).toEqual([
      "lap:notice:ogs:4",
      "lap:notice:afr:new",
    ]);
  });

  it("offers kept text only when it differs from what the editor opens with", () => {
    const typed = { ...opened, en: "Bring wool and tea." };
    expect(restorable(JSON.stringify(typed), opened)).toEqual(typed);
    expect(restorable(JSON.stringify(opened), opened)).toBeNull();
  });

  it("offers nothing for an empty, broken or partial entry", () => {
    expect(restorable(null, opened)).toBeNull();
    expect(restorable("{not json", opened)).toBeNull();
    expect(restorable(JSON.stringify({ title: "Garden rota" }), opened)).toBeNull();
    expect(restorable("null", opened)).toBeNull();
  });
});
