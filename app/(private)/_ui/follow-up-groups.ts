// Follow-up's groups and rows as the browser shows them (issue 340, D104; D140; issue 585), made on the
// server: "Needs help · n" first (slice 2), "After KvK, offer help · n" (slice 5), then "Worth a hello · n",
// "New · n" and "A tip to share · n", each
// row with why the member is on the list in the officer's words. Apart from the page so the grouping can be
// tested with the dictionary's own words.
import { fill } from "@/lib/copy";
import { dateWords } from "@/lib/date-words";
import type { WorkspaceDictionary, WorkspaceLanguage } from "@/lib/private/dictionary";
import type { FollowUpItem } from "@/lib/private/follow-up";
import {
  inKvkGroup,
  lastWeekLines,
  markLines,
  type FollowUpAction,
} from "@/lib/private/follow-up-rules";
import type { Reason } from "@/lib/private/members";
import { reasonText, type Formats } from "@/lib/private/members-sheet";
import { inputOf, readyTexts } from "@/lib/private/ready-message";

import type { FollowUpGroup, FollowUpRow, RowLine } from "./FollowUpList";
import { counted } from "./FollowUpWeek";

/** A reason in Follow-up's own words ("Quiet for 3 days. Worth a hello."); the held KvK one as Members says it. */
function reasonLine(r: Reason, t: WorkspaceDictionary, f: Formats) {
  if (r.kind === "kvk") return reasonText(r, t, f);
  return counted(t, `followup.reason.${r.kind}`, r.days, f.language);
}

/**
 * The ready message (D140) in each language the officer can pick, the member's first (else the
 * officer's).
 */
function messageOf(item: FollowUpItem, officer: WorkspaceLanguage) {
  return { language: item.language ?? officer, texts: readyTexts(inputOf(item)) };
}

/** A head line and the officer's note under it, in quotes (the panel's review, issue 585 S2). */
const said = (lines: string[]): RowLine[] => lines.map((text, i) => ({ text, quote: i > 0 }));

/**
 * Why a member is on the list: the Needs help mark (since when, who, the note), the reasons, the facts
 * still to ask, the tip, then last week's newest record as context (issue 585 S2). `plain` are the middle
 * lines, the only ones a group can say once for all its rows (issue 585 S3).
 */
function partsOf(item: FollowUpItem, t: WorkspaceDictionary, f: Formats, kvk: string | null) {
  const { member, checkIn, toAsk, tip, mark, lastWeek } = item;
  // The KvK's heavy hit first (slice 5), with no number beside a name (D139).
  const reasons = [
    ...(item.kvk && kvk ? [kvk] : []),
    ...(checkIn ? member.reasons.map((r) => reasonLine(r, t, f)) : []),
  ];
  // Every fact still to ask, by name (issue 460): never only a count.
  const list = toAsk.map((field) => t[`facts.${field}`]).join(", ");
  // A withdrawn record never counts (liveRecords), so last week's is one of the four answers.
  const last = lastWeek && { ...lastWeek, action: lastWeek.action as FollowUpAction };
  return {
    mark: mark ? said(markLines(mark, t, f.date)) : [],
    plain: [
      ...reasons,
      ...(toAsk.length > 0 ? [fill(t["followup.toAsk"], { list })] : []),
      ...(tip ? [t["followup.reason.coins"]] : []),
    ],
    last: last ? said(lastWeekLines(last, t, f.date, f.date)) : [],
  };
}

type Parts = ReturnType<typeof partsOf>;

/** The row's lines in order, leaving out the plain lines its group says once. */
const linesOf = (p: Parts, shared: readonly string[] = []): RowLine[] => [
  ...p.mark,
  ...p.plain.filter((text) => !shared.includes(text)).map((text) => ({ text })),
  ...p.last,
];

/**
 * The plain lines every row of a group of two or more holds (issue 585 S3, F29): said once under the group's
 * title, so six "Still to ask: …" become one. A mark or last week's line (with its officer's note) never is.
 */
