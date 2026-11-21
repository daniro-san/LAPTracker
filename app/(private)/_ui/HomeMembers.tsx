// Home's members box (panel PD-1), rendered on the server: who to thank and how many to check in with, as
// Members shows them; "not yet" before the first end-of-day read, when nothing is computed (D75). Under the
// week's progress, "Share the thanks" (D114), with a gentle line on Sunday and Monday until it is shared.
// A margin note of Home's spread (D122): a card below 1024, unframed hairline rows beside the main column.
import { MarginNote } from "@/lib/brand/components/layout/MarginNote";
import { fill } from "@/lib/copy";
import { getEnv } from "@/lib/env";
import type { WorkspaceDictionary, WorkspaceLanguage } from "@/lib/private/dictionary";
import { cardFormats, progressText } from "@/lib/private/member-card";
import type { MembersView } from "@/lib/private/members";
import { needsAWord, whoOf } from "@/lib/private/members-list";
import { plural } from "@/lib/private/members-sheet";
import { serverDay } from "@/lib/schedule";

import { AllianceWeekLine, allianceWeekParts } from "./AllianceWeekLine";
import { LINK } from "./BoardText";
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

export function HomeMembers(props: {
  slug: string;
  t: WorkspaceDictionary;
  language: WorkspaceLanguage;
  view: MembersView;
  /** Sunday or Monday, and the week's thanks not shared yet (D114). */
  nudge: boolean;
  /** D126: the thanks sheet's switches. */
  switches: ThanksSwitches;
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
  const checkins = view.members.filter((m) => needsAWord(whoOf(m))).length;
  const today = serverDay(now, getEnv());
  const sharing = view.thanks.progress.length > 0 || nudge;
  return (
    <MarginNote id="home-members" title={t["home.members.head"]}>
      {view.early ? (
        <p className="py-2">{t["home.notYet"]}</p>
      ) : (
        <>
          <AllianceWeekLine
            parts={allianceWeekParts(view, t, f, today)}
            className="max-w-sm py-2"
          />
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
          {/* "Everyone looks fine" is left out beside the thanks block, where it reads as noise (D114). */}
          {checkins === 0 ? (
            !sharing && <p className="py-2">{t["members.checkinNone"]}</p>
          ) : (
            <p>
              <a href={`${members}?order=rank#ml-heading`} className={LINK}>
                {fill(plural(t, "members.checkinCount", checkins, f), { n: checkins })}
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
