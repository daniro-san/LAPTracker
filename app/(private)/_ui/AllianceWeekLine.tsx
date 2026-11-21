// The alliance's week in one line (issue 466, D76), on Home's members note after the thanks and under the
// Members week line: "Alliance Help: 62 of 100 reached 1,000 yesterday · daily quest points yesterday,
// median 540 · donations this week 1.2M", then the days with no read, not in the total (D75). Alliance-level numbers from the reads `membersView`
// already holds: no query, no name, no ranking. Nothing before the first end-of-day read.
import { fill } from "@/lib/copy";
import { allianceWeek } from "@/lib/private/alliance-week";
import type { WorkspaceDictionary } from "@/lib/private/dictionary";
import type { CardFormats } from "@/lib/private/member-card";
import { COINS_MAX } from "@/lib/private/member-days";
import { DAY_MS, gameWeek, isoDay } from "@/lib/private/member-week";
import type { MembersView } from "@/lib/private/members";

const back = (day: string, days: number) => isoDay(Date.parse(`${day}T00:00:00Z`) - days * DAY_MS);

/** The line's parts in `f`'s language, as of `today` (server day); none before the first end-of-day read. */
export function allianceWeekParts(
  view: MembersView,
  t: WorkspaceDictionary,
  f: CardFormats,
  today: string,
): string[] {
  const w = view.early ? null : allianceWeek(view.reads, today);
  if (!w) return [];
  const when =
    w.day === today
      ? t["week.today"]
      : w.day === back(today, 1)
        ? t["week.yesterday"]
        : fill(t["week.on"], { date: f.date(w.day) });
  const monday = gameWeek(today)[0] as string;
  const week =
    w.monday === monday
      ? t["week.this"]
      : w.monday === back(monday, 7)
        ? t["week.last"]
        : fill(t["week.of"], { date: f.date(w.monday) });
  const weekday = new Intl.DateTimeFormat(f.language, { weekday: "short", timeZone: "UTC" });
  // "Tue, Wed, Thu", as Insights lists them.
  const days = new Intl.ListFormat(f.language, { style: "short", type: "unit" }).format(
    w.noRead.map((d) => weekday.format(new Date(`${d}T00:00:00Z`))),
  );
  return [
    ...(w.coins
      ? [
          fill(t["week.coins"], {
            n: f.number(w.coins.n),
            of: f.number(w.coins.of),
            cap: f.number(COINS_MAX),
            when,
          }),
        ]
      : []),
    w.quests
      ? fill(t["week.quests"], { when, v: f.number(w.quests.value) })
      : fill(t["week.questsNone"], { when }),
    w.donations === null
      ? fill(t["week.donationsNone"], { week })
      : fill(t["week.donations"], { week, v: f.compact(w.donations) }),
    ...(w.noRead.length > 0 ? [fill(t["week.noRead"], { days })] : []),
  ];
}

export function AllianceWeekLine({ parts, className }: { parts: string[]; className: string }) {
  return parts.length === 0 ? null : (
    // A no-break space before each " · ", so a line never starts with one (D122).
    <p className={`text-body-sm ${className}`}>{parts.join(" · ")}</p>
  );
}
