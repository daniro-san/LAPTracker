// The alliances' standing against the server (D90, issue 274): the usable daily reads of every tracked
// alliance (the same read as the balance page, D85), ranked by might day by day. Alliance totals only: no
// member row, name or roster key is selected.
import type { Db } from "../db";
import { standing, type Standing } from "../standing";
import { dailyAlliances } from "./balance";

export type { Standing };

/** The standing over the last 7 days of complete daily reads; null without two such days. */
export async function allianceStanding(db: Db, now: Date): Promise<Standing | null> {
  return standing(await dailyAlliances(db, now));
}
