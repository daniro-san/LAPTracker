// /admin's Status section, re-exported as `copy.admin.status`: facts only, and the verdicts beside them (the
// API reading, a late scheduler, issue 585 F34). English only (D48).
import { DAILY_QUOTA_TEXT } from "./budget";

export const statusAdminCopy = {
  title: "Status",
  quota: "API calls left today",
  quotaValue: `{n} of ${DAILY_QUOTA_TEXT}`,
  /** A reading above the site's daily quota, where `quotaValue` would contradict itself (F34). */
  quotaLeft: "{n} left",
  quotaOk: "OK",
  quotaLow: "Low · under {n}",
  /** Today's reading is above the site's daily quota (F34): not what the site plans for, so no "OK". */
  quotaAbove: `Above the ${DAILY_QUOTA_TEXT} plan`,
  quotaUnknown: "Unknown",
  quotaNote: "Last read {at}",
  /** The reading is from an earlier UTC day, when the quota was another one (it resets every UTC day). */
  quotaOld: "Not read today",
  quotaNoteOld: "Last read {at}. Today's first run reads it again.",
  quotaNone: "No run has reported it yet.",
  running: "Running now",
  nothing: "Nothing",
  next: "Next scheduled run",
  nextValue: "{phase} · {at}",
  nextNote: "{event} · event {at}",
  /** The event keeps its generated name, so its date is the name. */
  nextNoteDated: "Event {at}",
  last: "Last result",
  noRun: "No run yet.",
  open: "Open this run",
  tick: "Last tick",
  noTick: "No tick recorded yet.",
  tickNote: "Newest first: {list}",
  /** No tick since the newest heartbeat slot the watcher judges (D45, D141). */
  tickLate: "Late",
  tickOutcome: {
    idle: "nothing due",
    run: "snapshot",
    "quota-check": "quota check",
    rehearsal: "rehearsal",
    none: "no end",
  },
};
