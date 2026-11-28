// The alliance page's "Statement and joining" card (D128, issue 479): how to join, then the text the
// alliance writes in game, then the date of the daily read it comes from. The text is plain text with its
// line breaks (no HTML, no Markdown, links not clickable), labelled as the alliance's own, in its language.
// No statement: the card is the joining line alone. No daily read with a response: no card.
import { Fragment } from "react";

import { Measure } from "@/lib/brand/components/layout/Measure";
import { type Dictionary } from "@/lib/copy";
import type { AllianceStatement } from "@/lib/queries";
import { fill } from "@/lib/words";

import { compact, dayDate, type Clock } from "./format";
import { StatementText } from "./StatementText";
import { LABEL } from "./StatTable";

const TEXT = "mt-1 whitespace-pre-line break-words border-l-2 border-rule pl-3";

/** About 304 px of 16 px text at 360 px, rounded down so a doubtful text gets the clamp. */
const LINE_CHARS = 32;
const LINES = 6;

/** Whether the text may run past six lines at 360 px: only then is it clamped, with its button. */
export const mayRunLong = (text: string) =>
  text
    .split("\n")
    .reduce((n, line) => n + Math.max(1, Math.ceil([...line].length / LINE_CHARS)), 0) > LINES;

/** `Full (101/100)`, `1 seat open (99/100)`, `27 seats open (73/100)`. */
function seats(members: number, capacity: number, c: Dictionary["statement"]) {
  const n = Math.max(0, capacity - members);
  const template = n === 0 ? c.full : n === 1 ? c.seatOne : c.seats;
  return fill(template, { n, members: `${members}`, capacity: `${capacity}` });
}

/** A game minimum is a round number: `8M`, not D78's `8.00M` (owner, 2026-11-20); `8.5M` keeps its digit.
 * Also /alliances' "Alliances recruiting". */
export const roundMinimum = (n: number, locale: string): string =>
  compact(n, locale)
    .replace(/([.,]\d*?)0+(?=\D*$)/, "$1")
    .replace(/[.,](?=\D*$)/, "");

/** The joining line's parts, `By application`, `8M+ might`, `HQ 14+`, `Full (100/100)`; a missing
 * part is left out. The `+` marks a minimum; a symbol, so it stays here, not in the copy. */
export function joiningParts(s: AllianceStatement, locale: string, copy: Dictionary): string[] {
  const c = copy.statement;
  const mode = s.open === null ? null : s.open ? c.open : c.byApplication;
  return [
    mode,
    s.minMight !== null && fill(c.might, { might: `${roundMinimum(s.minMight, locale)}+` }),
    s.minHq !== null && fill(c.hq, { level: `${s.minHq}+` }),
    s.members !== null && s.capacity !== null && seats(s.members, s.capacity, c),
  ].filter((part): part is string => Boolean(part));
}

export function AllianceStatementCard({
  statement,
  clock,
  locale,
  copy,
}: {
  statement: AllianceStatement | null;
  clock: Clock;
  locale: string;
  copy: Dictionary;
}) {
  if (!statement) return null;
  const c = copy.statement;
  const { text } = statement;
  const lang = statement.lang ?? undefined;
  const joining = joiningParts(statement, locale, copy);
  return (
    <section aria-labelledby="statement-h" className="mt-8">
      <h2 id="statement-h" className="mb-2 font-subhead text-display-md">
        {text ? c.title : c.joining}
      </h2>
      <div className="drawn-card px-3 py-3 sm:px-4">
        {joining.length > 0 && (
          // Each part stays whole; the line breaks only between parts (DESIGN.md "Nothing short wraps").
          <p className="font-medium">
            {joining.map((part, i) => (
              <Fragment key={part}>
                {i > 0 && " · "}
                <span className="whitespace-nowrap">{part}</span>
              </Fragment>
            ))}
          </p>
        )}
        {text && (
          <figure className="mt-3 border-t border-rule pt-3">
            <figcaption className={LABEL}>{c.by}</figcaption>
            <Measure>
              {mayRunLong(text) ? (
                <StatementText text={text} lang={lang} className={TEXT} />
              ) : (
                <blockquote lang={lang} dir="auto" className={TEXT}>
                  {text}
                </blockquote>
              )}
            </Measure>
          </figure>
        )}
        <p className="mt-2 text-sm text-ink/70">
          {fill(copy.ledger.asOf, { time: clock.day(dayDate(statement.day)) })}
        </p>
      </div>
    </section>
  );
}
