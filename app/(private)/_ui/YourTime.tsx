"use client";

// "15:00 your time" beside a server time (issue 300), and which of the two comes first (issue 337: the
// "Server time / My time" switch in the officer's settings). The viewer's zone is the browser's own and the
// choice is this browser's (localStorage); both are read only after hydration (the server renders server
// time first and no local time), so server and browser HTML never differ.
import { useSyncExternalStore } from "react";

import { clockIn } from "@/lib/private/calendar-time";
import type { CalendarWords } from "@/lib/private/dictionary.calendar";
import { fill } from "@/lib/words";

const subscribe = () => () => {};
const browserZone = () => Intl.DateTimeFormat().resolvedOptions().timeZone;

/** The browser's IANA zone; null while rendering on the server and during hydration. */
export function useViewerZone(): string | null {
  return useSyncExternalStore(subscribe, browserZone, () => null);
}

/** The current minute (epoch minutes), after hydration only; it moves on by itself. */
export function useMinute(): number | null {
  return useSyncExternalStore(
    (tick) => {
      const id = setInterval(tick, 20_000);
      return () => clearInterval(id);
    },
    () => Math.floor(Date.now() / 60_000),
    () => null,
  );
}

export type ClockChoice = "server" | "mine";
const CLOCK_KEY = "ws.clock";
const clockListeners = new Set<() => void>();

function readClock(): ClockChoice {
  try {
    return localStorage.getItem(CLOCK_KEY) === "mine" ? "mine" : "server";
  } catch {
    return "server";
  }
}

function subscribeClock(listener: () => void) {
  clockListeners.add(listener);
  window.addEventListener("storage", listener);
  return () => {
    clockListeners.delete(listener);
    window.removeEventListener("storage", listener);
  };
}

/** Which time comes first on this browser: server time (the default) or the viewer's own. */
export function useClockChoice(): ClockChoice {
  return useSyncExternalStore(subscribeClock, readClock, () => "server");
}

export function setClockChoice(choice: ClockChoice) {
  try {
    localStorage.setItem(CLOCK_KEY, choice);
  } catch {
    // Private mode or blocked storage: the choice lasts until the page is left.
  }
  for (const listener of clockListeners) listener();
}

/** "15:00 your time", with "(the next day)" or "(the day before)" when the viewer's clock is on another day. */
export function yourTime(at: number, day: string, zone: string, words: CalendarWords): string {
  const { time, shift } = clockIn(at, zone, day);
  const mark = shift > 0 ? words["calendar.nextDay"] : shift < 0 ? words["calendar.prevDay"] : "";
  return `${fill(words["calendar.yours"], { time })}${mark ? ` (${mark})` : ""}`;
}

/** Two times in the chosen order: the first bold, the second muted after " · ". */
export function TimePair({ st, mine }: { st: string; mine: string | null }) {
  const choice = useClockChoice();
  const [first, second] = choice === "mine" && mine ? [mine, st] : [st, mine];
  return (
    <>
      <span className="font-bold tabular-nums">{first}</span>
      {second && <span className="text-ink/75">{` · ${second}`}</span>}
    </>
  );
}

/** "16:00 ST · 15:00 your time", or the other way round with "My time first". */
export function Times(props: { st: string; at: number; day: string; words: CalendarWords }) {
  const zone = useViewerZone();
  const mine = zone ? yourTime(props.at, props.day, zone, props.words) : null;
  return <TimePair st={props.st} mine={mine} />;
}
