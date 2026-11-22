// The e2e seed (issue 477): two alliances with a workspace each, three filler alliances, 14 days of daily
// rosters, two past Saturday events, this week's Raid prep and a cheese roll call, an officer's and a member's
// session per workspace, and a Lantern Keep member marked Needs help (issue 585). Invented names only. Dates follow the day the suite runs, in server time (UTC−2),
// so every run sees the same week shape. Each alliance's roster rows carry its own sentinel values for the
// private roster fields, so a test can tell a leak, and whose it is, from any page or answer.
import { createHash } from "node:crypto";

import { factRows } from "./seed-facts";
import { helpDays, needsHelpRows, selfReportRows } from "./seed-help";
import {
  ADDED_BY_HAND,
  ALLIANCES,
  AVATAR_SENTINEL,
  cheeseOf,
  FILLERS,
  HEAVY_HIT,
  fillerNames,
  IDLE_DAYS,
  IDLE_UIDS,
  JOINER,
  LEAVER,
  LINKED,
  LINKED_MEMBER,
  KVK_ENTRY,
  PROJECTS,
  REPEATS,
  SENTINELS,
  SHIELD_MARKED,
  SIEGE_ENTRY,
  signOutToken,
  slotOf,
  switchWorkspaceOf,
  TOKENS,
  uidOf,
  WALL_ONLY,
  type Side,
} from "./seed-people";
import { shieldRows } from "./seed-shield";

// The specs import the people from here too, with the rows' figures below.
export * from "./seed-people";
export { HAND_CHECK, SHIELD_PREP_ID, SHIELD_READINGS } from "./seed-shield";

/**
 * Raid prep for the test that marks it (phone only): the same marks on a later week of its own per repeat
 * (weeks 1 to 3 after the read-only one), so the read-only checks of this week's never see its marks.
 */
export function raidOf(now: Date, repeat: number) {
  const { raid } = calendarOf(now);
  const shift = (day: string) => iso(Date.parse(day) + 7 * (1 + (repeat % REPEATS)) * DAY_MS);
  return { day: shift(raid.day), week: shift(raid.week) };
}
/**
 * The Calendar entry the calendar flow adds, deletes and brings back, on Moss Hollow's workspace: one per
 * project and repeat, its own title on a Monday of its own 5 to 13 weeks ahead, which no other test reads.
 */
export function calendarAddOf(now: Date, project: string, repeat: number) {
  const n = slotOf(project, repeat);
  const day = iso(Date.parse(calendarOf(now).week) + 7 * (5 + n) * DAY_MS);
  return { title: `Bear hunt drill ${project} ${repeat % REPEATS}`, day, time: "20:00" };
}
export const DAY_MS = 86_400_000;
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

/**
 * Follow-up offers help after the last KvK (HEAVY_HIT, issue 585 slice 5) for the week after it: over on
 * the next KvK day, a Saturday (server days), when the seed's last event is 7 days back.
 */
export const kvkWeek = (now: Date) => new Date(calendarOf(now).today).getUTCDay() !== 6;

/** The moment the global setup seeded at (E2E_NOW, which Playwright passes to its workers). */
export const seededAt = () => new Date(Number(process.env.E2E_NOW ?? Date.now()));

/** A seeded day (YYYY-MM-DD) written as a page writes it, e.g. "Sat, Nov 14" (en-US) or "14 Nov" (en-GB). */
export const shown = (day: string, locale: string, options: Intl.DateTimeFormatOptions) =>
  new Intl.DateTimeFormat(locale, { ...options, timeZone: "UTC" }).format(Date.parse(day));
/** A seeded day as the desk's cards write it: "Sat, Nov 14". */
export const usDay = (day: string) =>
  shown(day, "en-US", { weekday: "short", month: "short", day: "numeric" });
/** The server day `n` days before the seed's today (YYYY-MM-DD). */
export const daysAgo = (n: number) => iso(calendarOf(seededAt()).today - n * DAY_MS);
/** The newest daily roster's day: yesterday, server time. */
export const lastRosterDay = () => new Date(calendarOf(seededAt()).today - DAY_MS).toISOString().slice(0, 10);

type Member = { uid: number; name: string; power: number; kills: number };
const members = (side: Side, day: number): Member[] =>
  ALLIANCES[side].names.map((name, k) => ({
    uid: uidOf(side, k),
    name,
    power: 40_000_000 - k * 2_500_000 + day * 50_000,
    kills: 1_000_000 + k * 40_000 + day * 3_000,
  }));

