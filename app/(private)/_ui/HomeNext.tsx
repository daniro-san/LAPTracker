"use client";

// Home's "Today and tomorrow" (panel PD-1): the Calendar's entries that start today and tomorrow on the
// officer's own clock, each with its server time and "your time", linking to that day in the Calendar.
// The server renders them by server time; after hydration the browser's zone and minute take over
// (YourTime.tsx), so server and browser HTML never differ. An entry whose time has come carries "Started",
// then "Ended", at full contrast (issue 585; it was faded before). Once over, an entry is one muted line,
// "12:00 ST · KvK · Ended", still the link to its day (issue 585 slice 4): its time on the officer's clock
// no longer helps.
import type { CalendarWords } from "@/lib/private/dictionary.calendar";

import { Ended } from "./Ended";
import { todayAndTomorrow, type NextItem } from "./home-digest";
import { Times, useMinute, useViewerZone } from "./YourTime";

export function HomeNext(props: {
  items: NextItem[];
  serverZone: string;
  /** When the server rendered the page (epoch ms): the clock until the browser's takes over. */
  renderedAt: number;
  words: CalendarWords;
  heads: { today: string; tomorrow: string; none: string };
}) {
  const zone = useViewerZone() ?? props.serverZone;
  const minute = useMinute();
  const now = minute === null ? props.renderedAt : minute * 60_000;
  const days = todayAndTomorrow(props.items, zone, now);
  const tag = { started: props.words["calendar.started"], ended: props.words["calendar.ended"] };
  if (days.today.length === 0 && days.tomorrow.length === 0)
    return <p className="mt-2 text-body-sm text-ink/75">{props.heads.none}</p>;
  return (
    <>
      {(["today", "tomorrow"] as const).map(
        (d) =>
          days[d].length > 0 && (
            <div key={d} className="mt-2">
              <h3 className="text-body-sm font-semibold text-ink/75">{props.heads[d]}</h3>
              <ul>
                {days[d].map((x) =>
                  now >= x.end ? (
                    <li key={x.key}>
                      <a
                        href={x.href}
                        className="flex min-h-11 items-center border-t border-rule py-2 text-body-sm text-ink/75"
                      >
                        <span>
                          <span className="tabular-nums">{x.st}</span>
                          {` · ${x.title} · ${tag.ended}`}
                        </span>
                      </a>
                    </li>
                  ) : (
                    <li key={x.key}>
                      <a
                        href={x.href}
                        className="flex min-h-11 flex-col justify-center border-t border-rule py-2"
                      >
                        <span className="text-body-sm">
                          <Times st={x.st} at={x.at} day={x.day} words={props.words} />
                        </span>
                        <span>
                          <Ended at={x.at} end={x.end} words={tag} since={props.renderedAt} bold>
                            {x.title}
                          </Ended>
                        </span>
                      </a>
                    </li>
                  ),
                )}
              </ul>
            </div>
          ),
      )}
    </>
  );
}
