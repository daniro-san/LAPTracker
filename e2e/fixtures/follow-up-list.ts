// Follow-up's list on Lantern Keep's seed (issue 585), shared by desk.spec.ts and desk-kvk.spec.ts.
import { kvkWeek, newMembers, seededAt } from "./seed";

/**
 * How many Follow-up lists: the new members (each with every fact to ask), the member marked Needs help
 * (slice 2), and HEAVY_HIT in the week after the last KvK (slice 5).
 */
export const toLookOf = (at = seededAt()) => newMembers("a").length + 1 + (kvkWeek(at) ? 1 : 0);