/**
 * A member's daily quest points on read day `day`: the alliance's sentinel, except Lantern Keep's
 * LINKED_MEMBER, whose own page (D142) averages this game week and last week, so that a wrong window shows:
 * last week's days go from 30 under the sentinel to 30 over it, Monday to Sunday (their average is the
 * sentinel, which the page then still shows); this week's are 20 over it, and older days 50 over it.
 */
export function questPointsOf(side: Side, uid: number, day: string): number {
  const s = SENTINELS[side].active;
  if (uid !== LINKED.a) return s;
  const monday = Date.parse(calendarOf(seededAt()).week);
  const n = (Date.parse(day) - monday) / DAY_MS;
  if (n >= 0) return s + 20;
  return n >= -7 ? s + (n + 7 - 3) * 10 : s + 50;
}

function rawMember(side: Side, m: Member, k: number, idle: boolean, day: string) {
  const s = SENTINELS[side];
  return {
    uid: m.uid,
    nick_name: m.name,
    power: m.power,
    kills: m.kills,
    lv: 25,
    rank_code: k === 0 ? 105 : k < 3 ? 104 : 102,
    rank_label: k === 0 ? "R5" : k < 3 ? "R4" : "R2",
    // The game sends null, never 0, for none that day (D127).
    active: idle ? null : questPointsOf(side, m.uid, day),
    daily_honor: DAILY.honor,
    daily_tech: idle ? null : s.tech,
    x: s.x,
    y: s.y,
    online: true,
    last_online_at: s.lastOnline,
    joined_at: s.joined,
    avatar_url: `https://${AVATAR_SENTINEL}/${m.uid}.png`,
  };
}

/** `daysLeft`: the end-of-day reads after this one; the IDLE members are quiet on the last IDLE_DAYS. */
function rosterRow(side: Side, day: string, list: Member[], daysLeft: number) {
  const { unionId, tag, name } = ALLIANCES[side];
  const members = list.map((m, k) => rawMember(side, m, k, IDLE_UIDS.has(m.uid) && daysLeft < IDLE_DAYS, day));
  const raw = { union_id: unionId, abbr: tag, name, members };
  const total = (f: (m: Member) => number) => list.reduce((s, m) => s + f(m), 0);
  return `insert into daily_rosters (read_day, union_id, tag, name, member_count, total_power, total_kills, source_updated_at, is_fresh, member_uids, member_names, member_power, member_kills, raw_json) values ('${day}', ${unionId}, '${tag}', ${q(name)}, ${list.length}, ${total((m) => m.power)}, ${total((m) => m.kills)}, '${day}T23:31:00-02:00', true, ${arr(list.map((m) => m.uid))}, ${arr(list.map((m) => m.name))}, ${arr(list.map((m) => m.power))}, ${arr(list.map((m) => m.kills))}, ${q(JSON.stringify(raw))}::jsonb);`;
}

/** Lantern Keep without the joiner before the last event, without the leaver after it. */
const onRoster = (side: Side, k: number, afterLastEvent: boolean) =>
  side === "b" || (afterLastEvent ? k !== LEAVER : k !== JOINER);

/** The members who joined (on the last event's End roster, not its Start's) or left (the reverse). */
export const changedAtLastEvent = (side: Side, show: "joined" | "left") =>
  ALLIANCES[side].names.filter((_, k) =>
    show === "joined"
      ? onRoster(side, k, true) && !onRoster(side, k, false)
      : onRoster(side, k, false) && !onRoster(side, k, true),
  );

/** The members first seen in the seeded reads (not on the roster before the last event): new members. */
export const newMembers = (side: Side) =>
  ALLIANCES[side].names.filter((_, k) => !onRoster(side, k, false));

// What the pages show, computed from the rows above (the specs format them with lib/compact, as the pages do).

/** HEAVY_HIT's extra loss at the last event's End, and on every read after it (issue 585 slice 5). */
const hitOf = (uid: number, afterLastEvent: boolean) =>
  afterLastEvent && uid === uidOf("a", HEAVY_HIT.k) ? HEAVY_HIT.lost : 0;

/**
 * A last-event member's figures: the Start's are `members(side, 0)`, the End loses 3M might (HEAVY_HIT more)
 * and gains 90K kills.
 */
const atEvent = (m: Member, phase: "before" | "after") =>
  phase === "after"
    ? { might: m.power - 3_000_000 - hitOf(m.uid, true), kills: m.kills + 90_000 }
    : { might: m.power, kills: m.kills };

/** An alliance's totals at the last event's Start or End. */
export function eventTotals(side: Side, phase: "before" | "after") {
  const list = members(side, 0).filter((_, k) => onRoster(side, k, phase === "after"));
  return list
    .map((m) => atEvent(m, phase))
    .reduce((t, f) => ({ might: t.might + f.might, kills: t.kills + f.kills }), { might: 0, kills: 0 });
}

