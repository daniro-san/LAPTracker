// /w/[slug]/follow-up (issue 340, D104): the leadership's weekly worklist. The members to look at this
// week under "Check in" and "New", alphabetical in each, with a warm line for each reason and how many
// facts are still to ask; each row has one-tap "Talked to them", "Add a note" and a link to Members. Then
// the thefts whose follow-up is still open, each linked to its entry in the thefts log. People first (D75):
// notes for the officers, nothing is sent, no ranking, a warm line when nobody is on it.
import { fill, isolate } from "@/lib/copy";
import type { WorkspaceDictionary, WorkspaceKey } from "@/lib/private/dictionary";
import { featureOn } from "@/lib/private/features";
import { followUpView, type FollowUpView } from "@/lib/private/follow-up";
import type { WorkItem } from "@/lib/private/follow-up-rules";
import { cardFormats } from "@/lib/private/member-card";
import type { Reason } from "@/lib/private/members";
import { reasonText, type Formats } from "@/lib/private/members-sheet";
import type { AttackerGroup } from "@/lib/private/theft-groups";

import { followUpWords } from "../../../_ui/follow-up-words";
import { FollowUpList, type FollowUpGroup, type FollowUpRow } from "../../../_ui/FollowUpList";
import { SignedInFrame } from "../../../_ui/Frame";
import { openRollCall } from "../../../_ui/roll-call-page";

const LINK =
  "inline-flex min-h-11 items-center font-semibold text-plum underline underline-offset-4";

/** The singular or plural form of a Follow-up phrase, by the language's own rule. */
function counted(t: WorkspaceDictionary, key: string, n: number, language: string) {
  const form = new Intl.PluralRules(language).select(n) === "one" ? "one" : "other";
  return fill(t[`${key}.${form}` as WorkspaceKey], { n });
}

/** A reason in Follow-up's own words ("Quiet for 3 days. Worth a hello."); the held KvK one as Members says it. */
function reasonLine(r: Reason, t: WorkspaceDictionary, f: Formats) {
  if (r.kind === "kvk") return reasonText(r, t, f);
  return counted(t, `followup.reason.${r.kind}`, r.days, f.language);
}

/** A member on the list as the browser shows it. */
function rowOf({ member, checkIn, toAsk }: WorkItem, t: WorkspaceDictionary, f: Formats) {
  const reasons = checkIn ? member.reasons.map((r) => reasonLine(r, t, f)) : [];
  const ask = toAsk.length > 0 ? [counted(t, "followup.ask", toAsk.length, f.language)] : [];
  const list = toAsk.map((field) => t[`facts.${field}`]).join(", ");
  return {
    uid: member.uid,
    name: member.name,
    rank: member.rank,
    tag: member.officerStatus === "help" ? t["status.help"] : null,
    lines: [...reasons, ...ask],
    detail: [...reasons, ...(toAsk.length > 0 ? [fill(t["followup.toAsk"], { list })] : [])],
    versions: {
      away: member.facts.away?.version ?? 0,
      status: member.facts.status?.version ?? 0,
    },
  } satisfies FollowUpRow;
}

/** "Check in · n" then "New · n", each alphabetical (the items come by name); empty groups left out. */
function groupsOf(items: WorkItem[], t: WorkspaceDictionary, f: Formats): FollowUpGroup[] {
  const checkIn = items.filter((i) => i.checkIn);
  const fresh = items.filter((i) => !i.checkIn);
  return [
    { id: "checkin", key: "followup.group.checkin" as const, items: checkIn },
    { id: "new", key: "followup.group.new" as const, items: fresh },
  ]
    .filter((g) => g.items.length > 0)
    .map((g) => ({
      id: g.id,
      title: fill(t[g.key], { n: g.items.length }),
      rows: g.items.map((i) => rowOf(i, t, f)),
    }));
}

/** "16 – 22 Nov" in the officer's language. */
function weekRange(week: string[], language: string) {
  const at = (day: string | undefined) => new Date(`${day}T00:00:00Z`);
  return new Intl.DateTimeFormat(language, {
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  }).formatRange(at(week[0]), at(week[6]));
}

function Thefts(props: { slug: string; thefts: AttackerGroup[]; t: WorkspaceDictionary }) {
  const { t, thefts, slug } = props;
  if (thefts.length === 0) return null;
  return (
    <section
      id="follow-up-thefts"
      className="drawn-card mt-6 scroll-mt-4 px-4 pt-3"
      aria-labelledby="follow-up-thefts-h"
    >
      <h2 id="follow-up-thefts-h" className="font-subhead text-display-sm">
        {fill(t["followup.thefts"], { n: thefts.length })}
      </h2>
      <ul className="mt-1">
        {thefts.map((a) => (
          <li key={a.key} className="border-t border-rule text-body-sm">
            <a
              href={`/w/${slug}/thefts#attacker-${encodeURIComponent(a.key)}`}
              className="block min-h-11 py-3"
            >
              <span className="font-semibold text-plum underline underline-offset-4" translate="no">
                {a.tag ? `[${isolate(a.tag)}] ` : ""}
                <bdi>{a.name}</bdi>
              </span>
              {/* The step they are at; yarn while nothing is done yet (D104, amended 2026-11-19). */}
              <span className={a.followUp.state === "open" ? "text-yarn" : undefined}>
                {` · ${a.followUp.reopened ? t["thefts.state.reopened"] : t[`thefts.state.${a.followUp.state}`]}`}
              </span>
              {a.week > 0 && <span>{` · ${fill(t["thefts.week"], { n: a.week })}`}</span>}
            </a>
          </li>
        ))}
      </ul>
      <a href={`/w/${slug}/thefts`} className={LINK}>
        {t["followup.theftsLink"]}
      </a>
    </section>
  );
}

export default async function FollowUpPage({ params }: { params: Promise<{ slug: string }> }) {
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
  const groups = groupsOf(data.items, t, f);
  return (
    <SignedInFrame
      access={access}
      language={language}
      t={t}
      current="review"
      waiting={page.waiting}
    >
      <h1 className="font-display text-display-lg">{t["tab.review"]}</h1>
      <p className="mt-1 text-body-sm text-ink/80">{t["followup.help"]}</p>
      <p className="mt-3 font-semibold">
        {fill(t["followup.week"], { range: weekRange(data.week, language) })}
      </p>
      <p className="text-body-sm text-ink/80">{t["followup.rule"]}</p>
      {data.items.length === 0 ? (
        <>
          <p className="mt-2">{t["followup.empty"]}</p>
          {data.early && <p className="mt-1 text-body-sm text-ink/80">{t["followup.early"]}</p>}
        </>
      ) : (
        <p className="mt-2 text-body-sm">{fill(t["followup.count"], { n: data.items.length })}</p>
      )}
      {data.thefts.length > 0 && (
        <a href="#follow-up-thefts" className={`${LINK} text-body-sm`}>
          {counted(t, "followup.theftsJump", data.thefts.length, language)}
        </a>
      )}
      {/* Always mounted, so the saved line with Undo stays after the last member leaves. */}
      <FollowUpList
        slug={slug}
        groups={groups}
        today={today}
        language={language}
        words={followUpWords(t)}
      />
      <Thefts slug={slug} thefts={data.thefts} t={t} />
    </SignedInFrame>
  );
}
