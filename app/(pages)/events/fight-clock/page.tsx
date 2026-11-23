// `/events/fight-clock`: the server fight clock (issue 284, D86). One row per scheduled public event, newest
// first; the columns are the event's 15-minute slots on the server clock, so noon is noon in every row; a
// slot's box is as high as its share of that event's kills. An event with no readings (every event before
// the first sampled one) is a disabled row with the reason in words: it appears in the sampled views as
// soon as it has samples, with no further change. A slot's link under a strip opens that slot's kills split
// by alliance in the strip's place (`?event=<id>&at=<minute>`, D158 rule 7 (b)).
import type { Metadata } from "next";
import Link from "next/link";

import { DrillPath } from "@/app/_ui/charts/DrillPath";
import { Readout, ReadoutLink } from "@/app/_ui/charts/Readout";
import { loadFightClock } from "@/app/_ui/event-page";
import { eventTitle, EventLabel } from "@/app/_ui/EventLabel";
import { allianceLabel, type Clock } from "@/app/_ui/format";
import { LIVE_DURING_ID } from "@/app/_ui/LiveProgress";
import { PulseLegend } from "@/app/_ui/LivePulse";
import { requestClock, requestCopy, requestLocale } from "@/app/_ui/locale";
import { sharedEventAllianceLabels } from "@/app/_ui/public-reads";
import { PulseSplit } from "@/app/_ui/PulseSplit";
import {
  busiestText,
  FIGHT_CLOCK_PATH,
  mostShare,
  PulseDetails,
  PulseStrip,
  stripsReadout,
  type Column,
} from "@/app/_ui/PulseStrip";
import { SiteFooter } from "@/app/_ui/SiteFooter";
import { SiteHeader } from "@/app/_ui/SiteHeader";
import { LABEL } from "@/app/_ui/StatTable";
import { type Dictionary } from "@/lib/copy";
import { getEnv } from "@/lib/env";
import { clockColumns, type ClockSlot, type OffReason } from "@/lib/fight-clock";
import { isOn } from "@/lib/flags";
import { homeEvent, type FightClockEvent } from "@/lib/queries";
import { fill } from "@/lib/words";

export async function generateMetadata(): Promise<Metadata> {
  const copy = await requestCopy();
  return { title: `${copy.ledger.fightClock} · ${copy.site.name}` };
}

function offText(off: OffReason, min: number, clock: Clock, copy: Dictionary): string {
  const l = copy.ledger;
  switch (off.kind) {
    case "since":
      return fill(l.fightClockOffSince, { min, date: clock.day(off.at) });
    case "next":
      return fill(l.fightClockOffNext, { min });
    case "missed":
      return fill(l.fightClockOffMissed, { min });
    case "waiting":
      return fill(l.fightClockOffWaiting, { min });
  }
}

function Heading({ event, clock }: { event: FightClockEvent; clock: Clock }) {
  const title = eventTitle(event);
  return (
    <span className="flex flex-wrap items-baseline gap-x-2">
      <span className="font-medium">
        <EventLabel event={event} clock={clock} />
      </span>
      {title && <span className="text-body-sm text-ink/70">{clock.weekday(event.eventAtUtc)}</span>}
    </span>
  );
}

interface View {
  everyMin: number;
  /** The `chart-details` flag (D91): off, no figures table under a row. */
  details: boolean;
  clock: Clock;
  copy: Dictionary;
  locale: string;
  /** The slot the address splits by alliance, with the alliances' names; null for none. */
  split: Split | null;
}

interface Split {
  event: number;
  slot: ClockSlot;
  labels: Map<number, string>;
}

const rowId = (id: number) => `clock-${id}`;
/** A column's slot on the grid, "12:00–12:15": the strips' and the readout's name for it. */
const spanOf = (at: Date, v: View) =>
  `${v.clock.hhmm(at)}–${v.clock.hhmm(new Date(at.getTime() + v.everyMin * 60_000))}`;

