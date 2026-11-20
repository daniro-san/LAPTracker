// /admin's Tracked alliances card (D133, issue 459): the newest tracked set (the ranks board's top 20, read
// before each daily update), the days of the last week whose set changed, with who came in and who went out,
// and today's "Get today's details" lookups against the day's cap. Read after the page's own isAdmin() check.
// English only (D48).
import { LOOKUPS_PER_DAY, TRACKED_COUNT } from "@/config/alliances";
import { copy, fill } from "@/lib/copy";
import { getEnv } from "@/lib/env";
import { withPageDb } from "@/lib/page";
import { adminTracked } from "@/lib/queries/alliance-list";

import type { Clock } from "../format";
import { AdminSection } from "./parts";
import { choiceLabel } from "./Workspaces";

const t = copy.admin.tracked;
const DAYS = 7;

export async function TrackedCard({ now, clock }: { now: Date; clock: Clock }) {
  const { days, lookups, labels } = await withPageDb((db) => adminTracked(db, DAYS, now, getEnv()));
  const name = (unionId: number) => {
    const l = labels.get(unionId);
    return l ? choiceLabel({ unionId, ...l }) : String(unionId);
  };
  const [newest] = days;
  const changed = days.filter((d) => d.entered.length > 0 || d.left.length > 0);
  const calls = lookups.reduce((n, l) => n + l.callsUsed, 0);
  return (
    <AdminSection id="tracked" title={t.title} help={fill(t.help, { n: TRACKED_COUNT })}>
      <div className="space-y-4 px-4 py-4 text-body-sm sm:px-6">
        {newest ? (
          <div>
            <p className="font-semibold">
              {fill(t.set, {
                day: newest.day,
                source: t.source[newest.source],
                n: newest.allianceIds.length,
              })}
            </p>
            <p className="mt-1 text-ink/80">{newest.allianceIds.map(name).join(" · ")}</p>
          </div>
        ) : (
          <p>{t.none}</p>
        )}
        <div>
          <h3 className="font-semibold">{t.changes}</h3>
          {changed.length === 0 ? (
            <p className="text-ink/80">{fill(t.noChange, { n: DAYS })}</p>
          ) : (
            <ul className="list-disc pl-5">
              {changed.map((d) => (
                <li key={d.day}>
                  {fill(t.change, {
                    day: d.day,
                    list: [
                      d.entered.length > 0 && fill(t.in, { list: d.entered.map(name).join(", ") }),
                      d.left.length > 0 && fill(t.out, { list: d.left.map(name).join(", ") }),
                    ]
                      .filter(Boolean)
                      .join(" · "),
                  })}
                </li>
              ))}
            </ul>
          )}
        </div>
        <div>
          <h3 className="font-semibold">{t.lookups}</h3>
          <p className="tabular-nums">
            {fill(t.lookupsCount, { n: lookups.length, max: LOOKUPS_PER_DAY, calls })}
          </p>
          {lookups.length === 0 ? (
            <p className="text-ink/80">{t.noLookup}</p>
          ) : (
            <ul className="list-disc pl-5">
              {lookups.map((l) => (
                <li key={l.unionId}>
                  {fill(t.lookup, {
                    alliance: name(l.unionId),
                    time: clock.hhmm(l.claimedAt),
                    state:
                      l.status === "failed"
                        ? fill(t.state.failed, { error: l.error ?? "stopped" })
                        : t.state[l.status],
                  })}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </AdminSection>
  );
}
