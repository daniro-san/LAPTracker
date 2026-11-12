// The daily roster read's admin line (D60): posted by the tick only when the read falls short. Failed
// alliances are grouped by reason, so a whole-day outage stays a few lines, and the last line links to
// what can be done: Retry on /admin for a failed day, the daily reads list for a partial one.
import { copy, fill } from "./copy";
import type { DailyReadSummary } from "./daily-read";
import { guideFor } from "./error-guide";
import { allianceLabel, STATE_ICON, STATE_WORD } from "./notify";

export function dailyReadMessage(s: DailyReadSummary, at: string, origin: string): string {
  const t = copy.discord.admin;
  const lines = [
    fill(t.dailyRead, {
      icon: STATE_ICON[s.status],
      day: s.day,
      state: STATE_WORD[s.status],
      calls: s.callsUsed,
      at,
    }),
  ];
  if (s.error) lines.push(fill(t.error, { error: s.error }));
  // One line per reason, in the order the reasons first appear.
  for (const error of new Set(s.failed.map((f) => f.error))) {
    const group = s.failed.filter((f) => f.error === error);
    lines.push(
      fill(t.dailyFailed, { error, n: group.length, list: group.map(allianceLabel).join(", ") }),
      fill(t.dailyWhy, { ...guideFor(error) }),
    );
  }
  if (s.stale.length > 0)
    lines.push(fill(t.stale, { list: s.stale.map(allianceLabel).join(", ") }));
  lines.push(
    s.status === "failed"
      ? fill(t.dailyRetry, { url: `${origin}/admin` })
      : fill(t.dailyRuns, { url: `${origin}/admin/runs?show=daily` }),
  );
  return lines.join("\n");
}
