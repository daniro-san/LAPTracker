// The e2e seed's invented people (issue 477): the alliances and their members, the sentinels in their private
// roster fields, the seeded sessions, and which rows each test that writes owns per project and repeat, so
// runs side by side never write what another reads. e2e/fixtures/seed.ts turns them into rows.

export type Side = "a" | "b";

/**
 * The private roster fields' values in each alliance's raw_json (CLAUDE.md "Roster fields"): six-digit map
 * coordinates, and four years no page shows otherwise. Last online falls on a 29 February, which the member
 * card writes as "Feb 29" (no year), so a formatted leak can be seen too. A day's quest points and donations
 * (`daily_tech`) are figures no other seeded value or copy line has, one pair per alliance, and the quest
 * points stay under the daily cap (240); every member of an alliance has the same, except the quest points
 * of Lantern Keep's linked member around last week (seed.ts `questPointsOf`). `active` itself is the week's
 * running total of those days (seed.ts `questTotalOf`, #739). Coins (`daily_honor`) sit at their 1,000 cap
 * (COINS_MAX), a figure the copy itself writes, so only their key can be looked for.
 */
export const SENTINELS = {
  a: {
    x: 713579,
    y: 713580,
    lastOnline: "2088-02-29T12:00:00Z",
    joined: "2086-05-21T06:07:08Z",
    active: 215,
    tech: 3917,
  },
  b: {
    x: 824681,
    y: 824682,
    lastOnline: "2092-02-29T12:00:00Z",
    joined: "2090-06-22T07:08:09Z",
    active: 165,

    tech: 4283,
  },
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

/**
 * Three members Lantern Keep's officer added by hand, as typed (drilldown batch C), each matched to their
 * roster member, so Members and Follow-up show no extra card. Home's Recent activity says "Officer LNK
 * added 3 new members" and opens these names in name order.
 */
export const ADDED_BY_HAND = [9, 3, 6].map((k) => A_NAMES[k] as string);
export const FILLERS = [
  { unionId: 900303, tag: "IRT", name: "Iron Thistle" },
  { unionId: 900404, tag: "MNW", name: "Moonwake" },
  { unionId: 900505, tag: "GLW", name: "Glass Wolves" },
];

export const uidOf = (side: Side, k: number) => ALLIANCES[side].unionId * 10 + k;
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
/** Calendar entries: the weekly KvK (Raid prep), and the cheese entries below. */
export const KVK_ENTRY = 1;
/**
 * Each filler workspace's weekly Undead Siege on the raid's Saturday (D121): the garrison post with the
 * alliance's own line (D156) posts its plan, on the repeat's own workspace. Entry SIEGE_ENTRY + repeat.
 */
export const SIEGE_ENTRY = 60;

/** The projects (playwright.config.ts) and the repeats (--repeat-each) that each get a roll call of their own. */
export const PROJECTS = ["phone", "wide", "iphone"];
export const REPEATS = 3;
/** The slot of a project and repeat (up to three repeats), for rows a test of each writes on its own. */
export const slotOf = (project: string, repeat: number) =>
  Math.max(0, PROJECTS.indexOf(project)) * REPEATS + (repeat % REPEATS);
/**
 * The weekly cheese entry a roll call test marks: one per project and repeat (up to three repeats), so each
 * run checks its exact counts while the others run. Lv.1 to Lv.9, on this week's days in turn.
 */
export function cheeseOf(project: string, repeat: number) {
  const n = slotOf(project, repeat);
  return { entry: 2 + n, level: 1 + n };
}

/** A filler alliance's two roster members (no raw_json, no sentinels). */
export const fillerNames = (f: (typeof FILLERS)[number]) => [`${f.tag} one`, `${f.tag} two`];
/**
 * Every seeded workspace by its address, with its alliance's member names: a private answer of one never
 * names another's members (the guards, e2e/fixtures/test.ts).
 */
export const WORKSPACES = [
  { slug: ALLIANCES.a.slug, names: ALLIANCES.a.names as readonly string[] },
  { slug: ALLIANCES.b.slug, names: ALLIANCES.b.names as readonly string[] },
  ...FILLERS.map((f) => ({ slug: f.tag.toLowerCase(), names: fillerNames(f) })),
];

/** Session tokens: invented, local only; the database keeps their sha256 (lib/private/session.ts). */
export const TOKENS = {
  a: { officer: "e2e-session-lnk-officer-token-000001", member: "e2e-session-lnk-member-token-000002" },
  b: { officer: "e2e-session-msh-officer-token-000003", member: "e2e-session-msh-member-token-000004" },
} as const;

/**
 * A Lantern Keep officer's session that the sign-out test ends: one per project and repeat, so the
 * officer's main session (TOKENS.a.officer) and the other runs' sessions survive it.
 */
export const signOutToken = (project: string, repeat: number) =>
  `e2e-session-lnk-signout-token-${String(slotOf(project, repeat)).padStart(6, "0")}`;

/**
 * The Moss Hollow members with no daily quest points and no donations on the last 3 end-of-day reads (the
 * offline proxy, D127: "Quiet for 3 days"), one per project (phone, wide) and repeat, for the Follow-up test
 * that taps "Talked to them" on its own member.
 */
export const IDLE_DAYS = 3;
const IDLE_PROJECTS = ["phone", "wide"];
export const idleOf = (project: string, repeat: number) =>
  2 + Math.max(0, IDLE_PROJECTS.indexOf(project)) * REPEATS + (repeat % REPEATS);
export const IDLE_UIDS = new Set(IDLE_PROJECTS.flatMap((p) => [0, 1, 2].map((r) => uidOf("b", idleOf(p, r)))));

/**
 * The Lantern Keep members whose Troops fact the member-facts test edits: one per project (phone, wide)
 * and repeat. Each has Troops T10 saved 3 days ago (`FACT_SEEDED`), the earlier value History then shows.
 */
export const FACT_MEMBERS = { phone: [1, 2, 9], wide: [6, 7, 8] };
export const factMemberOf = (project: string, repeat: number) =>
  FACT_MEMBERS[project === "wide" ? "wide" : "phone"][repeat % REPEATS] as number;
export const FACT_SEEDED = { tier: 10, daysAgo: 3 } as const;

/**
 * Lantern Keep's recorded time zones (Insights' Time zones card, owner 2026-11-22), by member k: zones with
 * no summer time, so the card's offsets and reset times hold on any seed date. Read-only; no other test
 * reads these members' time zones.
 */
export const ZONE_FACTS: Record<number, string> = {
  0: "Asia/Manila",
  3: "Asia/Manila",
  5: "America/Sao_Paulo",
};

/**
 * The Lantern Keep member an officer marked Needs help the week before last ("They need help" with a note)
 * and talked to last week (issue 585 slice 2): read-only, so Home counts them and Follow-up lists them under
 * "Needs help" with since when, who, why and last week's note. k=5 has no fact the facts tests edit.
 */
export const NEEDS_HELP = {
  k: 5,
  note: "Asked for a hand rebuilding the main squad",
  said: "Farming for now, will ask if stuck",
} as const;

/**
 * The Lantern Keep member who took a heavy hit at the last KvK (issue 585 slice 5): `lost` more might than
 * the others at its End, and still that much lower on every read after it, so they lost more than a quarter
 * of their might and are under 80% of it now: Insights' help list and Follow-up's "After KvK, offer help".
 * Read-only; k=4 has no reason, fact or record of its own, and only the roll call test marks it.
 */
export const HEAVY_HIT = { k: 4, lost: 10_000_000 } as const;

/**
 * The Lantern Keep member whose card each project's card test taps "Talked to them" on, then Undo: one per
 * project. Each has an "All fine" an officer noted this week (seed-help.ts), so Follow-up's noted count is
 * the same while a test holds its Talked as after its Undo: one per member here, whichever projects run.
 */
export const CARD_TALKED: Record<string, number> = { phone: 6, wide: 7, iphone: 8 };
export const NOTED = Object.values(CARD_TALKED).length;

/**
 * The member marked Needs help whom the "No longer needs help" test clears (issue 585 slice 2): the first
 * roster member of the repeat's own feature-switch workspace (switchWorkspaceOf), phone only, so Lantern
 * Keep's counts never move while it runs. That alliance has no end-of-day read: an officer's status still
 * shows then (D80), and Follow-up lists the member under "Needs help".
 */
export function clearHelpOf(repeat: number) {
  const w = switchWorkspaceOf(repeat);
  const f = FILLERS[repeat % REPEATS] as (typeof FILLERS)[number];
  return {
    workspaceId: w.id,
    officer: 5 + (repeat % REPEATS),
    uid: Number(`${f.unionId}1`),
    name: fillerNames(f)[0] as string,
  };
}

/**
 * The workspace whose Thefts switch the feature-switch test turns off and on again (phone only): one of the
 * filler alliances per repeat, so no other test's navigation changes while it runs.
 */
export function switchWorkspaceOf(repeat: number) {
  const n = repeat % REPEATS;
  const f = FILLERS[n] as (typeof FILLERS)[number];
  return {
    id: 3 + n,
    slug: f.tag.toLowerCase(),
    tag: f.tag,
    name: f.name,
    unionId: f.unionId,
    token: `e2e-session-${f.tag.toLowerCase()}-officer-token-00000${5 + n}`,
  };
}

/**
 * The member who tells their officers their time zone on their own page (D154), phone only: the second
 * roster member of the repeat's own filler workspace (switchWorkspaceOf), with an approved link and a
 * member session of their own, so no other test's card or Home shows what they send.
 */
export function selfReportOf(repeat: number) {
  const n = repeat % REPEATS;
  const w = switchWorkspaceOf(repeat);
  const f = FILLERS[n] as (typeof FILLERS)[number];
  return {
    workspace: w,
    user: 10 + n,
    uid: Number(`${f.unionId}2`),
    name: fillerNames(f)[1] as string,
    token: `e2e-session-${w.slug}-member-token-0000${10 + n}`,
  };
}

