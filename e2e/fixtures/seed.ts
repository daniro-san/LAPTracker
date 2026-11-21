// The e2e seed (issue 477): two alliances with a workspace each, three filler alliances, 14 days of daily
// rosters, two past Saturday events, this week's Raid prep and a cheese roll call, an officer's and a member's
// session per workspace. Invented names only. Dates follow the day the suite runs, in server time (UTC−2),
// so every run sees the same week shape. Each alliance's roster rows carry its own sentinel values for the
// private roster fields, so a test can tell a leak, and whose it is, from any page or answer.
import { createHash } from "node:crypto";

export type Side = "a" | "b";

/**
 * The private roster fields' values in each alliance's raw_json (CLAUDE.md "Roster fields"): six-digit map
 * coordinates, and four years no page shows otherwise. Last online falls on a 29 February, which the member
 * card writes as "Feb 29" (no year), so a formatted leak can be seen too.
 */
export const SENTINELS = {
  a: { x: 713579, y: 713580, lastOnline: "2088-02-29T12:00:00Z", joined: "2086-05-21T06:07:08Z" },
  b: { x: 824681, y: 824682, lastOnline: "2092-02-29T12:00:00Z", joined: "2090-06-22T07:08:09Z" },
} as const;
export const AVATAR_SENTINEL = "e2e-avatar-sentinel.invalid";

const A_NAMES = [
  "Bramblewick",
  "Corin Ashdown",
  "Delphine Marr",
  "Esk Vale",
  "Fennick Lowe",
  "Galen Thorne",
  "Hessa Quill",
  "Ivo Brandt",
  "Juno Pell",
  "Kestrel Ames",
  "Mabry Holt",
  "Nyla Fairweather",
];
const B_NAMES = [
  "Orrin Slate",
  "Pella Dunmore",
  "Quill Harrow",
  "Rook Ashby",
  "Sable Wren",
  "Tamsin Oakes",
  "Ulric Moss",
  "Vesna Kay",
];

export const ALLIANCES = {
  a: { id: 1, slug: "lnk", unionId: 900101, tag: "LNK", name: "Lantern Keep", names: A_NAMES },
  b: { id: 2, slug: "msh", unionId: 900202, tag: "MSH", name: "Moss Hollow", names: B_NAMES },
} as const;
const FILLERS = [
  { unionId: 900303, tag: "IRT", name: "Iron Thistle" },
  { unionId: 900404, tag: "MNW", name: "Moonwake" },
  { unionId: 900505, tag: "GLW", name: "Glass Wolves" },
];

const uidOf = (side: Side, k: number) => ALLIANCES[side].unionId * 10 + k;
/** Lantern Keep's member who left during the last event, and the one who joined. */
export const LEAVER = 10;
export const JOINER = 11;
/** The member each workspace's member session is linked to (approved, D142). */
export const LINKED_MEMBER = 3;
export const LINKED = { a: uidOf("a", LINKED_MEMBER), b: uidOf("b", LINKED_MEMBER) };
export const memberUid = uidOf;

/** Raid prep this week: Shield marks for these members, a wall mark only for these (issue 590 F1). */
export const SHIELD_MARKED = [0, 1, 2, 3];
export const WALL_ONLY = [4, 5];
/** Calendar entries: the weekly KvK (Raid prep) and this week's cheese. */
export const KVK_ENTRY = 1;
export const CHEESE_ENTRY = 2;

/** Session tokens: invented, local only; the database keeps their sha256 (lib/private/session.ts). */
export const TOKENS = {
  a: { officer: "e2e-session-lnk-officer-token-000001", member: "e2e-session-lnk-member-token-000002" },
  b: { officer: "e2e-session-msh-officer-token-000003", member: "e2e-session-msh-member-token-000004" },
} as const;

const DAY_MS = 86_400_000;
const iso = (ms: number) => new Date(ms).toISOString().slice(0, 10);
const q = (s: string | null) => (s === null ? "null" : `'${s.replace(/'/g, "''")}'`);
const arr = (xs: (string | number)[]) =>
  q(`{${xs.map((x) => (typeof x === "string" ? `"${x}"` : x)).join(",")}}`);
const hash = (token: string) => createHash("sha256").update(token).digest("hex");

