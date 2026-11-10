// Member history (D60): the filters and the spreadsheet text, shared by the page (server) and the card
// contents (client).
import type { Dictionary } from "@/lib/copy";
import type { HistoryCardBody, HistoryMember } from "@/lib/queries";

export const HISTORY_FILTERS = ["joined", "left", "renamed", "kills"] as const;
export type HistoryFilter = (typeof HISTORY_FILTERS)[number];

/** What a card shows under a filter: one kind of change, or everything. */
export const parts = (body: HistoryCardBody, filter: HistoryFilter | null) => ({
  joined: (!filter || filter === "joined") && body.joined.length > 0,
  left: (!filter || filter === "left") && body.left.length > 0,
  renamed: (!filter || filter === "renamed") && body.renamed.length > 0,
  changed: (!filter || filter === "kills") && body.changed.length > 0,
});

export const matchesFilter = (body: HistoryCardBody, filter: HistoryFilter | null) =>
  filter === null || Object.values(parts(body, filter)).some(Boolean);

/** A spreadsheet reads a leading = + − @ as a formula; a leading apostrophe keeps the name as text. */
const cell = (name: string) => {
  const flat = name.replace(/[\t\r\n]+/g, " ");
  return /^[=+\-@]/.test(flat) ? `'${flat}` : flat;
};

/** The roster as tab-separated rows under a header row, by might, with plain integers. */
export function rosterTsv(roster: HistoryMember[], copy: Dictionary): string {
  const rows = [...roster]
    .sort((a, b) => (b.power ?? 0) - (a.power ?? 0))
    .map((m) => [cell(m.name), m.power ?? "", m.kills ?? ""].join("\t"));
  return [[copy.members.name, copy.ledger.might, copy.ledger.kills].join("\t"), ...rows].join("\n");
}
