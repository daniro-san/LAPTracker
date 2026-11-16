// One member on the Members tab (issue 296): name, rank, Sanctuary, might, the week's donations and
// activity, and the status with what we saw (D75). Tapping the card opens the details: the donations per
// server day (exact numbers), and the other fields the game sends (D71). No data is "—", never 0.
import { fill } from "@/lib/copy";
import type { WorkspaceDictionary } from "@/lib/private/dictionary";
import type { MemberRow } from "@/lib/private/members";
import { reasonText, type Formats } from "@/lib/private/members-sheet";

const DAYS = ["day.mon", "day.tue", "day.wed", "day.thu", "day.fri", "day.sat", "day.sun"] as const;
const NONE = "—";

export interface CardFormats extends Formats {
  /** 61.2M, 61,2 mi, 61,2 M. */
  compact: (n: number) => string;
}

function Fact({ label, children }: { label: string; children: string }) {
  return (
    <div className="flex justify-between gap-3 border-t border-rule py-2 first:border-t-0">
      <dt className="text-ink/75">{label}</dt>
      <dd className="text-right tabular-nums">{children}</dd>
    </div>
  );
}

function Status({ m, t, f }: { m: MemberRow; t: WorkspaceDictionary; f: Formats }) {
  if (m.reasons.length === 0)
    return <span className="text-body-sm font-semibold text-sage">{t["status.fine"]}</span>;
  return (
    <span className="block text-body-sm">
      <span className="font-semibold text-yarn">{t["status.checkin"]}</span>
      {m.reasons.map((r) => (
        <span key={r.kind} className="block">
          {reasonText(r, t, f)}
        </span>
      ))}
    </span>
  );
}

function Days({
  m,
  week,
  t,
  f,
}: {
  m: MemberRow;
  week: string[];
  t: WorkspaceDictionary;
  f: Formats;
}) {
  return (
    <ol className="mt-2 grid grid-cols-7 gap-0.5 text-center text-[13px] tabular-nums">
      {m.donations.map((v, i) => {
        const day = `${t[DAYS[i] ?? "day.mon"]} ${Number(week[i]?.slice(8))}`;
        const text = typeof v === "number" ? f.number(v) : v === null ? NONE : "";
        const said =
          typeof v === "number"
            ? text
            : v === null
              ? t["members.don.none"]
              : t["members.don.later"];
        return (
          <li key={week[i]} aria-label={`${day}: ${said}`} className="border border-rule px-0 py-1">
            <span aria-hidden="true" className="block text-ink/70">
              {day}
            </span>
            <span aria-hidden="true" className={`block min-h-5 ${v === null ? "text-ink/60" : ""}`}>
              {text}
            </span>
          </li>
        );
      })}
    </ol>
  );
}

function meta(m: MemberRow, t: WorkspaceDictionary, f: CardFormats) {
  const n = (v: number | null, as: (x: number) => string) => (v === null ? NONE : as(v));
  return [
    { game: true, text: fill(t["members.meta.level"], { n: n(m.sanctuary, String) }) },
    { game: true, text: fill(t["members.meta.might"], { v: n(m.might, f.compact) }) },
    { game: false, text: fill(t["members.meta.don"], { v: n(m.weekTotal, f.compact) }) },
    { game: false, text: fill(t["members.meta.act"], { v: n(m.activity, f.number) }) },
  ];
}

function missingText(m: MemberRow, t: WorkspaceDictionary) {
  const words = m.missing.map((k) =>
    k === "donations" ? fill(t["nodata.donations"], { n: m.missingDays }) : t[`nodata.${k}`],
  );
  return fill(t["members.nodata"], { list: words.join(", ") });
}

export function MemberCard({
  m,
  week,
  t,
  f,
}: {
  m: MemberRow;
  week: string[];
  t: WorkspaceDictionary;
  f: CardFormats;
}) {
  const date = (at: Date | null) => (at ? f.date(at) : NONE);
  return (
    <details className="group border border-rule bg-paper">
      <summary className="flex min-h-11 cursor-pointer list-none flex-col gap-1 px-3 py-3 [&::-webkit-details-marker]:hidden">
        <span className="flex items-baseline gap-2">
          <span translate="no" className="min-w-0 flex-1 truncate font-semibold">
            {m.name}
          </span>
          {m.isNew && (
            <span className="border border-plum px-1.5 text-body-sm font-semibold text-plum">
              {t["members.new"]}
            </span>
          )}
          <span translate="no" className="shrink-0 text-body-sm text-ink/80">
            {m.rank ?? NONE}
          </span>
        </span>
        <span className="text-body-sm tabular-nums">
          {meta(m, t, f).map((p, i) => (
            <span key={i} {...(p.game && { translate: "no" as const })}>
              {i > 0 && " · "}
              {p.text}
            </span>
          ))}
        </span>
        {m.isNew && m.seenSince && (
          <span className="text-body-sm text-ink/75">
            {fill(t["members.firstSeen"], { date: f.date(m.seenSince) })}
          </span>
        )}
        <Status m={m} t={t} f={f} />
        {m.missing.length > 0 && (
          <span className="text-body-sm text-ink/70">{missingText(m, t)}</span>
        )}
        <span className="self-end text-body-sm font-semibold text-plum underline underline-offset-4">
          <span className="sr-only">{fill(t["members.detailsOf"], { name: m.name })}</span>
          <span aria-hidden="true">
            {t["members.details"]} <span className="inline-block group-open:rotate-180">▾</span>
          </span>
        </span>
      </summary>
      <div className="border-t border-rule px-3 py-3">
        <p className="text-body-sm font-semibold">
          {fill(t["members.don.head"], {
            total: m.weekTotal === null ? NONE : f.number(m.weekTotal),
          })}
        </p>
        <Days m={m} week={week} t={t} f={f} />
        <dl className="mt-3 text-body-sm">
          <Fact label={t["sheet.activity"]}>
            {m.activity === null ? NONE : f.number(m.activity)}
          </Fact>
          <Fact label={t["sheet.honor"]}>{m.honor === null ? NONE : f.number(m.honor)}</Fact>
          <Fact label={t["sheet.joined"]}>{date(m.joinedAt)}</Fact>
          <Fact label={t["sheet.seen"]}>{m.seenSince ? f.date(m.seenSince) : NONE}</Fact>
          <Fact label={t["sheet.lastOnline"]}>{date(m.lastOnlineAt)}</Fact>
          <Fact label={t["sheet.map"]}>
            {m.mapX === null || m.mapY === null
              ? NONE
              : fill(t["sheet.mapValue"], { x: m.mapX, y: m.mapY })}
          </Fact>
        </dl>
      </div>
    </details>
  );
}