/** The server day (UTC−2) `now` falls on, as midnight UTC of that date. */
function serverDay(now: Date) {
  return Date.parse(iso(now.getTime() - 2 * 3_600_000));
}

/**
 * The days the seed is laid out on: this Monday (the cheese roll call's week), the next Saturday on or after
 * today with its Monday (Raid prep: the Me page lists only roll calls from today on, so on a Sunday it is
 * next week's), and the last two Saturdays before today (the events).
 */
export function calendarOf(now: Date) {
  const today = serverDay(now);
  const dow = new Date(today).getUTCDay();
  const lastSat = today - ((dow + 1) % 7 || 7) * DAY_MS;
  const raid = today + ((6 - dow + 7) % 7) * DAY_MS;
  return {
    today,
    week: iso(today - ((dow + 6) % 7) * DAY_MS),
    raid: { day: iso(raid), week: iso(raid - 5 * DAY_MS) },
    events: [iso(lastSat - 7 * DAY_MS), iso(lastSat)],
  };
}

/** The moment the global setup seeded at (E2E_NOW, which Playwright passes to its workers). */
export const seededAt = () => new Date(Number(process.env.E2E_NOW ?? Date.now()));

type Member = { uid: number; name: string; power: number; kills: number };
const members = (side: Side, day: number): Member[] =>
  ALLIANCES[side].names.map((name, k) => ({
    uid: uidOf(side, k),
    name,
    power: 40_000_000 - k * 2_500_000 + day * 50_000,
    kills: 1_000_000 + k * 40_000 + day * 3_000,
  }));

function rawMember(side: Side, m: Member, k: number) {
  const s = SENTINELS[side];
  return {
    uid: m.uid,
    nick_name: m.name,
    power: m.power,
    kills: m.kills,
    lv: 25,
    rank_code: k === 0 ? 105 : k < 3 ? 104 : 102,
    rank_label: k === 0 ? "R5" : k < 3 ? "R4" : "R2",
    active: 400,
    daily_honor: 1000,
    daily_tech: 3000,
    x: s.x,
    y: s.y,
    online: true,
    last_online_at: s.lastOnline,
    joined_at: s.joined,
    avatar_url: `https://${AVATAR_SENTINEL}/${m.uid}.png`,
  };
}

function rosterRow(side: Side, day: string, list: Member[]) {
  const { unionId, tag, name } = ALLIANCES[side];
  const raw = { union_id: unionId, abbr: tag, name, members: list.map((m, k) => rawMember(side, m, k)) };
  const total = (f: (m: Member) => number) => list.reduce((s, m) => s + f(m), 0);
  return `insert into daily_rosters (read_day, union_id, tag, name, member_count, total_power, total_kills, source_updated_at, is_fresh, member_uids, member_names, member_power, member_kills, raw_json) values ('${day}', ${unionId}, '${tag}', ${q(name)}, ${list.length}, ${total((m) => m.power)}, ${total((m) => m.kills)}, '${day}T23:31:00-02:00', true, ${arr(list.map((m) => m.uid))}, ${arr(list.map((m) => m.name))}, ${arr(list.map((m) => m.power))}, ${arr(list.map((m) => m.kills))}, ${q(JSON.stringify(raw))}::jsonb);`;
}

/** Lantern Keep without the joiner before the last event, without the leaver after it. */
const onRoster = (side: Side, k: number, afterLastEvent: boolean) =>
  side === "b" || (afterLastEvent ? k !== LEAVER : k !== JOINER);

function dailyReads(today: number, lastEvent: string): string[] {
  const lines: string[] = [];
  for (let n = 14; n >= 1; n--) {
    const day = iso(today - n * DAY_MS);
    lines.push(
      `insert into daily_reads (day, started_at, finished_at, status, calls_used, quota_remaining_before) values ('${day}', '${day}T23:30:00-02:00', '${day}T23:34:00-02:00', 'complete', 9, 4000);`,
    );
    for (const side of ["a", "b"] as const) {
      const list = members(side, 14 - n).filter((_, k) => onRoster(side, k, day >= lastEvent));
      lines.push(rosterRow(side, day, list));
    }
    for (const f of FILLERS)
      lines.push(
        `insert into daily_rosters (read_day, union_id, tag, name, member_count, total_power, source_updated_at, is_fresh, member_uids, member_names, member_power, member_kills) values ('${day}', ${f.unionId}, '${f.tag}', ${q(f.name)}, 2, 30000000, '${day}T23:31:00-02:00', true, '{${f.unionId}1,${f.unionId}2}', '{"${f.tag} one","${f.tag} two"}', '{20000000,10000000}', '{500000,400000}');`,
      );
  }
  return lines;
}

