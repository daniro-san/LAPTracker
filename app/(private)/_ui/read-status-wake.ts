// When the read status bar (D135) must look at the clock again: at the soonest `until` still ahead, so a
// finished read's line goes 30 minutes after it ended. Null once no line is left to go: no timer at all, so
// an expired line never keeps a zero-delay timer redrawing the bar (review of PR 515).
import type { StatusLine } from "@/lib/private/read-status";

/** Milliseconds to wait from `now`, 0 before the first look (`now` 0, while mounting), or null. */
export function nextWake(lines: readonly StatusLine[], now: number): number | null {
  if (now === 0) return 0;
  const ahead = lines.flatMap((l) => (l.until !== undefined && l.until > now ? [l.until] : []));
  return ahead.length > 0 ? Math.min(...ahead) - now : null;
}
