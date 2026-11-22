// /w/[slug]/follow-up (issue 340, D104): the leadership's weekly worklist. The members to look at this
// week under "Check in", "New" and "A tip to share" (D140), alphabetical in each, with a warm line for each
// reason and every fact still to ask by name; each row has one-tap "Talked to them", "Add a note" and a
// link to Members, and a tap on the person opens their panel (a sheet, beside the list from 1024, D122):
// why, a ready message in their language, what to fill in, how it went and the last notes. Then the
// thefts whose follow-up is still open, each linked to its entry in the thefts log. People first (D75):
// notes for the officers, nothing is sent, no ranking, a warm line when nobody is on it. Issue 585: the head
// leads with the week's two numbers, and "Noted this week" says who an officer already noted, by whom.
// Slice 2: "Needs help" comes first, each row saying since when, who and why, and last week's note is context.
import { fill } from "@/lib/copy";
import { getEnv } from "@/lib/env";
import type { WorkspaceDictionary, WorkspaceLanguage } from "@/lib/private/dictionary";
import { featureOn } from "@/lib/private/features";
import { followUpView, type FollowUpItem, type FollowUpView } from "@/lib/private/follow-up";
import { lastWeekLines, markLines, type FollowUpAction } from "@/lib/private/follow-up-rules";
import { cardFormats } from "@/lib/private/member-card";
import type { Reason } from "@/lib/private/members";
import { reasonText, type Formats } from "@/lib/private/members-sheet";
import { inputOf, readyTexts } from "@/lib/private/ready-message";

import { editorWords } from "../../../_ui/facts-form";
import { followUpWords } from "../../../_ui/follow-up-words";
import {
  FollowUpList,
  type FollowUpGroup,
  type FollowUpRow,
  type RowLine,
} from "../../../_ui/FollowUpList";
import { counted, FollowUpFoot, FollowUpHead } from "../../../_ui/FollowUpWeek";
import { SignedInFrame } from "../../../_ui/Frame";
import { openRollCall } from "../../../_ui/roll-call-page";

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
 * still to ask, the tip, then last week's newest record as context (issue 585 S2).
 */
function linesOf(item: FollowUpItem, t: WorkspaceDictionary, f: Formats): RowLine[] {
  const { member, checkIn, toAsk, tip, mark, lastWeek } = item;
  const reasons = checkIn ? member.reasons.map((r) => reasonLine(r, t, f)) : [];
  // Every fact still to ask, by name (issue 460): never only a count.
  const list = toAsk.map((field) => t[`facts.${field}`]).join(", ");
  // A withdrawn record never counts (liveRecords), so last week's is one of the four answers.
  const last = lastWeek && { ...lastWeek, action: lastWeek.action as FollowUpAction };
  return [
    ...(mark ? said(markLines(mark, t, f.date)) : []),
    ...[
      ...reasons,
      ...(toAsk.length > 0 ? [fill(t["followup.toAsk"], { list })] : []),
      ...(tip ? [t["followup.reason.coins"]] : []),
    ].map((text) => ({ text })),
    ...(last ? said(lastWeekLines(last, t, f.date, f.date)) : []),
  ];
}

/** A member on the list as the browser shows it. */
function rowOf(item: FollowUpItem, t: WorkspaceDictionary, f: Formats, officer: WorkspaceLanguage) {
  const { member, toAsk } = item;
  return {
    uid: member.uid,
    name: member.name,
    rank: member.rank,
    help: item.help,
    lines: linesOf(item, t, f),
    ask: toAsk.map((field) => ({ field, label: t[`facts.${field}`] })),
    message: messageOf(item, officer),
    versions: {
      away: member.facts.away?.version ?? 0,
      status: member.facts.status?.version ?? 0,
    },
  } satisfies FollowUpRow;
}

/**
 * "Needs help · n" (issue 585 S2), "Worth a hello · n", "New · n", then "A tip to share · n" (D140), each
 * alphabetical (the items come by name); a member is in the first group that holds them, empty groups left
 * out. Needs help says how a member leaves it.
 */
function groupsOf(
  items: FollowUpItem[],
  t: WorkspaceDictionary,
  f: Formats,
  officer: WorkspaceLanguage,
): FollowUpGroup[] {
  const help = items.filter((i) => i.help);
  const rest = items.filter((i) => !i.help);
  const checkIn = rest.filter((i) => i.checkIn);
  const fresh = rest.filter((i) => !i.checkIn && i.toAsk.length > 0);
  const tip = rest.filter((i) => !i.checkIn && i.toAsk.length === 0);
  return [
    { id: "help", key: "followup.group.help" as const, items: help },
    { id: "checkin", key: "followup.group.checkin" as const, items: checkIn },
    { id: "new", key: "followup.group.new" as const, items: fresh },
    { id: "tip", key: "followup.group.tip" as const, items: tip },
  ]
    .filter((g) => g.items.length > 0)
    .map((g) => ({
      id: g.id,
      title: fill(t[g.key], { n: g.items.length }),
      ...(g.id === "help" && { hint: t["followup.group.helpHint"] }),
      rows: g.items.map((i) => rowOf(i, t, f, officer)),
    }));
}

export default async function FollowUpPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const page = await openRollCall<FollowUpView>(
    params,
    "follow-up",
    async (db, access, _today, _l, zone) => {
      const view = await followUpView(db, access, new Date(), zone);
      // D126: with the thefts log off, its section and links are left out (the thefts stay stored).
      return featureOn(access, "thefts") ? view : { ...view, thefts: [] };
    },
    "follow_up",
  );
  const { access, slug, t, language, today, data } = page;
  const f = cardFormats(language, page.zone, page.now);
  const groups = groupsOf(data.items, t, f, language);
  const open = (await searchParams).m;
  const editor = {
    slug,
    words: editorWords(t),
    shots: featureOn(access, "ocr"),
    language,
    serverZone: getEnv().SERVER_TZ,
    used: data.zones,
  };
  return (
    <SignedInFrame
      access={access}
      language={language}
      t={t}
      current="review"
      waiting={page.waiting}
    >
      <FollowUpHead data={data} t={t} language={language} />
      {/* Always mounted, so the saved line with Undo stays after the last member leaves. */}
      <FollowUpList
        slug={slug}
        groups={groups}
        today={today}
        language={language}
        words={followUpWords(t)}
        editor={editor}
        initialOpen={typeof open === "string" ? open : null}
        foot={<FollowUpFoot slug={slug} data={data} t={t} f={f} />}
      />
    </SignedInFrame>
  );
}