function snapshotRows(snapshotId: number, side: Side, list: Member[], at: string) {
  const { unionId, tag, name } = ALLIANCES[side];
  const total = (f: (m: Member) => number) => list.reduce((s, m) => s + f(m), 0);
  return [
    `insert into alliance_snapshots (snapshot_id, union_id, tag, name, member_count, total_power, total_kills, source, is_fresh, source_updated_at, member_uids, member_names, member_power, member_kills) values (${snapshotId}, ${unionId}, '${tag}', ${q(name)}, ${list.length}, ${total((m) => m.power)}, ${total((m) => m.kills)}, 'v1', true, '${at}', ${arr(list.map((m) => m.uid))}, ${arr(list.map((m) => m.name))}, ${arr(list.map((m) => m.power))}, ${arr(list.map((m) => m.kills))});`,
    `insert into member_snapshots (alliance_snapshot_id, uid, name, power, kills, lv, avatar_url, rank_code, rank_label) values ${list
      .map(
        (m) =>
          `(currval('alliance_snapshots_id_seq'), ${m.uid}, ${q(m.name)}, ${m.power}, ${m.kills}, 25, 'https://${AVATAR_SENTINEL}/${m.uid}.png', 102, 'R2')`,
      )
      .join(", ")};`,
  ];
}

/** Each event's Start and End for both alliances and the fillers; the End loses might and gains kills. */
function eventRows(events: string[]): string[] {
  const ids = [ALLIANCES.a.unionId, ALLIANCES.b.unionId, ...FILLERS.map((f) => f.unionId)];
  return events.flatMap((day, n) => {
    const last = n === events.length - 1;
    const lines = [
      `insert into events (id, name, event_at_utc, alliance_ids, before_at, after_at, visibility) values (${n + 1}, 'Saturday Event ${day}', '${day}T12:00:00-02:00', '{${ids}}', '${day}T10:00:00-02:00', '${day}T14:00:00-02:00', 'history');`,
    ];
    for (const [phase, offset] of [
      ["before", 0],
      ["after", 1],
    ] as const) {
      const sid = 2 * n + 1 + offset;
      const at = `${day}T${phase === "before" ? "10" : "14"}:00:00-02:00`;
      lines.push(
        `insert into snapshots (id, event_id, phase, started_at, finished_at, status, calls_used, duration_ms) values (${sid}, ${n + 1}, '${phase}', '${at}', '${at}', 'complete', 5, 4000);`,
      );
      for (const side of ["a", "b"] as const) {
        const list = members(side, 0)
          .filter((_, k) => onRoster(side, k, last && phase === "after"))
          .map((m) => ({ ...m, power: m.power - offset * 3_000_000, kills: m.kills + offset * 90_000 }));
        lines.push(...snapshotRows(sid, side, list, at));
      }
      for (const f of FILLERS)
        lines.push(
          `insert into alliance_snapshots (snapshot_id, union_id, tag, name, member_count, total_power, total_kills, source, is_fresh, source_updated_at) values (${sid}, ${f.unionId}, '${f.tag}', ${q(f.name)}, 2, ${30_000_000 - offset * 1_000_000}, ${900_000 + offset * 20_000}, 'v1', true, '${at}');`,
        );
    }
    return lines;
  });
}

