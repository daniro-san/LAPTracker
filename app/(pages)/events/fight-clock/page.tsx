// `/events/fight-clock`: the server fight clock (issue 284, D86). One row per scheduled public event, newest
// first; the columns are the event's 15-minute slots on the server clock, so noon is noon in every row; a
// slot's box is as high as its share of that event's kills. An event with no readings (every event before
// the first sampled one) is a disabled row with the reason in words: it appears in the sampled views as
// soon as it has samples, with no further change.
import type { Metadata } from "next";
import Link from "next/link";

import { loadFightClock } from "@/app/_ui/event-page";
import { eventTitle, EventLabel } from "@/app/_ui/EventLabel";
import type { Clock } from "@/app/_ui/format";
import { LIVE_DURING_ID } from "@/app/_ui/LiveProgress";
import { PulseLegend } from "@/app/_ui/LivePulse";
import { requestClock, requestCopy, requestLocale } from "@/app/_ui/locale";
import {
  busiestText,
  mostShare,
  PulseDetails,
  PulseStrip,
  type Column,
} from "@/app/_ui/PulseStrip";
import { SiteFooter } from "@/app/_ui/SiteFooter";
import { SiteHeader } from "@/app/_ui/SiteHeader";
import { LABEL } from "@/app/_ui/StatTable";
import { fill, type Dictionary } from "@/lib/copy";
import { getEnv } from "@/lib/env";
import { clockColumns, type OffReason } from "@/lib/fight-clock";
import { isOn } from "@/lib/flags";
import { homeEvent, type FightClockEvent } from "@/lib/queries";

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
    <li className="border-b border-rule pb-1">
      <Link
        href={`/events/${event.id}#${LIVE_DURING_ID}`}
        className="tint-button block min-h-11 px-1 py-1"
      >
        <Heading event={event} clock={clock} />
        <span className="mb-1 block text-body-sm text-ink/70">{copy.ledger.liveDuring} ›</span>
        <span className="mb-2 block text-body-sm tabular-nums">
          {busiestText(own, everyMin, clock, copy, locale)}
        </span>
        {own.slots.length > 0 ? (
          <PulseStrip
            columns={columns}
            clock={own}
            most={most}
            everyMin={everyMin}
            zone={clock}
            copy={copy}
            locale={locale}
          />
        ) : (
          <span className="text-body-sm text-ink/70">{copy.ledger.liveNoReading}</span>
        )}
      </Link>
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

export default async function FightClockPage() {
  const [data, clock, copy, locale, details] = await Promise.all([
    loadFightClock(),
    requestClock(),
    requestCopy(),
    requestLocale(),
    isOn("chart-details"),
  ]);
  const { listed, events, everyMin } = data;
  const l = copy.ledger;
  const clocks = events.flatMap((e) => (e.pulse.clock ? [e.pulse.clock] : []));
  const [columns, most] = [clockColumns(clocks), mostShare(clocks)];
  const v: View = { everyMin, details, clock, copy, locale };
  return (
    <>
      <SiteHeader
        events={listed}
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
        <ul className="grid gap-3">
          {events.map((e) =>
            e.pulse.clock ? (
              <SampledRow key={e.id} event={e} columns={columns} most={most} v={v} />
            ) : (
              <OffRow key={e.id} event={e} v={v} />
            ),
          )}
        </ul>
      </main>
      <SiteFooter copy={copy} />
    </>
  );
}
