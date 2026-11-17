// The live event section's words (issue 307, D69) and the views across events (issue 284, D86), spread into `copy.ledger` by lib/copy.ts.
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
  /** The server fight clock (issue 284, D86): events side by side on their samples, one row each. `{min}` is the cadence. */
  fightClock: "Server fight clock",
  fightClockLead:
    "The tracked alliances' kills, {min} minutes at a time, event by event. A box's height is its share of the kills drawn for that event, from the Start to its last reading.",
  /** The link from an event's "During the event" section. */
  fightClockLink: "Compare with other events on the server fight clock",
  fightClockShare: "Share of the kills",
  fightClockOutline: "Outlined: the busiest {span} minutes of each event",
  fightClockNoBusiest: "Too few readings to name the busiest {span} minutes",
  /** A disabled row: an event with no readings, and why. `{date}` is the first event that has them. */
  fightClockOffSince:
    "No {min}-minute readings for this event (they start with the event of {date})",
  fightClockOffNext: "No {min}-minute readings for this event (they start with the next event)",
  fightClockOffMissed: "No usable {min}-minute readings were stored for this event.",
  fightClockOffWaiting: "The {min}-minute readings come in while this event runs",
  /** No event has readings yet. */
  fightClockNone:
    "Each event's {min}-minute readings will be drawn here, starting with the next event.",
  /** The compare page's server pulse (D57, D86): the section's help, and why it is off. */
  comparePulseHelp:
    "Share of each event's kills gained in each {min} minutes, lined up on the server clock. The busiest {span} minutes are outlined.",
  comparePulseOffA:
    "Event A ({when}) has no {min}-minute readings, so the two events' pulses cannot be compared",
  comparePulseOffB:
    "Event B ({when}) has no {min}-minute readings, so the two events' pulses cannot be compared",
  comparePulseOffBoth:
    "Neither event has {min}-minute readings, so their pulses cannot be compared",
};