function sharedOf(parts: Parts[]): string[] {
  const [first, ...rest] = parts;
  if (!first || rest.length === 0) return [];
  return first.plain.filter((text) => rest.every((p) => p.plain.includes(text)));
}

/** A member on the list as the browser shows it; `own`: the lines its group does not say for it. */
function rowOf(
  item: FollowUpItem,
  { parts, shared }: { parts: Parts; shared: readonly string[] },
  t: WorkspaceDictionary,
  officer: WorkspaceLanguage,
) {
  const { member, toAsk } = item;
  return {
    uid: member.uid,
    name: member.name,
    rank: member.rank,
    help: item.help,
    lines: linesOf(parts),
    own: linesOf(parts, shared),
    ask: toAsk.map((field) => ({ field, label: t[`facts.${field}`] })),
    message: messageOf(item, officer),
    versions: {
      away: member.facts.away?.version ?? 0,
      status: member.facts.status?.version ?? 0,
    },
  } satisfies FollowUpRow;
}

/**
 * "Needs help · n" (issue 585 S2), "After KvK, offer help · n" (S5), "Worth a hello · n", "New · n", then "A
 * tip to share · n" (D140), each alphabetical (the items come by name); a member is in the first group that
 * holds them, empty groups left out. Needs help and After KvK say how a member leaves them; a line every row
 * holds is said once (issue 585 S3), and the KvK line by its group's hint. `kvkDay`: the KvK Follow-up offers
 * help after (`FollowUpView.kvkDay`).
 */
export function groupsOf(
  items: FollowUpItem[],
  t: WorkspaceDictionary,
  f: Formats,
  officer: WorkspaceLanguage,
  kvkDay: string | null = null,
): FollowUpGroup[] {
  const date = kvkDay && f.date(kvkDay);
  // The reason ends its sentence with the date: the sentence form, so PT and FR never print "nov..".
  const kvkLine = kvkDay
    ? fill(t["followup.reason.kvk"], { date: dateWords(f.language, f.zone).sentence(kvkDay) })
    : null;
  const help = items.filter((i) => i.help);
  const hit = items.filter(inKvkGroup);
  const rest = items.filter((i) => !i.help && !i.kvk);
  const checkIn = rest.filter((i) => i.checkIn);
  const fresh = rest.filter((i) => !i.checkIn && i.toAsk.length > 0);
  const tip = rest.filter((i) => !i.checkIn && i.toAsk.length === 0);
  return [
    { id: "help", key: "followup.group.help" as const, items: help },
    { id: "kvk", key: "followup.group.kvk" as const, items: hit },
    { id: "checkin", key: "followup.group.checkin" as const, items: checkIn },
    { id: "new", key: "followup.group.new" as const, items: fresh },
    { id: "tip", key: "followup.group.tip" as const, items: tip },
  ]
    .filter((g) => g.items.length > 0)
    .map((g) => {
      const parts = g.items.map((i) => partsOf(i, t, f, kvkLine));
      // The KvK group's hint says its line, so neither its rows nor "Same for all" repeat it (slice 5).
      const said = g.id === "kvk" && kvkLine ? [kvkLine] : [];
      const shared = sharedOf(parts).filter((text) => !said.includes(text));
      return {
        id: g.id,
        title: fill(t[g.key], { n: g.items.length }),
        ...(g.id === "help" && { hint: t["followup.group.helpHint"] }),
        ...(g.id === "kvk" && date && { hint: fill(t["followup.group.kvkHint"], { date }) }),
        ...(shared.length > 0 && {
          shared: { head: fill(t["followup.group.shared"], { n: g.items.length }), lines: shared },
        }),
        rows: g.items.map((i, k) =>
          rowOf(i, { parts: parts[k] as Parts, shared: [...shared, ...said] }, t, officer),
        ),
      };
    });
}
