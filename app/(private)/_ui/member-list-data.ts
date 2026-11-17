// The Members list's rows, made on the server (issue 337): what the list filters and orders on
// (ListMember) and its words, already formatted in the officer's language. Nothing the opened sheet alone
// shows is in here: map position, last online and the day-by-day donations are fetched when a member is
// opened (/api/w/[slug]/members/[uid]). The photo is a yes/no and a frame id (D22, D65).
import type { WorkspaceDictionary, WorkspaceKey } from "@/lib/private/dictionary";
import { membersEn } from "@/lib/private/dictionary.members";
import { NONE } from "@/lib/private/fact-text";
import { or, statusParts, type CardFormats } from "@/lib/private/member-card";
import type { ListSource } from "@/lib/private/members";
import { listMember, type ListMember } from "@/lib/private/members-list";
import { sheetRow, type Status } from "@/lib/private/members-sheet";
import type { Photo } from "@/lib/queries/photo";

export interface ListRow extends ListMember {
  /** "R4", "R3": the code only; the title is in the sheet. */
  rankShort: string;
  photo: Photo;
  text: { might: string; kills: string; squad: string; donated: string };
  status: Status;
  /** "Check in · might unchanged for 16 days", "On a break until Fri 20 Nov"; empty when Fine. */
  statusLine: string;
  /** The member as a tab-separated line for "Copy for spreadsheet". */
  sheet: string;
}

/** "48.2M · T10", "— · T10", "48.2M", or "—". */
function squadText(m: ListSource, f: CardFormats): string {
  const [squad, tier] = [m.facts.squadMight?.value ?? null, m.facts.troopTier?.value ?? null];
  if (squad === null && tier === null) return NONE;
  return tier === null ? or(squad, f.compact) : `${or(squad, f.compact)} · T${tier}`;
}

const rankShort = (m: ListSource) =>
  m.rankCode !== null && m.rankCode >= 101 && m.rankCode <= 105
    ? `R${m.rankCode - 100}`
    : (m.rank ?? NONE);

export function listRow(m: ListSource, t: WorkspaceDictionary, f: CardFormats): ListRow {
  const { status, label, lines } = statusParts(m, t, f);
  const quiet = status === "fine" || status === "none";
  return {
    ...listMember(m),
    rankShort: rankShort(m),
    photo: m.photo,
    text: {
      might: or(m.might, f.compact),
      kills: or(m.kills, f.compact),
      squad: squadText(m, f),
      donated: or(m.weekTotal, f.compact),
    },
    status,
    statusLine: quiet ? "" : [label, ...lines].join(" · "),
    sheet: sheetRow(m, t, f),
  };
}

const LIST_KEYS = [
  ...(Object.keys(membersEn) as (keyof typeof membersEn)[]),
  "members.search.ph",
  "members.search.aria",
  "members.filter.aria",
  "members.filter.r4",
  "members.count",
  "members.empty",
  "members.copy",
  "members.copied",
  "members.copyFailed",
  "members.new",
  "status.checkin",
  "status.help",
  "status.break",
  "intro.close",
] as const satisfies readonly WorkspaceKey[];

export type ListWords = Record<(typeof LIST_KEYS)[number], string>;

/** Only the words the list's browser code shows, not the whole dictionary. */
export const listWords = (t: WorkspaceDictionary): ListWords =>
  Object.fromEntries(LIST_KEYS.map((k) => [k, t[k]])) as ListWords;
