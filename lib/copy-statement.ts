// The alliance page's statement and joining card (D128, issue 479), `copy.statement` in lib/copy.ts.
// Public: translated like the rest of the public pages (lib/i18n). The statement itself is the alliance's
// own text and is never translated here; these are only the words around it.
export const statementCopy = {
  title: "Statement and joining",
  /** Without a statement, the card is only the joining line. */
  joining: "Joining",
  /** Above the alliance's text, so nobody reads it as ours. */
  by: "Written by the alliance in game",
  /** The joining line's first part (`join.auto`). */
  open: "Open to join",
  byApplication: "By application",
  /** The least might to join, `{might}` compact with a `+` (`8.00M+`). */
  might: "{might} might",
  /** The least headquarters level to join, `{level}` with a `+` (`14+`). */
  hq: "HQ {level}",
  /** Free places: `0 seats open (100/100)`. */
  seats: "{n} seats open ({members}/{capacity})",
  seatOne: "1 seat open ({members}/{capacity})",
  /** No seat open; the game can report more members than places (`101/100`). */
  full: "Full ({members}/{capacity})",
  /** Opens the whole statement when it is cut after about six lines. */
  showAll: "Show all",
  showLess: "Show less",
} as const;