/** What the members who joined (at the End) and left (at the Start) moved in the last event's might. */
export function memberChange(side: Side) {
  const list = members(side, 0);
  const joined = atEvent(list[JOINER] as Member, "after").might;
  const left = atEvent(list[LEAVER] as Member, "before").might;
  return { joined, left };
}

/** Member k's figures at the last event's End. */
export const endOf = (side: Side, k: number) => atEvent(members(side, 0)[k] as Member, "after");

/** Member k on the newest daily roster (day 13 of 14), and on the first (day 0). */
export const rosterOf = (side: Side, k: number, day = 13) => {
  const m = members(side, day)[k] as Member;
  const { today, events } = calendarOf(seededAt());
  const after = iso(today - (14 - day) * DAY_MS) >= (events[1] as string);
  return { might: m.power - hitOf(m.uid, after), kills: m.kills };
};

/** Yesterday's ranks board, in seed order: rank, might, kills. */
export const boardOf = (n: number) => ({
  rank: n + 1,
  might: 300_000_000 - n * 50_000_000,
  kills: 10_000_000 - n * 1_000_000,
});

/**
 * Each Lantern Keep roster member's daily figures (D146 and the member card): quest points and donations
 * are its sentinels, coins sit at the cap. Moss Hollow's have its own sentinels.
 */
export const DAILY = { active: SENTINELS.a.active, honor: 1000, tech: SENTINELS.a.tech } as const;

/**
 * The desk's week line (D146) on the day the suite runs: the newest read is yesterday's, and its game week
 * (Monday to Sunday) is this week, or last week when today is a Monday; every day of it has a read with the
 * roster's members (11 on every day: the joiner replaces the leaver).
 */
export function weekLine(now: Date) {
  const { today } = calendarOf(now);
  const reads = ((new Date(today - DAY_MS).getUTCDay() + 6) % 7) + 1;
  const n = ALLIANCES.a.names.length - 1;
  return {
    members: n,
    week: new Date(today).getUTCDay() === 1 ? "last week" : "this week",
    donations: DAILY.tech * n * reads,
  };
}

