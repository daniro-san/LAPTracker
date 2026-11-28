// The member card's "Last 4 Elixir" block (issue 468, D103 and D136 amendments): the member's last 4 seats on
// an Elixir Scramble team, each with the mark an officer wrote, the score and the team's Won or Lost, and,
// only when officers explicitly marked "Did not join" on at least two of them, a plain line suggesting to
// ask if the time suits them. People first (D75): an unmarked week, "the rest", Sub, Excused and Registered
// never count, nothing is decided or sent from it, and a member with no seat gets no block.
import type { Db } from "../db";
import { fill } from "../words";
import type { WorkspaceAccess } from "./access";
import { calendarDates } from "./calendar-words";
import type { WorkspaceDictionary, WorkspaceLanguage } from "./dictionary";
import { lastSeats, MISSED_AT, missedSeats, seatsOf, type Seat } from "./elixir-record";
import { featureOn } from "./features";
import { markWord } from "./roll-call-words";

export interface CardElixir {
  /** "Last 4 Elixir". */
  head: string;
  /** "Fri, Nov 20 · Joined · 1200 · Won", newest first; a week no one marked says "Not set". */
  rows: string[];
  /** The follow-up line, or null. */
  followUp: string | null;
}

/** One seat in words: the day, the mark (or "Not set"), the score, and Won, Lost or Tie. */
export function seatLine(s: Seat, t: WorkspaceDictionary, date: (day: string) => string): string {
  const mark = s.mark ? markWord(s.mark, "elixir", t) : t["roll.notSet"];
  return [
    date(s.day),
    mark,
    ...(s.score === null ? [] : [String(s.score)]),
    ...(s.outcome ? [t[`roll.result.${s.outcome}`]] : []),
  ].join(" · ");
}

/** The card's block from the member's seats, or null with none. */
export function elixirCard(
  seats: readonly Seat[],
  t: WorkspaceDictionary,
  language: WorkspaceLanguage,
): CardElixir | null {
  const last = lastSeats(seats);
  if (last.length === 0) return null;
  const missed = missedSeats(seats);
  const dates = calendarDates(language);
  return {
    head: t["roll.last4.head"],
    rows: last.map((s) => seatLine(s, t, dates.short)),
    followUp:
      missed < MISSED_AT
        ? null
        : missed === 2
          ? t["roll.last4.twice"]
          : fill(t["roll.last4.times"], { n: missed }),
  };
}

/** Only while the Roll call tab is on, and for the workspace's own alliance (the seats are its own). */
export async function cardElixir(
  db: Db,
  access: WorkspaceAccess,
  uid: number,
  at: { language: WorkspaceLanguage; t: WorkspaceDictionary },
): Promise<CardElixir | null> {
  if (!featureOn(access, "roll_call")) return null;
  return elixirCard(await seatsOf(db, access, uid), at.t, at.language);
}
