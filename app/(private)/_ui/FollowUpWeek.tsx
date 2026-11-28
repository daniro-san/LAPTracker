// Follow-up's week around the list (issue 585), rendered on the server: the head with the week's two numbers
// and its jumps, and the foot with "Noted this week" and the thefts still open. The Noted card is always
// there, before the alliance's first daily update too, so the head's jump always has its card and the
// Monday rule is always on the page (D104, amended 2026-11-22). People first (D75): nothing is ranked.
import { isolate } from "@/lib/copy";
import { dateWords } from "@/lib/date-words";
import type { WorkspaceDictionary, WorkspaceLanguage } from "@/lib/private/dictionary";
import type { FollowUpView, NotedItem } from "@/lib/private/follow-up";
import {
  helloOnly,
  inKvkGroup,
  notedLine,
  type FollowUpAction,
} from "@/lib/private/follow-up-rules";
import type { Formats } from "@/lib/private/members-sheet";
import type { AttackerGroup } from "@/lib/private/theft-groups";
import { fill, plural } from "@/lib/words";

const LINK =
  "inline-flex min-h-11 items-center font-semibold text-plum underline underline-offset-4";

/** "Nov 16 – 22" in the officer's language. */
const weekRange = (week: string[], language: string) =>
  dateWords(language, "UTC").range(week[0] as string, week[6] as string);

/**
 * The title, then the week's two numbers: who is left to look at and who was already noted, with jumps to
 * the noted and the thefts; then "How this list works" (issue 585 S3): what to do (issue 460) and the D104
 * promise, one tap away, its summary always saying how to open a member's panel. Closed on every visit
 * (issue 585 batch 4 S2): open, it pushed the groups below a phone's first screen.
 */
export function FollowUpHead(props: {
  data: FollowUpView;
  t: WorkspaceDictionary;
  language: WorkspaceLanguage;
}) {
  const { data, t, language } = props;
  // "After KvK, offer help" (issue 585 S5): the members in it, not those under Needs help.
  const hit = data.items.filter(inKvkGroup).length;
  // Issue 828: a hello to a new member is on the list but not among the members to look at.
  const toLook = data.items.filter((i) => !helloOnly(i)).length;
  return (
    <>
      <h1 className="font-display text-display-lg">{t["tab.review"]}</h1>
      <p className="mt-1 font-semibold">
        {fill(t["followup.week"], { range: weekRange(data.week, language) })}
      </p>
      {toLook === 0 ? (
        <>
          <p className="font-semibold">{t["followup.empty"]}</p>
          {data.early && <p className="mt-1 text-body-sm text-ink/80">{t["followup.early"]}</p>}
        </>
      ) : (
        <p className="font-semibold">{fill(t["followup.count"], { n: toLook })}</p>
      )}
      <div className="flex flex-wrap gap-x-4">
        {hit > 0 && (
          <a href="#follow-up-kvk" className={LINK}>
            {fill(
              plural(
                hit,
                { one: t["followup.kvk.jump.one"], other: t["followup.kvk.jump.other"] },
                language,
              ),
              { n: hit },
            )}
          </a>
        )}
        {data.noted.length > 0 && (
          <a href="#follow-up-noted" className={LINK}>
            {fill(
              plural(
                data.noted.length,
                { one: t["followup.noted.jump.one"], other: t["followup.noted.jump.other"] },
                language,
              ),
              { n: data.noted.length },
            )}
          </a>
        )}
        {data.thefts.length > 0 && (
          <a href="#follow-up-thefts" className={LINK}>
            {fill(
              plural(
                data.thefts.length,
                { one: t["followup.theftsJump.one"], other: t["followup.theftsJump.other"] },
                language,
              ),
              { n: data.thefts.length },
            )}
          </a>
        )}
      </div>
      <details className="mt-1 text-body-sm">
        <summary className="min-h-11 cursor-pointer py-2.5">
          {t["followup.howTap"]}{" "}
          <span className="font-semibold text-plum underline underline-offset-4">
            {t["followup.how"]}
          </span>
        </summary>
        <div className="space-y-1 pb-2 text-ink/80">
          <p>{t["followup.todo"]}</p>
          <p>{t["followup.help"]}</p>
        </div>
      </details>
    </>
  );
}

/**
 * "Noted this week · n": each member an officer noted since Monday, newest first, the officer and the day
 * first ("Tomas · Thu, Nov 19: Talked to them"), the note under it, the name opening their card.
 */
function Noted(props: { slug: string; noted: NotedItem[]; t: WorkspaceDictionary; f: Formats }) {
  const { t, f, noted } = props;
  return (
    <section
      id="follow-up-noted"
      className="drawn-card mt-4 scroll-mt-4 px-4 pt-3 pb-1"
      aria-labelledby="follow-up-noted-h"
    >
      <h2 id="follow-up-noted-h" className="font-subhead text-display-sm">
        {fill(t["followup.noted.head"], { n: noted.length })}
      </h2>
      <p className="text-body-sm text-ink/80">{t["followup.rule"]}</p>
      {noted.length === 0 ? (
        <p className="py-2">{t["followup.noted.none"]}</p>
      ) : (
        // ph-no-capture (issue 549): names, notes and officers never reach session replay.
        <ul className="ph-no-capture mt-1">
          {noted.map(({ member, record }) => {
            // A withdrawn record never counts (liveRecords), so a noted one is one of the four answers.
            const row = { ...record, action: record.action as FollowUpAction };
            return (
              <li key={member.uid} className="border-t border-rule pb-2">
                <a href={`/w/${props.slug}/members?m=${member.uid}`} className={LINK}>
                  <bdi translate="no">{member.name}</bdi>
                </a>
                {member.rank && <span className="text-ink/75">{` · ${member.rank}`}</span>}
                <p className="text-body-sm">{notedLine(row, t, f.date, f.date)}</p>
                {record.note && <p className="text-body-sm text-ink/80">{record.note}</p>}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
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

/** After the list, in its column: the Noted card (always) and the thefts still open. */
export function FollowUpFoot(props: {
  slug: string;
  data: FollowUpView;
  t: WorkspaceDictionary;
  f: Formats;
}) {
  const { slug, data, t } = props;
  return (
    <>
      <Noted slug={slug} noted={data.noted} t={t} f={props.f} />
      <Thefts slug={slug} thefts={data.thefts} t={t} />
    </>
  );
}