function workspaceRows(): string[] {
  const lines: string[] = [];
  for (const [n, side] of (["a", "b"] as const).entries()) {
    const w = ALLIANCES[side];
    const officer = 2 * n + 1;
    const member = 2 * n + 2;
    lines.push(
      `insert into workspaces (id, slug, union_id, discord_guild_id, leader_role_ids, member_role_ids) values (${w.id}, '${w.slug}', ${w.unionId}, '70000000000000010${w.id}', '{70000000000000020${w.id}}', '{70000000000000030${w.id}}');`,
      `insert into workspace_features (workspace_id, switches) values (${w.id}, '{}');`,
      `insert into workspace_users (id, workspace_id, discord_user_id, display_name, allowlisted, last_login_at, player_uid, player_link, player_linked_at) values (${officer}, ${w.id}, '70000000000000040${officer}', 'Officer ${w.tag}', true, now(), ${uidOf(side, 0)}, 'approved', now()), (${member}, ${w.id}, '70000000000000040${member}', 'Member ${w.tag}', false, now(), ${LINKED[side]}, 'approved', now());`,
      `insert into workspace_sessions (token_hash, workspace_id, workspace_user_id, created_at, expires_at, checked_at, tier) values ('${hash(TOKENS[side].officer)}', ${w.id}, ${officer}, now(), now() + interval '6 days', now(), 'officer'), ('${hash(TOKENS[side].member)}', ${w.id}, ${member}, now(), now() + interval '6 days', now(), 'member');`,
    );
  }
  return lines;
}

/** This week's Raid prep (the weekly KvK entry) with its marks, and a cheese entry with no roll call yet. */
function rollCallRows(cal: ReturnType<typeof calendarOf>): string[] {
  const ws = ALLIANCES.a.id;
  const marks = [
    ...SHIELD_MARKED.map((k) => `(1, ${uidOf("a", k)}, 1, 'main', '${k === LINKED_MEMBER ? "no" : "yes"}', 1, false)`),
    ...WALL_ONLY.map((k) => `(1, ${uidOf("a", k)}, 1, 'wall', 'yes', 1, false)`),
  ];
  return [
    `insert into calendar_entries (id, workspace_id, kind, level, day, minute, weekly, for_members, created_by) values (${KVK_ENTRY}, ${ws}, 'kvk', null, '${cal.events[0]}', 720, true, true, 1), (${CHEESE_ENTRY}, ${ws}, 'cheese', 6, '${cal.week}', 1200, true, true, 1);`,
    `insert into roll_calls (id, workspace_id, kind, day, week, entry_id, created_by) values (1, ${ws}, 'shield', '${cal.raid.day}', '${cal.raid.week}', ${KVK_ENTRY}, 1);`,
    `insert into roll_call_marks (roll_call_id, uid, version, part, mark, written_by, by_tracker, written_at) select *, now() from (values ${marks.join(", ")}) v;`,
  ];
}

/** The whole seed as one transaction, for psql. */
export function seedSql(now: Date): string {
  const cal = calendarOf(now);
  const first = iso(cal.today - 14 * DAY_MS);
  const last = iso(cal.today - DAY_MS);
  const all = [ALLIANCES.a, ALLIANCES.b, ...FILLERS];
  const alliances = all.map((x) => `(${x.unionId}, '${x.tag}', ${q(x.name)}, '${first}', '${last}')`);
  // Yesterday's ranks board and tracked set (D133), which the alliance list is drawn from.
  const board = all.map(
    (x, n) =>
      `('${last}', ${x.unionId}, '${x.tag}', ${q(x.name)}, ${300_000_000 - n * 50_000_000}, ${n + 1}, ${10_000_000 - n * 1_000_000}, ${n + 1}, '${last}T22:00:00-02:00')`,
  );
  return [
    "begin;",
    `insert into alliances (union_id, tag, name, first_seen_day, last_seen_day) values ${alliances.join(", ")};`,
    `insert into alliance_board (day, union_id, tag, name, power, power_rank, kills, kills_rank, pulled_at) values ${board.join(", ")};`,
    `insert into tracked_sets (day, alliance_ids, source, created_at) values ('${last}', '{${all.map((x) => x.unionId)}}', 'board', '${last}T22:00:00-02:00');`,
    ...dailyReads(cal.today, cal.events[1] as string),
    ...eventRows(cal.events),
    ...workspaceRows(),
    ...rollCallRows(cal),
    "select setval('events_id_seq', 100), setval('snapshots_id_seq', 100), setval('workspaces_id_seq', 100), setval('workspace_users_id_seq', 100), setval('calendar_entries_id_seq', 100), setval('roll_calls_id_seq', 100);",
    "commit;",
  ].join("\n");
}