/** The slot `?event=&at=` names, when that event has it and it moved. */
function splitOf(events: FightClockEvent[], event: unknown, at: unknown) {
  if (typeof event !== "string" || typeof at !== "string" || !/^\d{1,9}$/.test(event)) return null;
  const e = events.find((x) => x.id === Number(event));
  const slot = e?.pulse.clock?.slots.find((s) => String(s.minute) === at);
  return e && slot?.state === "moved" ? { event: e.id, slot } : null;
}

/** A slot's kills by alliance in its strip's place, under the path back to every slot. */
function SlotSplit({ event, split, v }: { event: FightClockEvent; split: Split; v: View }) {
  // The split names the two readings it compares: the first slot's starts at the off-grid Start.
  const times = { from: v.clock.hhmm(split.slot.read.from), to: v.clock.hhmm(split.slot.read.to) };
  const span = `${times.from}–${times.to}`;
  const top = `${FIGHT_CLOCK_PATH}#${rowId(event.id)}`;
  const l = v.copy.ledger;
  return (
    <div className="px-1">
      <DrillPath
        name={l.drillPath}
        back={{ href: top, label: l.splitBack }}
        steps={[{ label: l.fightClock, href: top }, { label: span }]}
      />
      <PulseSplit
        parts={split.slot.parts}
        kills={split.slot.kills ?? 0}
        read={event.pulse.allianceIds}
        times={times}
        labels={split.labels}
        copy={v.copy}
        locale={v.locale}
      />
    </div>
  );
}

/** Under a strip: the chosen column's link to its slot split by alliance, where the slot moved. */
function SlotLinks({ event, columns, v }: { event: FightClockEvent; columns: Column[]; v: View }) {
  const slots = new Map((event.pulse.clock?.slots ?? []).map((s) => [s.minute, s]));
  const links = columns.flatMap((c, at) => {
    const s = slots.get(c.minute);
    return s?.state === "moved"
      ? [
          {
            at,
            href: `${FIGHT_CLOCK_PATH}?event=${event.id}&at=${c.minute}#${rowId(event.id)}`,
            label: fill(v.copy.ledger.splitLink, { span: spanOf(s.at, v) }),
            count: s.alliances,
          },
        ]
      : [];
  });
  return (
    <div className="px-1">
      <ReadoutLink links={links} surface="fight_clock" kind="alliances" />
    </div>
  );
}

/** An event with no readings: muted, not a link, the reason in one line. */
function OffRow({ event, v }: { event: FightClockEvent; v: View }) {
  return (
    <li className="rounded-sm border border-dashed border-rule px-3 py-2 text-ink/70">
      <Heading event={event} clock={v.clock} />
      <p className="text-body-sm">
        {event.off ? offText(event.off, v.everyMin, v.clock, v.copy) : null}
      </p>
    </li>
  );
}

/** A sampled event: the whole card links to its "During the event" section; the figures sit under Details
 * while the `chart-details` flag is on. */
function SampledRow({
  event,
  columns,
  most,
  v,
}: {
  event: FightClockEvent;
  columns: Column[];
  most: number;
  v: View;
}) {
  const { everyMin, details, clock, copy, locale } = v;
  const own = event.pulse.clock;
  if (!own) return null;
  const label = eventTitle(event) ?? clock.weekday(event.eventAtUtc);
  return (
    <li id={rowId(event.id)} className="scroll-mt-20 border-b border-rule pb-1">
      <Link
        href={`/events/${event.id}#${LIVE_DURING_ID}`}
        className="tint-button block min-h-11 px-1 py-1"
      >
        <Heading event={event} clock={clock} />
        <span className="mb-1 block text-body-sm text-ink/70">{copy.ledger.liveDuring} ›</span>
        <span className="mb-2 block text-body-sm tabular-nums">
          {busiestText(own, everyMin, clock, copy, locale)}
        </span>
      </Link>
      {/* Outside the link: a tap on a column picks it in the readout under the strips (D158 rule 7 (a)). */}
      {v.split?.event === event.id ? (
        <SlotSplit event={event} split={v.split} v={v} />
      ) : own.slots.length > 0 ? (
        <>
          <PulseStrip
            columns={columns}
            clock={own}
            most={most}
            everyMin={everyMin}
            zone={clock}
            copy={copy}
            locale={locale}
          />
          <SlotLinks event={event} columns={columns} v={v} />
        </>
      ) : (
        <p className="px-1 text-body-sm text-ink/70">{copy.ledger.liveNoReading}</p>
      )}
      {details && own.slots.length > 0 && (
        <PulseDetails
          columns={own.slots}
          events={[{ key: String(event.id), label, clock: own }]}
          clock={clock}
          everyMin={everyMin}
          copy={copy}
          locale={locale}
          lead={label}
        />
      )}
    </li>
  );
}

