// The e2e seed's Needs help marks (issue 585 slice 2), apart from seed.ts for its size: Lantern Keep's
// NEEDS_HELP member, and the member each feature-switch workspace's "No longer needs help" test clears
// (clearHelpOf). Every row is written as recordFollowUp writes it: "They need help" writes the status fact
// (version 1) and its record with that fact version, by the same officer at the same moment.
import { ALLIANCES, clearHelpOf, NEEDS_HELP, REPEATS, uidOf } from "./seed-people";

const DAY_MS = 86_400_000;
const iso = (ms: number) => new Date(ms).toISOString().slice(0, 10);
const q = (s: string) => `'${s.replace(/'/g, "''")}'`;

/**
 * The days of NEEDS_HELP's two records from the seed's week (`week`, this Monday): "They need help" on the
 * Friday of the week before last, "Talked to them" on last week's Friday.
 */
export function helpDays(week: string) {
  const monday = Date.parse(week);
  return { marked: iso(monday - 10 * DAY_MS), talked: iso(monday - 3 * DAY_MS) };
}

const at = (day: string) => `'${day}T12:00:00-02:00'`;

/** A "They need help" with `note`: the status fact and its record. */
function marked(ws: number, uid: number, officer: number, day: string, requestId: string) {
  return [
    `insert into member_facts (workspace_id, uid, field, version, value, source, written_by, written_at) values (${ws}, ${uid}, 'status', 1, '"help"', 'officer', ${officer}, ${at(day)});`,
    `insert into member_follow_ups (workspace_id, uid, action, note, until, fact_version, written_by, written_at, request_id) values (${ws}, ${uid}, 'help', ${q(NEEDS_HELP.note)}, null, 1, ${officer}, ${at(day)}, '${requestId}');`,
  ];
}

/** Every Needs help row of the seed; NEEDS_HELP also has a Talked last week (a record only). */
export function needsHelpRows(week: string): string[] {
  const days = helpDays(week);
  const ws = ALLIANCES.a.id;
  const uid = uidOf("a", NEEDS_HELP.k);
  const cleared = Array.from({ length: REPEATS }, (_, r) => {
    const c = clearHelpOf(r);
    return marked(c.workspaceId, c.uid, c.officer, days.marked, `00000000-0000-4000-8000-00000000059${r}`);
  }).flat();
  return [
    ...cleared,
    ...marked(ws, uid, 1, days.marked, "00000000-0000-4000-8000-000000000585"),
    `insert into member_follow_ups (workspace_id, uid, action, note, until, fact_version, written_by, written_at, request_id) values (${ws}, ${uid}, 'talked', ${q(NEEDS_HELP.said)}, null, null, 1, ${at(days.talked)}, '00000000-0000-4000-8000-000000000586');`,
  ];
}
