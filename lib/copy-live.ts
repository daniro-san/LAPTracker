// The live event section's words (issue 307, D69), spread into `copy.ledger` by lib/copy.ts.
// Public: translated like the rest of `ledger` (lib/i18n), split out for lib/copy.ts's length.
export const liveCopy = {
  /** The live event section (issue 307): the strip while the event runs, then the section's words. */
  live: "Live",
  liveUpdate: "updated {updated} · next {next}",
  liveReadings: "{n} readings so far",
  liveStandings: "Standings so far",
  liveStandingsDone: "At the last reading",
  liveDuring: "During the event",
  liveStandingsHelp: "Change since Start, most kills gained first",
  livePulse: "Server pulse",
  livePulseHelp: "Kills gained by {n} alliances in each {min} minutes",
  /** `{span}`: two reading intervals, in minutes (30 at the 15-minute cadence). */
  liveBusiest: "Busiest {span} minutes so far: {from}–{to} · {share} of the kills",
  liveBusiestDone: "Busiest {span} minutes: {from}–{to} · {share} of the kills",
  liveNoUpdate: "No update from the game",
  liveNoReading: "No reading",
  liveInterval: "Interval",
  liveKillsGained: "Kills gained",
  /** The strip from the Start until the first reading. */
  liveFirst: "Start {start} · first reading {next}",
  liveNoReadings: "No readings yet",
  /** After the strip's next reading while the slot's sample is more than 3 minutes late. */
  liveOverdue: "(reading due {time})",
  /** `{kills}`: the top three alliances with their gains, or the total until the busiest span is named. */
  liveKillsSoFar: "Kills so far: {kills}",
  liveLast: "Last {min} min: {last} (peak {peak})",
  liveDone: "Change since Start at the {time} reading. The ledger above uses the End at {end}.",
};
