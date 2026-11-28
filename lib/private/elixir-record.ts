// An Elixir Scramble team's record (issue 468, D103 amended): Won or Lost from the two scores, a member's
// last 4 seats, and the follow-up line. People first (D75): only an officer's explicit mark counts. A week
// nobody marked, "the rest" (an assumption), Sub, Excused and Registered never count against anyone, and
// nothing happens on its own: the line is a suggestion to ask, shown on the card.
import type { Db } from "../db";
import { newestMarks, resultsOf, seatCalls } from "../repo/roll-call";
import type { WorkspaceAccess } from "./access";
import { outcomeOf, type Mark, type Outcome } from "./roll-call-rules";

/** One seat the member held on an Elixir Scramble team. */
export interface Seat {
  day: string;
  variant: string | null;
  mark: Mark | null;
  score: number | null;
  /** An officer tapped the mark; false for none, for "the rest" and for anything else automatic. */
  explicit: boolean;
  outcome: Outcome | null;
}

/** How many of the newest seats the card shows and the follow-up reads. */
export const LAST = 4;
/** "Did not join" marks by an officer, among the last 4 seats, that make the follow-up line show. */
export const MISSED_AT = 2;

/** The newest seats first, at most `LAST`. */
export const lastSeats = (seats: readonly Seat[]): Seat[] =>
  [...seats].sort((a, b) => b.day.localeCompare(a.day)).slice(0, LAST);

/** How many of the last 4 seats an officer marked "Did not join". Nothing else adds to it. */
export const missedSeats = (seats: readonly Seat[]): number =>
  lastSeats(seats).filter((s) => s.explicit && s.mark === "no").length;

/** The member's last 4 seats with the marks officers wrote and the team's result. */
export async function seatsOf(db: Db, access: WorkspaceAccess, uid: number): Promise<Seat[]> {
  const calls = await seatCalls(db, access.workspaceId, uid, LAST);
  const ids = calls.map((c) => c.id);
  const [marks, results] = await Promise.all([newestMarks(db, ids), resultsOf(db, ids)]);
  return calls.map((c) => {
    const m = marks.find((x) => x.rollCallId === c.id && x.uid === uid);
    const r = results.find((x) => x.rollCallId === c.id);
    return {
      day: c.day,
      variant: c.variant,
      mark: (m?.mark ?? null) as Mark | null,
      score: m?.score ?? null,
      explicit: !!m?.officer && !m.rest && !m.tracker,
      outcome: r ? outcomeOf(r.ourScore, r.theirScore) : null,
    };
  });
}
