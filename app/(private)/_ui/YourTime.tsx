"use client";

// "15:00 your time" beside a server time (issue 300). The viewer's zone is the browser's own, read only
// after hydration (the server renders nothing here), so server and browser HTML never differ.
import { useSyncExternalStore } from "react";

import { fill } from "@/lib/copy";
import { clockIn } from "@/lib/private/calendar-time";
import type { CalendarWords } from "@/lib/private/dictionary.calendar";

const subscribe = () => () => {};
const browserZone = () => Intl.DateTimeFormat().resolvedOptions().timeZone;

/** The browser's IANA zone; null while rendering on the server and during hydration. */
export function useViewerZone(): string | null {
  return useSyncExternalStore(subscribe, browserZone, () => null);
}

/** "15:00 your time", with "(+1 d)" when that is the next day on the viewer's clock. */
export function yourTime(at: number, day: string, zone: string, words: CalendarWords): string {
  const { time, shift } = clockIn(at, zone, day);
  const mark = shift > 0 ? words["calendar.nextDay"] : shift < 0 ? words["calendar.prevDay"] : "";
  return `${fill(words["calendar.yours"], { time })}${mark ? ` (${mark})` : ""}`;
}

export function YourTime({ at, day, words }: { at: number; day: string; words: CalendarWords }) {
  const zone = useViewerZone();
  return zone ? <span>{yourTime(at, day, zone, words)}</span> : null;
}
