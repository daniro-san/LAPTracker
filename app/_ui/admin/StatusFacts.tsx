// /admin's "Needs you" section and the two Status facts that carry a verdict (issue 585, F11, F34): the API
// reading (OK, Low, above the site's plan, or no verdict for an earlier UTC day) and the scheduler's last tick
// ("Late" by the watcher's rule, D45/D141). English only (D48).
import type { ReactNode } from "react";

import type { Clock } from "@/app/_ui/format";
import { Chip } from "@/lib/brand/components/Chip";
import { PageIndex } from "@/lib/brand/components/layout/PageIndex";
import { DroppedStitch, StitchedCheck } from "@/lib/brand/components/StatusIcons";
import { DAILY_QUOTA } from "@/lib/budget";
import { copy, fill } from "@/lib/copy";
import type { recentTicks } from "@/lib/queries/admin";
import { QUOTA_WARN_BELOW } from "@/lib/run";

import { quotaState, tickLate, type NeedRow, type QuotaState } from "./needs-you";
import { AdminSection, Fact } from "./parts";

const st = copy.admin.status;

type Tick = Awaited<ReturnType<typeof recentTicks>>[number];

/** "Needs you" (issue 585, F11): the rows that wait on the owner, or one line that none does. */
export function NeedsYou({ rows }: { rows: NeedRow[] }) {
  const t = copy.admin.needs;
  return (
    <AdminSection id="needs-you" title={t.title}>
      {rows.length === 0 ? <p>{t.none}</p> : <PageIndex items={rows} attentionWord={t.attention} />}
    </AdminSection>
  );
}

/** Each reading's chip: muted with no verdict (an earlier UTC day) or above the plan, seal when low. */
const QUOTA_CHIP: Record<Exclude<QuotaState, "unknown">, () => ReactNode> = {
  old: () => <Chip tone="muted">{st.quotaOld}</Chip>,
  above: () => <Chip tone="muted">{st.quotaAbove}</Chip>,
  low: () => (
    <Chip tone="seal" icon={<DroppedStitch />}>
      {fill(st.quotaLow, { n: QUOTA_WARN_BELOW })}
    </Chip>
  ),
  ok: () => (
    <Chip tone="ink" icon={<StitchedCheck />}>
      {st.quotaOk}
    </Chip>
  ),
};

/**
 * Quota: OK at 900 to 1,000, Low under 900 (plan §3.1, the Friday warning), above the site's daily plan over
 * 1,000 (F34: no "OK", no alarm either), Unknown before any run, no verdict for an earlier UTC day.
 */
export function QuotaFact({
  quota,
  now,
  clock,
}: {
  quota: { remaining: number | null; at: Date } | null;
  now: Date;
  clock: Clock;
}) {
  const state = quotaState(quota, now);
  if (!quota || quota.remaining === null || state === "unknown") {
    return (
      <Fact
        label={st.quota}
        value={<Chip tone="muted">{st.quotaUnknown}</Chip>}
        note={st.quotaNone}
      />
    );
  }
  // The quota resets every UTC day: an older reading says when it is from and carries no verdict.
  const note = state === "old" ? st.quotaNoteOld : st.quotaNote;
  return (
    <Fact
      label={st.quota}
      value={fill(quota.remaining > DAILY_QUOTA ? st.quotaLeft : st.quotaValue, {
        n: quota.remaining.toLocaleString("en"),
      })}
      chip={QUOTA_CHIP[state]()}
      note={fill(note, { at: clock.stamp(quota.at) })}
    />
  );
}

/**
 * The scheduler's heartbeat (D45): the newest tick in server time, "Late" by the watcher's rule (D141, F34),
 * and what the last few did.
 */
export function TickFact({ ticks, now, clock }: { ticks: Tick[]; now: Date; clock: Clock }) {
  const outcome = (o: string | null) =>
    st.tickOutcome[(o ?? "none") as keyof typeof st.tickOutcome] ?? o;
  return (
    <Fact
      label={st.tick}
      value={ticks[0] ? clock.stamp(ticks[0].startedAt) : st.noTick}
      chip={
        tickLate(ticks[0]?.startedAt ?? null, now) && (
          <Chip tone="seal" icon={<DroppedStitch />}>
            {st.tickLate}
          </Chip>
        )
      }
      note={
        ticks.length > 0 &&
        fill(st.tickNote, { list: ticks.map((k) => outcome(k.outcome)).join(" · ") })
      }
    />
  );
}
