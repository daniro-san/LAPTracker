// The event page's KvK matchup (D152, issue 306): our top n alliances and the opponent's at the Start, side by
// side, and from Start to End over the members in both readings. Alliance-level figures only, the same neutral
// colours for both sides, no chart (D68). Cards stack below 640 px.
import { SERVER } from "@/config/alliances";
import { fill, type Dictionary } from "@/lib/copy";
import type { Side, SideAlliance } from "@/lib/kvk";
import type { EventMatchup } from "@/lib/queries/kvk";

import { allianceLabel, compact, signOf, type Clock } from "./format";
import { requestClock, requestCopy, requestLocale } from "./locale";

type Words = Dictionary["kvk"];

const signed = (n: number, locale: string) => `${signOf(n)}${compact(Math.abs(n), locale)}`;

function Figure({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3 py-0.5">
      <dt className="text-ink/80">{label}</dt>
      <dd className="font-semibold tabular-nums">{value}</dd>
    </div>
  );
}

/** One side at the Start: its four figures. */
function StartCard(props: {
  server: number;
  side: Side;
  note: string | null;
  clock: Clock;
  locale: string;
  k: Words;
}) {
  const { side, k, locale } = props;
  return (
    <div
      className="drawn-card px-3 py-2"
      role="group"
      aria-label={fill(k.side, { server: props.server })}
    >
      <h3 className="font-semibold">{fill(k.side, { server: props.server })}</h3>
      <p className="text-body-sm text-ink/70">
        {fill(k.readAt, { time: props.clock.time(side.readAt) })}
        {props.note && ` · ${props.note}`}
      </p>
      <dl className="mt-1 text-body-sm">
        <Figure label={k.might} value={compact(side.might, locale)} />
        <Figure label={k.kills} value={compact(side.kills, locale)} />
        <Figure
          label={k.killsPer1B}
          value={side.killsPer1B === null ? "—" : compact(side.killsPer1B, locale)}
        />
        <Figure
          label={k.heavy}
          value={fill(k.heavyValue, { h: side.heavy, m: compact(side.members, locale) })}
        />
      </dl>
    </div>
  );
}

/** One side from Start to End: how many alliances it counts, over how many members, and the two sums. */
function ChangeCard(props: { server: number; side: Side; n: number; locale: string; k: Words }) {
  const { side, k, locale } = props;
  const change = side.change;
  if (!change) return null;
  return (
    <div
      className="drawn-card px-3 py-2"
      role="group"
      aria-label={`${fill(k.side, { server: props.server })} · ${k.change}`}
    >
      <h3 className="font-semibold">{fill(k.side, { server: props.server })}</h3>
      <p className="text-body-sm text-ink/70">
        {fill(k.counted, { c: change.counted, n: props.n })} ·{" "}
        {fill(k.overMembers, { m: compact(change.members, locale) })}
      </p>
      {change.counted > 0 && (
        <dl className="mt-1 text-body-sm">
          <Figure label={k.mightChange} value={signed(change.might, locale)} />
          <Figure label={k.killsGained} value={`+${compact(change.kills, locale)}`} />
        </dl>
      )}
    </div>
  );
}

/** One side's alliances, ranked by might at the Start, with their Start to End once the End has run. */
function AllianceList(props: {
  server: number;
  alliances: SideAlliance[];
  ended: boolean;
  locale: string;
  k: Words;
}) {
  const { k, locale } = props;
  return (
    <div>
      <h4 className="font-semibold">{fill(k.side, { server: props.server })}</h4>
      <ol className="mt-1 grid gap-1.5">
        {props.alliances.map((a, i) => (
          <li key={a.unionId} className="text-body-sm">
            <span className="flex gap-2">
              <span className="w-6 shrink-0 tabular-nums text-ink/70">#{i + 1}</span>
              <bdi className="min-w-0 flex-1 truncate">{allianceLabel(a.tag, a.name)}</bdi>
            </span>
            <span className="block pl-8 tabular-nums text-ink/80">
              {k.might} {compact(a.might, locale)} · {k.kills} {compact(a.kills, locale)}
            </span>
            {props.ended && (
              <span className="block pl-8 tabular-nums text-ink/80">
                {a.change
                  ? fill(k.changeLine, {
                      might: signed(a.change.might, locale),
                      kills: `+${compact(a.change.kills, locale)}`,
                    })
                  : k.noChange}
              </span>
            )}
          </li>
        ))}
      </ol>
    </div>
  );
}

/** The section, in the request's language and on its clock. */
export async function Matchup(props: {
  data: EventMatchup;
  /** When the End is due, for the line shown before it runs. */
  endAt: Date;
}) {
  const [clock, copy, locale] = await Promise.all([requestClock(), requestCopy(), requestLocale()]);
  const { data } = props;
  const k = copy.kvk;
  const { n, us, them } = data.matchup;
  const failed = data.tags - data.read;
  const coverage = fill(k.tagsRead, { read: data.read, k: data.tags });
  const sides = [
    { server: SERVER, side: us, note: null },
    { server: data.server, side: them, note: coverage },
  ];
  return (
    <section aria-labelledby="matchup-h" className="mt-8">
      <h2 id="matchup-h" className="font-subhead text-display-md">
        {k.title}
      </h2>
      <p className="text-body-sm text-ink/70">
        {fill(k.versus, { us: SERVER, them: data.server, n })}
        {failed > 0 && ` · ${coverage}`}
      </p>
      <div className="mt-2 grid max-w-3xl gap-3 sm:grid-cols-2">
        {sides.map((s) => (
          <StartCard key={s.server} {...s} clock={clock} locale={locale} k={k} />
        ))}
      </div>
      <p className="mt-2 text-body-sm text-ink/70">{k.help}</p>
      <h3 className="mt-4 font-subhead text-display-sm">{k.change}</h3>
      {data.ended ? (
        <>
          <div className="mt-2 grid max-w-3xl gap-3 sm:grid-cols-2">
            {sides.map((s) => (
              <ChangeCard
                key={s.server}
                server={s.server}
                side={s.side}
                n={n}
                locale={locale}
                k={k}
              />
            ))}
          </div>
          <p className="mt-2 text-body-sm text-ink/70">{k.changeHelp}</p>
        </>
      ) : (
        <p className="text-body-sm text-ink/70">
          {fill(k.changeLater, { time: clock.time(props.endAt) })}
        </p>
      )}
      <details className="group/more mt-3 border-t border-rule">
        <summary className="details-bar flex min-h-11 cursor-pointer items-center gap-2 font-medium [&::-webkit-details-marker]:hidden">
          <span className="drawn-frame-soft tint-button inline-flex min-h-11 items-center gap-1 px-3 text-plum group-open/more:bg-plum/10">
            {k.byAlliance}
            <span
              aria-hidden="true"
              className="transition-transform duration-150 group-open/more:rotate-180 motion-reduce:transition-none"
            >
              ▾
            </span>
          </span>
        </summary>
        <div className="mt-2 grid gap-4 sm:grid-cols-2">
          {sides.map((s) => (
            <AllianceList
              key={s.server}
              server={s.server}
              alliances={s.side.alliances}
              ended={data.ended}
              locale={locale}
              k={k}
            />
          ))}
        </div>
      </details>
    </section>
  );
}