/** Every event's strip, with one readout for all of them at the chosen slot, kept in view (D158 rule 7 (a)). */
function Strips(props: { events: FightClockEvent[]; columns: Column[]; most: number; v: View }) {
  const { events, columns, most, v } = props;
  const list = (
    <ul className="grid gap-3">
      {events.map((e) =>
        e.pulse.clock ? (
          <SampledRow key={e.id} event={e} columns={columns} most={most} v={v} />
        ) : (
          <OffRow key={e.id} event={e} v={v} />
        ),
      )}
    </ul>
  );
  const sampled = events.flatMap((e) =>
    e.pulse.clock && e.pulse.clock.slots.length > 0
      ? [{ short: eventTitle(e) ?? v.clock.weekday(e.eventAtUtc), clock: e.pulse.clock }]
      : [],
  );
  if (sampled.length === 0 || columns.length === 0) return list;
  const l = v.copy.ledger;
  return (
    <Readout
      id="clock"
      {...stripsReadout(columns, sampled, v.everyMin, v.clock, v.copy, v.locale)}
      words={{ earlier: l.readoutEarlier, later: l.readoutLater }}
      sticky
    >
      {list}
    </Readout>
  );
}

export default async function FightClockPage({
  searchParams,
}: {
  searchParams: Promise<{ event?: string | string[]; at?: string | string[] }>;
}) {
  const [data, clock, copy, locale, details, query] = await Promise.all([
    loadFightClock(),
    requestClock(),
    requestCopy(),
    requestLocale(),
    isOn("chart-details"),
    searchParams,
  ]);
  const { listed, events, everyMin } = data;
  const l = copy.ledger;
  const clocks = events.flatMap((e) => (e.pulse.clock ? [e.pulse.clock] : []));
  const [columns, most] = [clockColumns(clocks), mostShare(clocks)];
  const picked = splitOf(events, query.event, query.at);
  const split = picked && {
    ...picked,
    // The event's alliances, shown and named as left out, from the shared public cache (D143).
    labels: new Map(
      (await sharedEventAllianceLabels(picked.event)).map((a) => [
        a.id,
        allianceLabel(a.tag, a.name),
      ]),
    ),
  };
  const v: View = { everyMin, details, clock, copy, locale, split };
  const sampled = new Set(events.filter((e) => e.pulse.sampled).map((e) => e.id));
  return (
    <>
      <SiteHeader
        events={listed.map((e) => ({ ...e, sampled: sampled.has(e.id) }))}
        currentId={null}
        homeId={homeEvent(listed, new Date(), getEnv().SNAPSHOT_WINDOW_MIN)?.id ?? null}
        clock={clock}
        copy={copy}
      />
      <main id="main" className="scroll-mt-20 mx-auto max-w-[960px] px-4 py-4 sm:px-6">
        <h1 className="mb-1 font-display text-display-lg leading-tight">{l.fightClock}</h1>
        <p className="mb-3 text-body-sm text-ink/70">{fill(l.fightClockLead, { min: everyMin })}</p>
        {clocks.length === 0 ? (
          <p className="mb-3 font-medium">{fill(l.fightClockNone, { min: everyMin })}</p>
        ) : (
          <div className="mb-3 text-body-sm text-ink/70">
            <p className={LABEL}>{clock.zone}</p>
            <p>{fill(l.fightClockOutline, { span: 2 * everyMin })}</p>
            <PulseLegend pulse={clocks.flatMap((c) => c.slots)} copy={copy} />
          </div>
        )}
        <Strips events={events} columns={columns} most={most} v={v} />
      </main>
      <SiteFooter copy={copy} />
    </>
  );
}
