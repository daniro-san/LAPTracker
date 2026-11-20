// Which alliances are read (D133, superseding D4's fixed list). Alliances are addressed by union_id (plan §3.4):
// tags are case-sensitive and not unique, ids never change. Every alliance on the server comes from the ranks
// board, read each server day before the daily read; the TRACKED_COUNT with the most board might that day are
// the tracked set (`tracked_sets`), read every day and by events. A change needs no code change or redeploy.
// A running event keeps its own copy (events.alliance_ids, written by its Before).

export const SERVER = 325;

/** How many alliances, by board might, the daily read and every event read (D133). */
export const TRACKED_COUNT = 20;

/** The most "Get today's details" reads the whole site makes in one server day (D133). */
export const LOOKUPS_PER_DAY = 30;

/** The site's own alliance (OGs): the one the Friday admin message counts unchanged and lost might for (D70). */
export const OWN_ALLIANCE_ID = 67111155;
