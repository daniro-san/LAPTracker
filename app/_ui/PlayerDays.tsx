// "Day by day" on the player page (issue 773): each reading of the player (the daily update, an event's
// Start or End) against the one before it, newest first, 14 a page: when and what was read, the alliance,
// Might and Kills with their change, a rename, a move to another alliance, and the days with no reading
// the change spans. Built from the same readings as the growth card, so the page has one history. The same
// list at every width; the two figures sit side by side from 360 px.
import { TextLink } from "@/lib/brand/components/TextLink";
import type { Dictionary } from "@/lib/copy";
import type { ProgressStep } from "@/lib/queries";
import { fill } from "@/lib/words";

import { allianceLabel, type Clock } from "./format";
import { Delta, Num } from "./Num";
import { Kind } from "./PlayerProgress";
import { LABEL } from "./StatTable";

const MUTED = "text-ink/70";
const PAGE = 14;

const tagOf = (a: { unionId: number; tag: string | null }) =>
  allianceLabel(a.tag ?? String(a.unionId), null);

function Line({ step, clock, copy }: { step: ProgressStep; clock: Clock; copy: Dictionary }) {
  const { reading: r, previous: p } = step;
  const l = copy.ledger;
  const h = copy.history;
  return (
    <li className="border-b border-rule py-2 last:border-0">
      <p className="flex flex-wrap gap-x-2 text-sm">
        <span className="whitespace-nowrap font-medium">
          {clock.day(r.at)}, {clock.hhmm(r.at)}
        </span>
        <span className={`min-w-0 break-words ${MUTED}`}>
          <Kind r={r} clock={clock} copy={copy} /> · {tagOf(r)}
        </span>
      </p>
      <dl className="mt-1 grid max-w-md grid-cols-2 gap-x-3 tabular-nums">
        {(
          [
            ["power", l.might],
            ["kills", l.kills],
          ] as const
        ).map(([key, label]) => (
          <div key={key} className="min-w-0">
            <dt className={LABEL}>{label}</dt>
            <dd className="font-medium">
              <Num n={r[key]} />
            </dd>
            {p && (
              <dd className="text-sm">
                <Delta delta={step[key]} base={p[key]} stack />
              </dd>
            )}
          </div>
        ))}
      </dl>
      {step.movedFrom && (
        <p className="mt-1 text-sm">
          {fill(h.moved, { tag: tagOf(r), from: tagOf(step.movedFrom) })}
        </p>
      )}
      {step.renamedFrom && (
        <p className="mt-1 break-words text-sm">
          {h.renamed} · <bdi>{fill(l.was, { name: step.renamedFrom })}</bdi>
        </p>
      )}
      {p && step.gap && (
        <p className={`mt-1 text-sm ${MUTED}`}>{fill(h.gap, { date: clock.day(p.at) })}</p>
      )}
      {!p && <p className={`mt-1 text-sm ${MUTED}`}>{h.first}</p>}
    </li>
  );
}

const href = (uid: number, before: Date | null) =>
  `/players/${uid}${before ? `?before=${encodeURIComponent(before.toISOString())}` : ""}#days`;

export function PlayerDays({
  uid,
  steps,
  before,
  clock,
  copy,
}: {
  uid: number;
  /** Newest first (`progressSteps`). */
  steps: ProgressStep[];
  /** The page's cursor: readings older than this; null for the newest page. */
  before: Date | null;
  clock: Clock;
  copy: Dictionary;
}) {
  if (steps.length < 2) return null;
  const h = copy.history;
  const rest = before ? steps.filter((s) => s.reading.at < before) : steps;
  const page = rest.slice(0, PAGE);
  const older = rest.length > PAGE ? (page.at(-1)?.reading.at ?? null) : null;
  return (
    <section id="days" className="mt-8 scroll-mt-20">
      <h2 className="mb-1 font-subhead text-display-md">{h.playerTitle}</h2>
      <p className={`mb-3 text-body-sm ${MUTED}`}>{h.playerLead}</p>
      {page.length === 0 ? (
        <p className={`text-sm ${MUTED}`}>{h.none}</p>
      ) : (
        <ul className="drawn-card px-3">
          {page.map((s) => (
            <Line
              key={`${s.reading.at.getTime()}|${s.reading.unionId}`}
              step={s}
              clock={clock}
              copy={copy}
            />
          ))}
        </ul>
      )}
      <nav className="mt-2 flex flex-wrap justify-between gap-2">
        {before && (
          <TextLink
            href={href(uid, null)}
            className="inline-flex min-h-11 items-center px-2 text-sm font-medium"
          >
            <span aria-hidden="true">↑&nbsp;</span>
            {h.newest}
          </TextLink>
        )}
        {older && (
          <TextLink
            href={href(uid, older)}
            className="ml-auto inline-flex min-h-11 items-center px-2 text-sm font-medium"
          >
            {h.older}
            <span aria-hidden="true">&nbsp;↓</span>
          </TextLink>
        )}
      </nav>
    </section>
  );
}