function dailyReads(today: number, lastEvent: string): string[] {
  const lines: string[] = [];
  for (let n = 14; n >= 1; n--) {
    const day = iso(today - n * DAY_MS);
    lines.push(
      `insert into daily_reads (day, started_at, finished_at, status, calls_used, quota_remaining_before) values ('${day}', '${day}T23:30:00-02:00', '${day}T23:34:00-02:00', 'complete', 9, 4000);`,
    );
    for (const side of ["a", "b"] as const) {
      const list = members(side, 14 - n)
        .filter((_, k) => onRoster(side, k, day >= lastEvent))
        .map((m) => ({ ...m, power: m.power - hitOf(m.uid, day >= lastEvent) }));
      lines.push(rosterRow(side, day, list, n - 1));
    }
    for (const f of FILLERS)
      lines.push(
        `insert into daily_rosters (read_day, union_id, tag, name, member_count, total_power, source_updated_at, is_fresh, member_uids, member_names, member_power, member_kills) values ('${day}', ${f.unionId}, '${f.tag}', ${q(f.name)}, 2, 30000000, '${day}T23:31:00-02:00', true, '{${f.unionId}1,${f.unionId}2}', ${arr(fillerNames(f))}, '{20000000,10000000}', '{500000,400000}');`,
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
          .map((m) => ({
            ...m,
            power: m.power - offset * 3_000_000 - hitOf(m.uid, last && phase === "after"),
            kills: m.kills + offset * 90_000,
          }));
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
  // Lantern Keep's officer's sessions that the sign-out test ends, one per project and repeat.
  const signOuts = PROJECTS.flatMap((p) =>
    Array.from({ length: REPEATS }, (_, r) => signOutToken(p, r)),
  ).map(
    (token) =>
      `('${hash(token)}', ${ALLIANCES.a.id}, 1, now(), now() + interval '6 days', now(), 'officer')`,
  );
  lines.push(
    `insert into workspace_sessions (token_hash, workspace_id, workspace_user_id, created_at, expires_at, checked_at, tier) values ${signOuts.join(", ")};`,
  );
  // A workspace per filler alliance, with its officer's session, for the feature-switch, tracker key and
  // notice tests. The owner allows Translate there (D126: a feature that spends Groq starts off).
  for (let r = 0; r < REPEATS; r++) {
    const w = switchWorkspaceOf(r);
    lines.push(
      `insert into workspaces (id, slug, union_id, discord_guild_id, leader_role_ids, member_role_ids) values (${w.id}, '${w.slug}', ${w.unionId}, '70000000000000010${w.id}', '{70000000000000020${w.id}}', '{70000000000000030${w.id}}');`,
      `insert into workspace_features (workspace_id, switches) values (${w.id}, '{"notice_translate": true}');`,
      `insert into workspace_users (id, workspace_id, discord_user_id, display_name, allowlisted, last_login_at) values (${5 + r}, ${w.id}, '70000000000000040${5 + r}', 'Officer ${w.tag}', true, now());`,
      `insert into workspace_sessions (token_hash, workspace_id, workspace_user_id, created_at, expires_at, checked_at, tier) values ('${hash(w.token)}', ${w.id}, ${5 + r}, now(), now() + interval '6 days', now(), 'officer');`,
      // D154: the member who sends their own time zone from Me.
      ...selfReportRows(r, hash),
    );
  }
  return lines;
}

/** The days of NEEDS_HELP's two records (seed-help.ts), from the seed's week. */
export const needsHelpDays = (now: Date) => helpDays(calendarOf(now).week);

/** This week's Raid prep (the weekly KvK entry) with its marks, and a cheese entry with no roll call yet. */
function rollCallRows(cal: ReturnType<typeof calendarOf>): string[] {
  const ws = ALLIANCES.a.id;
  const cheese = Array.from({ length: PROJECTS.length * REPEATS }, (_, n) => {
    const c = cheeseOf(PROJECTS[Math.floor(n / REPEATS)] as string, n % REPEATS);
    return `(${c.entry}, ${ws}, 'cheese', ${c.level}, '${iso(Date.parse(cal.week) + (n % 7) * DAY_MS)}', 1200, true, true, 1)`;
  }).join(", ");
  const raids = [cal.raid, ...Array.from({ length: REPEATS }, (_, r) => raidOf(seededAt(), r))];
  const marks = raids.flatMap((_, n) => [
    ...SHIELD_MARKED.map(
      (k) => `(${n + 1}, ${uidOf("a", k)}, 1, 'main', '${k === LINKED_MEMBER ? "no" : "yes"}', 1, false)`,
    ),
    ...WALL_ONLY.map((k) => `(${n + 1}, ${uidOf("a", k)}, 1, 'wall', 'yes', 1, false)`),
  ]);
  return [
    `insert into calendar_entries (id, workspace_id, kind, level, day, minute, weekly, for_members, created_by) values (${KVK_ENTRY}, ${ws}, 'kvk', null, '${cal.events[0]}', 720, true, true, 1), ${cheese};`,
    `insert into roll_calls (id, workspace_id, kind, day, week, entry_id, created_by) values ${raids.map((r, n) => `(${n + 1}, ${ws}, 'shield', '${r.day}', '${r.week}', ${KVK_ENTRY}, 1)`).join(", ")};`,
    `insert into roll_call_marks (roll_call_id, uid, version, part, mark, written_by, by_tracker, written_at) select *, now() from (values ${marks.join(", ")}) v;`,
  ];
}

/** Each filler workspace's weekly Undead Siege Lv.6 on the raid's Saturday at 12:00 ST (SIEGE_ENTRY). */
function siegeRows(cal: ReturnType<typeof calendarOf>): string[] {
  const rows = Array.from({ length: REPEATS }, (_, r) => {
    const w = switchWorkspaceOf(r);
    return `(${SIEGE_ENTRY + r}, ${w.id}, 'undead', 6, '${cal.raid.day}', 720, true, false, ${5 + r})`;
  });
  return [
    `insert into calendar_entries (id, workspace_id, kind, level, day, minute, weekly, for_members, created_by) values ${rows.join(", ")};`,
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
    // Moss Hollow's Raid Shield check of the last raid (issue 726).
    ...shieldRows(cal.events[1] as string, iso(Date.parse(cal.events[1] as string) - 5 * DAY_MS)),
    ...siegeRows(cal),
    // ADDED_BY_HAND, a minute before the seed and one second apart, each already matched to their member.
    `insert into pending_members (workspace_id, name, name_key, created_by, created_at, matched_uid, matched_at) values ${ADDED_BY_HAND.map((name, i) => `(${ALLIANCES.a.id}, ${q(name)}, ${q(name.toLowerCase())}, 1, now() - interval '${60 - i} seconds', ${uidOf("a", ALLIANCES.a.names.indexOf(name))}, now())`).join(", ")};`,
    ...factRows(cal.today),
    ...needsHelpRows(cal.week),
    "select setval('events_id_seq', 100), setval('snapshots_id_seq', 100), setval('workspaces_id_seq', 100), setval('workspace_users_id_seq', 100), setval('calendar_entries_id_seq', 100), setval('roll_calls_id_seq', 100);",
    "commit;",
  ].join("\n");
}
