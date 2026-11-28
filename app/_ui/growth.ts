// The growth card's ranges and change lines (issue 822), shared by the alliance page and the player page
// (issue 824). Daily reads only: no 1d range, as the site reads once a day.
import { addDays, daysBetween } from "@/lib/calendar-time";
import type { Dictionary } from "@/lib/copy";
import { fill } from "@/lib/words";

import { signOf } from "./format";

export const GROWTH_RANGES = [7, 30, 90] as const;
export type GrowthRange = (typeof GROWTH_RANGES)[number];
export const DEFAULT_RANGE: GrowthRange = 30;

/** `?range=7d` → 7; anything else is the default. */
export const rangeOf = (value: unknown): GrowthRange =>
  GROWTH_RANGES.find((r) => value === `${r}d`) ?? DEFAULT_RANGE;

/** The points of the `days` days up to the newest one, both ends included; oldest first in, oldest first out. */
export function inRange<T extends { day: string }>(points: T[], days: number): T[] {
  const last = points.at(-1);
  if (!last) return [];
  const from = addDays(last.day, -days);
  return points.filter((p) => p.day >= from);
}

/** `+258.8M over 7 days`: the range's last value less its first, over the days between them. Null with fewer
 * than two points, so an unknown change is left out. */
export function changeLine(
  points: { day: string; value: number }[],
  format: (n: number) => string,
  copy: Dictionary,
): string | null {
  const first = points[0];
  const last = points.at(-1);
  if (!first || !last || first === last) return null;
  const change = last.value - first.value;
  const n = daysBetween(first.day, last.day);
  const words = copy.alliancePage;
  if (change === 0) return fill(n === 1 ? words.sameOne : words.same, { n });
  const text = `${signOf(change)}${format(Math.abs(change))}`;
  return fill(n === 1 ? words.overOne : words.over, { change: text, n });
}
