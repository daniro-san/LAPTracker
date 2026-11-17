// /w/[slug]/follow-up (issue 340, D104): the leadership's weekly worklist. The members to look at this
// week, with the Members tab's reasons and the onboarding facts still to ask, each with "Note what
// happened"; then the thefts whose follow-up is still open, linked to the thefts log. People first (D75):
// notes for the officers, nothing is sent, no ranking (by name), a warm line when nobody is on it.
import { fill, isolate } from "@/lib/copy";
import type { WorkspaceDictionary } from "@/lib/private/dictionary";
import { followUpView, type FollowUpView } from "@/lib/private/follow-up";
import type { WorkItem } from "@/lib/private/follow-up-rules";
import { cardFormats } from "@/lib/private/member-card";
import { reasonText, type Formats } from "@/lib/private/members-sheet";
import type { AttackerGroup } from "@/lib/private/theft-groups";

import { followUpWords } from "../../../_ui/follow-up-words";
import { FollowUpList, type FollowUpRow } from "../../../_ui/FollowUpList";
import { SignedInFrame } from "../../../_ui/Frame";
import { openRollCall } from "../../../_ui/roll-call-page";

const LINK =
  "inline-flex min-h-11 items-center font-semibold text-plum underline underline-offset-4";

/** A member on the list as the browser shows it: the reasons and what is still to ask, in words. */
function rowOf({ member, checkIn, toAsk }: WorkItem, t: WorkspaceDictionary, f: Formats) {
  const reasons = member.reasons.map((r) => reasonText(r, t, f)).join("; ");
  const ask = toAsk.map((field) => t[`facts.${field}`]).join(", ");
  return {
    uid: member.uid,
    name: member.name,
    rank: member.rank,
    lines: [
      ...(checkIn ? [`${t["status.checkin"]}: ${reasons}`] : []),
      ...(toAsk.length > 0 ? [fill(t["followup.toAsk"], { list: ask })] : []),
    ],
    versions: {
      away: member.facts.away?.version ?? 0,
      status: member.facts.status?.version ?? 0,
    },
  } satisfies FollowUpRow;
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
  const { t, thefts } = props;
  if (thefts.length === 0) return null;
  return (
    <section className="mt-6" aria-labelledby="follow-up-thefts">
      <h2 id="follow-up-thefts" className="font-subhead text-display-sm">
        {fill(t["followup.thefts"], { n: thefts.length })}
      </h2>
      <ul className="mt-1">
        {thefts.map((a) => (
          <li key={a.key} className="border-t border-rule py-2 text-body-sm">
            <span className="font-semibold" translate="no">
              {a.tag ? `[${isolate(a.tag)}] ` : ""}
              <bdi>{a.name}</bdi>
            </span>
            <span className="text-yarn">
              {` · ${t[a.followUp.reopened ? "thefts.state.reopened" : "thefts.state.open"]}`}
            </span>
            {a.week > 0 && <span>{` · ${fill(t["thefts.week"], { n: a.week })}`}</span>}
          </li>
        ))}
      </ul>
      <a href={`/w/${props.slug}/thefts`} className={LINK}>
        {props.t["followup.theftsLink"]}
      </a>
    </section>
  );
}

export default async function FollowUpPage({ params }: { params: Promise<{ slug: string }> }) {
  const page = await openRollCall<FollowUpView>(
    params,
    "follow-up",
    (db, access, _today, _l, zone) => followUpView(db, access, new Date(), zone),
  );
  const { access, slug, t, language, today, data } = page;
  const f = cardFormats(language, page.zone, page.now);
  const rows = data.items.map((item) => rowOf(item, t, f));
  const words = followUpWords(t);
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
      {rows.length === 0 ? (
        <>
          <p className="mt-2 font-subhead text-display-sm">{t["followup.empty"]}</p>
          {data.early && <p className="mt-1 text-body-sm text-ink/80">{t["followup.early"]}</p>}
        </>
      ) : (
        <p className="text-body-sm">{fill(t["followup.count"], { n: rows.length })}</p>
      )}
      {/* Always mounted, so "Saved. … is off this week's list." stays after the last member leaves. */}
      <FollowUpList slug={slug} rows={rows} today={today} words={words} />
      <Thefts slug={slug} thefts={data.thefts} t={t} />
    </SignedInFrame>
  );
}
