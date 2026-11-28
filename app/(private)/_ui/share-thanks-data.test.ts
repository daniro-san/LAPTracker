import { describe, expect, it } from "vitest";

import { WORKSPACE_DICTIONARIES } from "@/lib/private/dictionary";
import type { MembersView } from "@/lib/private/members";

import { weekPeople } from "./share-thanks-data";

const t = WORKSPACE_DICTIONARIES.en;

describe("weekPeople (issue 465)", () => {
  it("merges progress and steady deeds into one entry per person, with a joined line, in name order", () => {
    const view = {
      thanks: {
        progress: [
          { uid: 2, name: "Zed", adDone: true, squadGrowth: null },
          { uid: 1, name: "Ana", adDone: true, squadGrowth: null },
        ],
        steady: { help: [{ uid: 1, name: "Ana" }], quests: [{ uid: 3, name: "Bo" }] },
      },
    } as unknown as MembersView;

    const people = weekPeople(view, t);

    expect(people.map((p) => p.name)).toEqual(["Ana", "Bo", "Zed"]);
    expect(people[0]).toMatchObject({
      uid: 1,
      did: ["ad", "help"],
      line: "finished AD Tech, helped every day",
    });
    expect(people[1]).toMatchObject({ did: ["quests"], line: "did their quests every day" });
  });
});
