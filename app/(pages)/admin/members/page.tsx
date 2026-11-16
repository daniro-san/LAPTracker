// /admin/members: the officer view of might that has not moved (D70, issue 273). One alliance at a time
// (the site's own by default; another tracked id in `?alliance=` lists nobody, D76), two lists from its usable
// rosters: might unchanged for N days, and lost might. Names and figures from rosters only; neutral words.
import type { ReactNode } from "react";

import { AdminShell } from "@/app/_ui/admin/AdminShell";
import { AdminSection, Fact } from "@/app/_ui/admin/parts";
import { allianceLabel, compact, percentText, signOf, type Clock } from "@/app/_ui/format";
import { requestServerClock } from "@/app/_ui/locale";
import { ALLIANCES, OWN_ALLIANCE_ID } from "@/config/alliances";
import { isAdmin } from "@/lib/admin-session";
import { Chip } from "@/lib/brand/components/Chip";
import { copy, fill } from "@/lib/copy";
import { withPageDb } from "@/lib/page";
import {
  LOST_MIGHT_PCT,
  MIN_DAILY_READS,
  NEW_MEMBER_DAYS,
  mightUnchanged,
  type MightUnchanged,
} from "@/lib/queries";

const t = copy.admin.members;
const LOCALE = "en"; // The admin area is English (D48).

/** A signed compact number: `+1.20M`, `−350K`, `0`. */
const signed = (n: number) => `${signOf(n)}${compact(n, LOCALE)}`;

const killsText = (change: number | null) =>
  change === null ? t.killsUnknown : fill(t.kills, { change: signed(change) });

/** One member: name and uid, then might and the change on one muted line. */
function Row({ uid, name, parts }: { uid: number; name: string; parts: string[] }) {
  return (
    <li className="flex flex-col gap-1 border border-rule p-3 sm:border-0 sm:border-b sm:px-0 sm:last:border-0">
      <p className="min-w-0 break-words font-semibold">
        {name} <span className="text-body-sm font-normal tabular-nums text-ink/70">#{uid}</span>
      </p>
      <p className="text-body-sm tabular-nums text-ink/70">{parts.join(" · ")}</p>
    </li>
  );
}

/** Framed cards below 640 px, ruled rows above (the admin list rule). */
function List({ children, empty }: { children: ReactNode[]; empty: boolean }) {
  if (empty) return <p>{t.none}</p>;
  return <ul className="flex flex-col gap-3 sm:gap-0">{children}</ul>;
}

/** The alliance select (a plain GET form) and the period with its n. */
function Picker({ unionId }: { unionId: number }) {
  return (
    <form method="get" className="flex flex-wrap items-end gap-2">
      <label className="flex min-w-0 flex-1 flex-col gap-1 text-body-sm text-ink/70">
        {t.alliance}
        <select
          name="alliance"
          defaultValue={unionId}
          className="drawn-frame-soft min-h-11 w-full bg-paper px-3 text-base text-ink"
        >
          {ALLIANCES.map((a) => (
            <option key={a.unionId} value={a.unionId}>
              {allianceLabel(a.tag, a.name)}
            </option>
          ))}
        </select>
      </label>
      <button
        type="submit"
        className="drawn-frame-soft tint-button min-h-11 px-4 text-sm font-medium text-plum"
      >
        {t.show}
      </button>
    </form>
  );
}

/** The span of the newest reads and how many members and reads it rests on. */
function Period({
  period,
  n,
  clock,
}: {
  period: NonNullable<MightUnchanged["period"]>;
  n: number;
  clock: Clock;
}) {
  return (
    <div className="mt-4">
      <Fact
        label={t.periodLabel}
        value={fill(t.period, { from: clock.day(period.from), to: clock.day(period.to) })}
        note={fill(t.periodNote, {
          reads: period.daily + period.events,
          daily: period.daily,
          events: period.events,
          n,
        })}
      />
    </div>
  );
}

/** `[TAG] Name` as the newest read has it, else as the tracked list has it. */
function labelOf(view: MightUnchanged) {
  const tracked = ALLIANCES.find((a) => a.unionId === view.unionId);
  return allianceLabel(view.tag ?? tracked?.tag ?? null, view.name ?? tracked?.name ?? null);
}

function Lists({ view }: { view: MightUnchanged }) {
  return (
    <>
      <AdminSection
        id="unchanged"
        title={fill(t.unchangedTitle, { days: MIN_DAILY_READS })}
        help={fill(t.unchangedHelp, { new: NEW_MEMBER_DAYS })}
        aside={<Chip tone="muted">{fill(t.count, { n: view.unchanged.length })}</Chip>}
      >
        <List empty={view.unchanged.length === 0}>
          {view.unchanged.map((r) => (
            <Row
              key={r.uid}
              uid={r.uid}
              name={r.name}
              parts={[
                fill(t.might, { n: compact(r.might, LOCALE) }),
                fill(t.unchangedFor, { n: r.days }),
                killsText(r.killsChange),
              ]}
            />
          ))}
        </List>
      </AdminSection>
      <AdminSection
        id="lost"
        title={t.lostTitle}
        help={fill(t.lostHelp, { pct: LOST_MIGHT_PCT })}
        aside={<Chip tone="muted">{fill(t.count, { n: view.lost.length })}</Chip>}
      >
        <List empty={view.lost.length === 0}>
          {view.lost.map((r) => (
            <Row
              key={r.uid}
              uid={r.uid}
              name={r.name}
              parts={[
                fill(t.might, { n: compact(r.might, LOCALE) }),
                fill(t.lostBy, { change: signed(r.mightChange), pct: percentText(-r.pct, LOCALE) }),
                killsText(r.killsChange),
              ]}
            />
          ))}
        </List>
      </AdminSection>
    </>
  );
}

export default async function MembersPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  // Session first (issue 218): locked, the PIN card and no database read.
  if (!(await isAdmin())) return <AdminShell title={t.title} />;
  const sp = await searchParams;
  const known = ALLIANCES.find((a) => String(a.unionId) === sp.alliance);
  const unionId = known?.unionId ?? OWN_ALLIANCE_ID;
  if (unionId !== OWN_ALLIANCE_ID) {
    // Members are listed for the site's own alliance only (D76): no database read for another one.
    return (
      <AdminShell title={t.title}>
        <AdminSection
          id="scope"
          title={allianceLabel(known?.tag ?? null, known?.name ?? null)}
          help={t.ownOnly}
        >
          <Picker unionId={unionId} />
        </AdminSection>
      </AdminShell>
    );
  }
  const [view, clock] = await Promise.all([
    withPageDb((db) => mightUnchanged(db, unionId)),
    requestServerClock(),
  ]);
  const { period } = view;
  return (
    <AdminShell title={t.title}>
      <AdminSection
        id="scope"
        title={labelOf(view)}
        help={fill(t.help, { days: MIN_DAILY_READS })}
        aside={
          !view.ready && (
            <Chip tone="muted">
              {fill(t.notReady, { have: view.dailyReads, need: MIN_DAILY_READS })}
            </Chip>
          )
        }
      >
        <Picker unionId={unionId} />
        {period && <Period period={period} n={view.members} clock={clock} />}
      </AdminSection>
      {view.ready && <Lists view={view} />}
    </AdminShell>
  );
}
