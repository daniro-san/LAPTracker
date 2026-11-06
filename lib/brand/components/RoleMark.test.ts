// DESIGN.md role-mark: an officer's mark is picked from the title text; unknown titles keep the star.
import { describe, expect, it } from "vitest";

import { roleOf } from "@/lib/queries/leadership";

import { Dove, Eye, Horn, officerMark, OfficerStar, Swords } from "./RoleMark";

describe("officerMark", () => {
  it("maps the four title slots and their in-game names, falls back to the star, and leaves an untitled R4 unmarked", () => {
    expect(officerMark("Diplomat")).toBe(Dove);
    expect(officerMark("Recruiter")).toBe(Horn);
    expect(officerMark("Militarist")).toBe(Swords);
    expect(officerMark("Overseer")).toBe(Eye);
    expect(officerMark("  god   of WAR ")).toBe(Swords);
    expect(officerMark("Goddess")).toBe(Eye);

    expect(officerMark("Quartermaster")).toBe(OfficerStar);
    expect(officerMark("constructor")).toBe(OfficerStar);

    expect(roleOf(104, "R4 · Recruiter")).toEqual({ kind: "officer", title: "Recruiter" });
    expect(roleOf(104, "R4")).toBeNull();
  });
});
