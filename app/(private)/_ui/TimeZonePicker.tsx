"use client";

// The time-zone field (issue 297, D80): a button that opens a searchable list of every IANA zone, as a
// bottom sheet on phones. It finds a zone by city, by country in English, Portuguese or French, by
// PST, CET, BRT, UK … and by "ST +3" (server time + 3). Zones the alliance already uses come first, each
// row shows its time now, and "Their time now" lists the zones whose clock reads that time.
import { useMemo, useRef, useState } from "react";

import { Sheet } from "@/lib/brand/components/Sheet";
import {
  offsetLabel,
  offsetMinutes,
  searchZones,
  zonesAtLocalTime,
  type Zone,
} from "@/lib/private/time-zones";

import { say, type EditorWords } from "./facts-form";

const SHOWN = 50;

interface Props {
  value: string;
  onChange: (zone: string) => void;
  words: EditorWords;
  language: string;
  serverZone: string;
  /** Zones the alliance's members have, most used first. */
  used: readonly string[];
  /** The id of the field's label. */
  labelledBy: string;
}

export function TimeZonePicker(props: Props) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        aria-labelledby={props.labelledBy}
        aria-haspopup="dialog"
        onClick={() => setOpen(true)}
        className="flex min-h-11 w-full items-center justify-between gap-2 border border-rule bg-paper px-3 text-left"
      >
        <span className="min-w-0 truncate">
          {props.value ? props.value.replaceAll("_", " ") : "—"}
        </span>
        <span className="shrink-0 font-semibold text-plum">{props.words["tz.choose"]}</span>
      </button>
      {open && (
        <ZoneSheet
          {...props}
          onPick={(zone) => {
            props.onChange(zone);
            setOpen(false);
          }}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  );
}

function ZoneSheet(props: Props & { onPick: (zone: string) => void; onClose: () => void }) {
  const { words, language, serverZone, used } = props;
  const [query, setQuery] = useState("");
  const [theirTime, setTheirTime] = useState("");
  const now = useMemo(() => new Date(), []);
  const results = useMemo(() => {
    const o = { now, serverZone, used };
    if (!theirTime) return searchZones(query, o);
    const fit = new Set(searchZones(query, o).map((z) => z.id));
    return zonesAtLocalTime(theirTime, o).filter((z) => fit.has(z.id));
  }, [query, theirTime, now, serverZone, used]);
  const st = offsetLabel(offsetMinutes(serverZone, now));
  return (
    <Sheet labelledBy="tz-title" onCancel={props.onClose}>
      <h2 id="tz-title" className="font-subhead text-display-sm">
        {words["facts.timeZone"]}
      </h2>
      <input
        type="search"
        data-initial-focus
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder={words["tz.search"]}
        aria-label={words["tz.searchAria"]}
        className="mt-3 min-h-11 w-full border border-rule bg-paper px-3"
      />
      <p className="mt-1 text-body-sm text-ink/75">{say(words["tz.st"], { offset: st })}</p>
      <label className="mt-2 flex min-h-11 items-center justify-between gap-3">
        <span>{words["tz.theirTime"]}</span>
        <input
          type="time"
          value={theirTime}
          onChange={(e) => setTheirTime(e.target.value)}
          className="min-h-11 w-32 border border-rule bg-paper px-2"
        />
      </label>
      <ZoneList
        results={results}
        now={now}
        language={language}
        words={words}
        onPick={props.onPick}
      />
      <button
        type="button"
        onClick={props.onClose}
        className="mt-3 min-h-11 w-full border border-rule font-medium"
      >
        {words["facts.cancel"]}
      </button>
    </Sheet>
  );
}

function ZoneList(props: {
  results: Zone[];
  now: Date;
  language: string;
  words: EditorWords;
  onPick: (zone: string) => void;
}) {
  const { results, now, language, words } = props;
  const formats = useRef(new Map<string, Intl.DateTimeFormat>());
  const countries = useMemo(
    () => new Intl.DisplayNames([language], { type: "region" }),
    [language],
  );
  const clock = (zone: string) => {
    let f = formats.current.get(zone);
    if (!f) {
      f = new Intl.DateTimeFormat(language, {
        timeZone: zone,
        hour: "2-digit",
        minute: "2-digit",
        hourCycle: "h23",
      });
      formats.current.set(zone, f);
    }
    return f.format(now);
  };
  if (results.length === 0) return <p className="mt-3">{words["tz.none"]}</p>;
  return (
    <>
      {/* The list scrolls on its own so the search box above stays in view over ~420 zones. */}
      <ul className="mt-3 max-h-[45dvh] overflow-x-hidden overflow-y-auto overscroll-contain border-t border-rule">
        {results.slice(0, SHOWN).map((z) => (
          <li key={z.id} className="border-b border-rule">
            <button
              type="button"
              onClick={() => props.onPick(z.id)}
              className="flex min-h-11 w-full items-center justify-between gap-3 px-1 py-2 text-left"
            >
              <span className="min-w-0">
                <span className="block font-semibold">{z.city}</span>
                <span className="block text-body-sm text-ink/75">
                  {z.country ? countries.of(z.country) : z.id}
                </span>
              </span>
              <span className="shrink-0 text-right text-body-sm tabular-nums">
                <span className="block">{say(words["tz.now"], { time: clock(z.id) })}</span>
                <span className="block text-ink/75">{offsetLabel(offsetMinutes(z.id, now))}</span>
              </span>
            </button>
          </li>
        ))}
      </ul>
      {results.length > SHOWN && (
        <p className="mt-2 text-body-sm">{say(words["tz.more"], { n: results.length - SHOWN })}</p>
      )}
    </>
  );
}
