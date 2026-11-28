// Raid prep → This week's raid opponent, its result (issue 861, D165): "Us vs [TAG] (S328)" with the Start
// and End lines, then Start→End (kills gained, might change, members) for each side with both reads, and the
// past raids by opponent. A side with a missing read shows no number, only that the read is missing
// (INVARIANT freshness.no-stale-delta). No win or loss words (D75): both sides in one plain table.
import { dateWords } from "@/lib/date-words";
import type { WorkspaceDictionary } from "@/lib/private/dictionary";
import { compact } from "@/lib/private/insights-format";
import type { RaidOpponentView } from "@/lib/private/raid-opponent";
import type { RaidSide } from "@/lib/raid-opponent";
import { fill } from "@/lib/words";

export type Words = { t: WorkspaceDictionary; language: string; zone: string };
type Named = { who: string; side: RaidSide };

const signed = (n: number, language: string) => `${n > 0 ? "+" : ""}${compact(n, language)}`;

/** Start→End as a table, one column per side with both reads; the sides without say so instead. */
function Numbers(props: { sides: Named[]; w: Words }) {
  const { t, language } = props.w;
  const counted = props.sides.filter((s) => s.side.change !== null);
  const missing = props.sides.filter((s) => s.side.change === null);
  const members = (s: RaidSide) =>
    s.start?.members != null && s.end?.members != null
      ? `${compact(s.start.members, language)} → ${compact(s.end.members, language)}`
      : "";
  return (
    <>
      {counted.length > 0 && (
        <table className="mt-2 w-full text-left tabular-nums">
          <thead>
            <tr>
              <th scope="col" className="sr-only" />
              {counted.map((s) => (
                <th key={s.who} scope="col" className="px-2 py-1 font-semibold">
                  {s.who}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {(
              [
                ["roll.prep.raid.kills", (s: RaidSide) => signed(s.change?.kills ?? 0, language)],
                ["roll.prep.raid.might", (s: RaidSide) => signed(s.change?.might ?? 0, language)],
                ["roll.prep.raid.members", members],
              ] as const
            ).map(([key, value]) => (
              <tr key={key} className="border-t border-rule">
                <th scope="row" className="py-1 pr-2 font-medium">
                  {t[key]}
                </th>
                {counted.map((s) => (
                  <td key={s.who} className="px-2 py-1">
                    {value(s.side)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {counted.map((s) => (
        <p key={s.who} className="mt-1 text-body-sm text-ink/80">
          {s.who}: {fill(t["roll.prep.raid.membersCounted"], { n: s.side.change?.members ?? 0 })}
        </p>
      ))}
      {missing.map((s) => (
        <p key={s.who} className="mt-1 text-body-sm">
          {fill(t["roll.prep.raid.noChange"], { who: s.who })}
        </p>
      ))}
    </>
  );
}

/** "Start: Sat 00:00 ST · read", "· to come", or "· missing for TAG". */
function readLine(phase: "start" | "end", view: RaidOpponentView, sides: Named[], w: Words) {
  const { t } = w;
  const words = dateWords(w.language, w.zone);
  const at = new Date(view.reads[phase].at);
  const when = `${words.weekday(at)} ${words.time(at)}`;
  const head = fill(t[phase === "start" ? "roll.prep.raid.readStart" : "roll.prep.raid.readEnd"], {
    when,
  });
  const lacking = sides.filter((s) => s.side[phase] === null).map((s) => s.who);
  const state =
    lacking.length === 0
      ? t["roll.prep.raid.done"]
      : view.reads[phase].due
        ? t["roll.prep.raid.due"]
        : fill(t["roll.prep.raid.missing"], { who: lacking.join(", ") });
  return `${head} · ${state}`;
}

export function ResultPart(props: { view: RaidOpponentView; w: Words }) {
  const { view, w } = props;
  const { t } = w;
  const o = view.opponent;
  const r = view.result;
  if (!o || !r) return null;
  const sides = [
    { who: t["roll.prep.raid.us"], side: r.us },
    { who: o.tag, side: r.them },
  ];
  const ended = !view.reads.end.due;
  return (
    <div className="mt-4 border-t border-rule pt-3">
      <h3 className="font-semibold">
        {fill(t["roll.prep.raid.vs"], { tag: o.tag, server: o.server })}
      </h3>
      <p className="mt-1 text-body-sm">{readLine("start", view, sides, w)}</p>
      <p className="text-body-sm">{readLine("end", view, sides, w)}</p>
      {ended ? (
        <Numbers sides={sides} w={w} />
      ) : (
        <p className="mt-2 text-body-sm text-ink/80">{t["roll.prep.raid.waiting"]}</p>
      )}
    </div>
  );
}

export function HistoryPart(props: { view: RaidOpponentView; w: Words }) {
  const { w } = props;
  const { t } = w;
  if (props.view.history.length === 0) return null;
  const words = dateWords(w.language, w.zone);
  return (
    <details className="mt-4 border-t border-rule pt-3">
      <summary className="flex min-h-11 cursor-pointer items-center font-semibold">
        {t["roll.prep.raid.history"]}
      </summary>
      {props.view.history.map((g) => (
        <section key={`${g.server}-${g.tag}`} className="mt-3">
          <h4 className="font-semibold">
            {fill(t["roll.prep.raid.current"], { tag: g.tag, server: g.server })}
          </h4>
          <ul>
            {g.raids.map((raid) => (
              <li key={raid.saturday} className="mt-2">
                <p className="text-body-sm font-medium">{words.day(raid.saturday)}</p>
                <Numbers
                  sides={[
                    { who: t["roll.prep.raid.us"], side: raid.us },
                    { who: g.tag, side: raid.them },
                  ]}
                  w={w}
                />
              </li>
            ))}
          </ul>
        </section>
      ))}
    </details>
  );
}
