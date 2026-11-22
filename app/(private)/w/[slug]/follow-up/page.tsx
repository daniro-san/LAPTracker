// /w/[slug]/follow-up (issue 340, D104): the leadership's weekly worklist. The members to look at this
// week under "Check in", "New" and "A tip to share" (D140), alphabetical in each, with a warm line for each
// reason and every fact still to ask by name; each row has one-tap "Talked to them", "Add a note" and a
// link to Members, and a tap on the person opens their panel (a sheet, beside the list from 1024, D122):
// why, a ready message in their language, what to fill in, how it went and the last notes. Then the
// thefts whose follow-up is still open, each linked to its entry in the thefts log. People first (D75):
// notes for the officers, nothing is sent, no ranking, a warm line when nobody is on it. Issue 585: the head
// leads with the week's two numbers, and "Noted this week" says who an officer already noted, by whom.
import { fill } from "@/lib/copy";
import { getEnv } from "@/lib/env";
import type { WorkspaceDictionary, WorkspaceLanguage } from "@/lib/private/dictionary";
import { featureOn } from "@/lib/private/features";
import { followUpView, type FollowUpItem, type FollowUpView } from "@/lib/private/follow-up";
import { cardFormats } from "@/lib/private/member-card";
import type { Reason } from "@/lib/private/members";
import { reasonText, type Formats } from "@/lib/private/members-sheet";
import { inputOf, readyTexts } from "@/lib/private/ready-message";

import { editorWords } from "../../../_ui/facts-form";
import { followUpWords } from "../../../_ui/follow-up-words";
import { FollowUpList, type FollowUpGroup, type FollowUpRow } from "../../../_ui/FollowUpList";
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

/** A member on the list as the browser shows it. */
function rowOf(item: FollowUpItem, t: WorkspaceDictionary, f: Formats, officer: WorkspaceLanguage) {
  const { member, checkIn, toAsk, tip } = item;
  const reasons = checkIn ? member.reasons.map((r) => reasonLine(r, t, f)) : [];
  // Every fact still to ask, by name (issue 460): never only a count.
  const list = toAsk.map((field) => t[`facts.${field}`]).join(", ");
  const lines = [
    ...reasons,
    ...(toAsk.length > 0 ? [fill(t["followup.toAsk"], { list })] : []),
    ...(tip ? [t["followup.reason.coins"]] : []),
  ];
  return {
    uid: member.uid,
    name: member.name,
    rank: member.rank,
    tag: member.officerStatus === "help" ? t["status.help"] : null,
    lines,
    ask: toAsk.map((field) => ({ field, label: t[`facts.${field}`] })),
    message: messageOf(item, officer),
    versions: {
      away: member.facts.away?.version ?? 0,
      status: member.facts.status?.version ?? 0,
    },
  } satisfies FollowUpRow;
}

/**
 * "Check in · n", "New · n", then "A tip to share · n" (D140), each alphabetical (the items come by name);
 * a member is in the first group that holds them, empty groups left out.
 */
function groupsOf(
  items: FollowUpItem[],
  t: WorkspaceDictionary,
  f: Formats,
  officer: WorkspaceLanguage,
): FollowUpGroup[] {
  const checkIn = items.filter((i) => i.checkIn);
  const fresh = items.filter((i) => !i.checkIn && i.toAsk.length > 0);
  const tip = items.filter((i) => !i.checkIn && i.toAsk.length === 0);
  return [
    { id: "checkin", key: "followup.group.checkin" as const, items: checkIn },
    { id: "new", key: "followup.group.new" as const, items: fresh },
    { id: "tip", key: "followup.group.tip" as const, items: tip },
  ]
    .filter((g) => g.items.length > 0)
    .map((g) => ({
      id: g.id,
      title: fill(t[g.key], { n: g.items.length }),
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
