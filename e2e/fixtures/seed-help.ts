// The e2e seed's Needs help marks (issue 585 slice 2), apart from seed.ts for its size: Lantern Keep's
// NEEDS_HELP member, and the member each feature-switch workspace's "No longer needs help" test clears
// (clearHelpOf). Every row is written as recordFollowUp writes it: "They need help" writes the status fact
// (version 1) and its record with that fact version, by the same officer at the same moment.
// D154: the self-report member of each filler workspace (selfReportRows). CARD_TALKED's "All fine" this week.
import {
  ALLIANCES,
  CARD_TALKED,
  clearHelpOf,
  NEEDS_HELP,
  REPEATS,
  selfReportOf,
  uidOf,
} from "./seed-people";

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
    ...notedRows(),
  ];
}

/**
 * CARD_TALKED's "All fine" this week (a record only, as recordFollowUp writes it), half a minute before the
 * seed and a second apart: after the members ADDED_BY_HAND (a minute before), so before every test's write.
 */
function notedRows(): string[] {
  return Object.values(CARD_TALKED).map(
    (k, i) =>
      `insert into member_follow_ups (workspace_id, uid, action, note, until, fact_version, written_by, written_at, request_id) values (${ALLIANCES.a.id}, ${uidOf("a", k)}, 'fine', null, null, null, 1, now() - interval '${30 - i} seconds', '00000000-0000-4000-8000-00000000060${i}');`,
  );
}

/**
 * D154: in each filler workspace, a member with an approved link to the filler's second roster member and a
 * member session of their own, for the test that sends a time zone from Me (selfReportOf).
 */
export function selfReportRows(repeat: number, hash: (token: string) => string): string[] {
  const m = selfReportOf(repeat);
  const w = m.workspace;
  return [
    `insert into workspace_users (id, workspace_id, discord_user_id, display_name, allowlisted, last_login_at, player_uid, player_link, player_linked_at) values (${m.user}, ${w.id}, '70000000000000040${m.user}', 'Member ${w.tag}', false, now(), ${m.uid}, 'approved', now());`,
    `insert into workspace_sessions (token_hash, workspace_id, workspace_user_id, created_at, expires_at, checked_at, tier) values ('${hash(m.token)}', ${w.id}, ${m.user}, now(), now() + interval '6 days', now(), 'member');`,
  ];
}
