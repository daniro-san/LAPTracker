// The Home digest's calendar part (panel PD-1), pure and browser-safe: which entries start today and
// tomorrow on a given clock. The server sends the server days from yesterday to the day after tomorrow
// (`digestDays`), so every viewer's today and tomorrow are inside them.
import { addDays, dayIn } from "@/lib/private/calendar-time";

export interface NextItem {
  key: string;
  title: string;
  /** "16:00 ST". */
  st: string;
  /** The instant it starts. */
  at: number;
  /** Its server day, for "your time" and the Calendar's anchor. */
  day: string;
  /** The Calendar's week with this day open. */
  href: string;
}

/** The server days the Home reads: from yesterday to the day after tomorrow. */
export const digestDays = (serverToday: string) => ({
  from: addDays(serverToday, -1),
  to: addDays(serverToday, 2),
});

/** The entries that start today and tomorrow on the clock of `zone`, each day in time order. */
export function todayAndTomorrow(items: NextItem[], zone: string, now: number) {
  const today = dayIn(zone, now);
  const on = (day: string) =>
    items.filter((x) => dayIn(zone, x.at) === day).sort((a, b) => a.at - b.at);
  return { today: on(today), tomorrow: on(addDays(today, 1)) };
}
