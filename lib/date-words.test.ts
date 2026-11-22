// The desk's one way to write a date and a time (issue 585 batch 4, F35): a server day and an instant on the
// server's clock (UTC−2), never the UTC day or the machine's, in each language's own form. The PT and FR
// sentences that end with a date are checked in lib/private/dictionary.test.ts. Invented values.
import { describe, expect, it } from "vitest";

import { dateWords } from "./date-words";

// The machine's own zone is neither UTC nor the server's, so a form that forgot its zone would show it.
process.env.TZ = "Asia/Tokyo";
const SERVER = "Etc/GMT+2";
/** Fri, Nov 20 23:31 ST: already Saturday in UTC and in Tokyo. */
const LATE = new Date("2026-11-21T01:31:00Z");

describe("one way to write a date and a time (issue 585 batch 4)", () => {
  it("writes an instant on the server's clock and a server day as that day, never the UTC or the machine's day", () => {
    const en = dateWords("en", SERVER);
    expect(en.at(LATE)).toBe("Fri, Nov 20, 23:31");
    expect(en.day(LATE)).toBe("Fri, Nov 20");
    expect(en.time(LATE)).toBe("23:31");
    // A server day is that calendar day in any zone.
    expect(en.day("2026-11-20")).toBe("Fri, Nov 20");
    expect(dateWords("en", "Pacific/Auckland").day("2026-11-20")).toBe("Fri, Nov 20");
    expect(en.long("2026-11-20")).toBe("Friday, November 20");
    expect(en.dayMonth("2026-11-20")).toBe("Nov 20");
  });

  it("joins a date and its time the way each language does: a comma, às, à", () => {
    expect(dateWords("en", SERVER).at(LATE)).toBe("Fri, Nov 20, 23:31");
    const pt = dateWords("pt-BR", SERVER);
    expect(pt.at(LATE)).toBe(`${pt.day(LATE)} às 23:31`);
    expect(pt.day(LATE)).toBe("sex., 20 de nov.");
    const fr = dateWords("fr", SERVER);
    expect(fr.at(LATE)).toBe(`${fr.day(LATE)} à 23:31`);
    expect(fr.day(LATE)).toBe("ven. 20 nov.");
  });
});
