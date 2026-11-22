// Home's members box (panel PD-1), rendered on the server: who to thank, and how many to check in with by
// Members' rule while the Follow-up tab is off (D126); "not yet" before the first end-of-day read, when
// nothing is computed (D75). Under the week's progress, "Share the thanks" (D114), with a gentle line on
// Sunday and Monday until it is shared.
// A margin note of Home's spread (D122): a card below 1024, unframed hairline rows beside the main column.
// While the Follow-up tab is on, Follow-up's two numbers are a card of Home's main column instead
// (HomeFollowUp, issue 585 slice 4), so the first phone screen says them.
import { MarginNote } from "@/lib/brand/components/layout/MarginNote";
import { getEnv } from "@/lib/env";
import type { WorkspaceDictionary, WorkspaceLanguage } from "@/lib/private/dictionary";
import type { WeekCounts } from "@/lib/private/follow-up";
import { cardFormats, progressText } from "@/lib/private/member-card";
import type { MembersView } from "@/lib/private/members";
import { serverDay } from "@/lib/schedule";
import { fill, plural } from "@/lib/words";

import { AllianceWeekLine, allianceWeekParts } from "./AllianceWeekLine";
import { LINK } from "./BoardText";
import { checkInLink } from "./CheckInLine";
import { HomeNotedLink } from "./HomeNotedLink";
import { shareThanksProps, type ShareThanksProps, type ThanksSwitches } from "./share-thanks-data";
import { ShareThanks } from "./ShareThanks";

/** D109's progress in name order, its own block under the top lists, with "Share the thanks" (D114). */
function SayThanks(props: {
  t: WorkspaceDictionary;
  view: MembersView;
  nudge: boolean;
  share: ShareThanksProps;
}) {
  const { t, view } = props;
  return (
    <div className="py-2">
      {view.thanks.progress.length > 0 && (
        <p className="max-w-sm text-body-sm">
          <span className="font-semibold text-ink/75">{t["thanks.progress"]} </span>
          {view.thanks.progress.map((p, i) => (
            <span key={p.uid}>
              {i > 0 && "; "}
              <bdi translate="no" className="font-semibold">
                {p.name}
              </bdi>{" "}
              {progressText(p, t)}
            </span>
          ))}
        </p>
      )}
      <ShareThanks nudge={props.nudge} {...props.share} />
    </div>
  );
}

/**
 * Follow-up's two numbers in Home's words (issue 585 slice 4): "12 members to look at this week" and "4
 * already noted by officers" (null when 0); null when both are 0. Members keeps S1's line (weekCountLine).
 */
export function followUpWords(
  counts: WeekCounts,
  t: WorkspaceDictionary,
  language: WorkspaceLanguage,
) {
  if (counts.toLook === 0 && counts.noted === 0) return null;
  const head =
    counts.toLook === 0
      ? t["home.followUp.nobody"]
      : fill(
          plural(
            counts.toLook,
            { one: t["home.followUp.toLook.one"], other: t["home.followUp.toLook.other"] },
            language,
          ),
          { n: counts.toLook },
        );
  const noted =
    counts.noted === 0
      ? null
      : fill(
          plural(
            counts.noted,
            { one: t["home.followUp.noted.one"], other: t["home.followUp.noted.other"] },
            language,
          ),
          { n: counts.noted },
        );
  return { head, noted };
}

/**
 * Home's "Follow-up" card, near the top of the main column (issue 585 slice 4): the week's two numbers, or
 * "Everyone looks fine this week."; nothing while the tab is off (D126) or before the first daily update,
 * when `followUp` is null. Two stacked links (drilldown batch C): the head to Follow-up, and "n already
 * noted by officers ›" to its "Noted this week", which lists exactly those n.
 */
export function HomeFollowUp(props: {
  slug: string;
  t: WorkspaceDictionary;
  language: WorkspaceLanguage;
  followUp: WeekCounts | null;
}) {
  const { t, followUp } = props;
  if (followUp === null) return null;
  const line = followUpWords(followUp, t, props.language);
  return (
    <section aria-labelledby="home-follow-up" className="drawn-card mt-4 px-4 py-3 first:mt-0">
      <h2 id="home-follow-up" className="font-subhead text-display-sm">
        {t["tab.review"]}
      </h2>
      {line === null ? (
        <p className="py-2">{t["members.checkinNone"]}</p>
      ) : (
        <div className="flex flex-col items-start">
          <a href={`/w/${props.slug}/follow-up`} className={LINK}>
            {line.head}
            <span aria-hidden="true">&nbsp;›</span>
          </a>
          {line.noted && <HomeNotedLink slug={props.slug} n={followUp.noted} text={line.noted} />}
        </div>
      )}
    </section>
  );
}

export function HomeMembers(props: {
  slug: string;
  t: WorkspaceDictionary;
  language: WorkspaceLanguage;
  view: MembersView;
  /** Sunday or Monday, and the week's thanks not shared yet (D114). */
  nudge: boolean;
  /** D126: the thanks sheet's switches. */
  switches: ThanksSwitches;
  /** Follow-up's numbers (issue 585), said by HomeFollowUp; null: the tab is off (D126), or no read yet. */
  followUp: WeekCounts | null;
}) {
  const { slug, t, language, view, nudge } = props;
  const members = `/w/${slug}/members`;
  const now = new Date();
  const f = cardFormats(language, getEnv().SERVER_TZ, now);
  // The top 3 donors; the most active when no donation was read this week.
  const [key, thanks] =
    view.thanks.donors.length > 0
      ? (["thanks.donors", view.thanks.donors] as const)
      : (["thanks.activity", view.thanks.activity] as const);
  // Members' own count while the Follow-up tab is off; while it is on, HomeFollowUp says its numbers.
  const check = props.followUp === null ? checkInLink(slug, view, null, t, f) : null;
  const today = serverDay(now, getEnv());
  const sharing = view.thanks.progress.length > 0 || nudge;
  return (
    <MarginNote id="home-members" title={t["home.members.head"]}>
      {view.early ? (
        <p className="py-2">{t["home.notYet"]}</p>
      ) : (
        <>
          {thanks.length > 0 && (
            <div className="max-w-sm py-2">
              <h3 className="text-body-sm font-semibold text-ink/75">{t[key]}</h3>
              {/* ph-no-capture (issue 549): each name's week of donations or quest points, in their order,
                  never reaches session replay. */}
              <ol className="ph-no-capture">
                {thanks.map((x) => (
                  <li key={x.uid} className="flex justify-between gap-2">
                    <span translate="no" className="min-w-0 truncate font-semibold">
                      {x.name}
                    </span>
                    <span className="tabular-nums">{f.compact(x.value)}</span>
                  </li>
                ))}
              </ol>
            </div>
          )}
          {sharing && (
            <SayThanks
              {...props}
              share={shareThanksProps({ slug, t, language, view, today, switches: props.switches })}
            />
          )}
          {/* Issue 466: the alliance's week after the thanks (D75: thanks first). */}
          <AllianceWeekLine
            parts={allianceWeekParts(view, t, f, today)}
            className="max-w-sm py-2"
          />
          {/* "Everyone looks fine" is left out beside the thanks block, where it reads as noise (D114), and
              while the main column's Follow-up card has the week. */}
          {check === null ? (
            !sharing &&
            props.followUp === null && <p className="py-2">{t["members.checkinNone"]}</p>
          ) : (
            <p>
              <a href={check.href} className={LINK}>
                {check.text}
              </a>
            </p>
          )}
        </>
      )}
      <p>
        <a href={members} className={LINK}>
          {t["home.open"]}
        </a>
      </p>
    </MarginNote>
  );
}
