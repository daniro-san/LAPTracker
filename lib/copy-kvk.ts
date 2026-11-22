// The event page's KvK matchup (D152, issue 306): both servers at the Start, and Start to End. Public, so every
// key is translated (D48); lib/copy.ts puts it under `kvk`. Neutral words for both sides: no win, loss or blame.
export const kvkCopy = {
  /** The section's title. */
  title: "KvK matchup",
  /** Under the title: `Server 325 vs server 326 · top 14 alliances each`. */
  versus: "Server {us} vs server {them} · top {n} alliances each",
  /** A side's card title: `Server 326`. */
  side: "Server {server}",
  /** When the side was read: `Read at 10:03 server time (Start)`. */
  readAt: "Read at {time} (Start)",
  /** The opponent's coverage: `14 of 15 alliances read`. */
  tagsRead: "{read} of {k} alliances read",
  might: "Might",
  /** Lifetime kills at the Start. */
  kills: "Kills",
  killsPer1B: "Kills per 1B might",
  heavy: "Members with 60M+ might",
  /** `113 of 1,380`. */
  heavyValue: "{h} of {m}",
  /** Under the cards. */
  help: "Kills are lifetime kills at the Start. Kills per 1B might: higher means more kills for its size.",
  /** The panel with each side's alliances, ranked by might at the Start. */
  byAlliance: "Alliance by alliance",
  /** The second part's title. */
  change: "Start to End",
  /** Before the End has run: `Start to End appears after the End (14:00 server time).` */
  changeLater: "Start to End appears after the End ({time}).",
  /** A side's headline: `12 of 14 alliances counted`. */
  counted: "{c} of {n} alliances counted",
  /** Under it: `1,204 members in both readings`. */
  overMembers: "{m} members in both readings",
  mightChange: "Might change",
  killsGained: "Kills gained",
  /** An alliance's Start to End in the list: `Change: Might −40.0M · Kills +900K`. */
  changeLine: "Change: Might {might} · Kills {kills}",
  /** An alliance with no usable End. */
  noChange: "No change: a reading is stale or missing",
  /** Under Start to End. */
  changeHelp:
    "Kills count every kill, whoever the target. Only members in the alliance at Start and End are counted.",
} as const;
