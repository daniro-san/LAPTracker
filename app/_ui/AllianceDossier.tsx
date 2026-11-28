// The public alliance page's own parts (issue 822): its head's facts, the tabs and the member list with the
// public per-member figures (D76 amendment 2026-11-28) as neutral chips, sorted by rank then might. A figure
// the read does not have is left out.
import Link from "next/link";

import { RoleMark } from "@/lib/brand/components/RoleMark";
import { TextLink } from "@/lib/brand/components/TextLink";
import type { Dictionary } from "@/lib/copy";
import type { AlliancePage, AlliancePageMember } from "@/lib/queries";
import type { BoardAlliance } from "@/lib/queries/alliance-list";
import { fill } from "@/lib/words";

import { CopyRoster } from "./CopyRoster";
import type { DossierFact } from "./DossierHead";
import { compact, dayDate, type Clock } from "./format";
import { cell } from "./member-history";
import { Num } from "./Num";

const MUTED = "text-ink/70";
const TAB = "inline-flex min-h-11 items-center px-3 font-medium";

type Board = (BoardAlliance & { day: string }) | null;

/** The R5, linked to their page, with their might under the name. */
function leaderFact(leader: AlliancePage["leader"], locale: string, copy: Dictionary): DossierFact {
  if (!leader) return { key: "leader", label: copy.leadership.leader, value: null };
  return {
    key: "leader",
    label: copy.leadership.leader,
    value: (
      <TextLink href={`/players/${leader.uid}`} className="inline-flex min-h-11 items-center">
        <bdi>{leader.name}</bdi>
      </TextLink>
    ),
    note: leader.power === null ? null : `${copy.ledger.might} ${compact(leader.power, locale)}`,
  };
}

/** `97/100`, or the members alone when the capacity is unknown. */
const membersText = (page: AlliancePage | null) => {
  if (page?.members == null) return null;
  return page.capacity === null ? page.members : `${page.members}/${page.capacity}`;
};

/** `#2` with the board's date under it. */
function rankFact(board: Board, clock: Clock, copy: Dictionary): DossierFact {
  const label = copy.alliancePage.serverRank;
  if (board?.powerRank == null) return { key: "rank", label, value: null };
  const note = fill(copy.alliances.asOf, { date: clock.day(dayDate(board.day)) });
  return { key: "rank", label, value: `#${board.powerRank}`, note };
}

/** The head's facts: server, leader, might, members of capacity and server rank; unknown ones are null. */
export function allianceFacts(
  page: AlliancePage | null,
  board: Board,
  clock: Clock,
  locale: string,
  copy: Dictionary,
): DossierFact[] {
  const might = page?.might ?? board?.power ?? null;
  return [
    { key: "server", label: copy.alliancePage.server, value: page?.server ?? null },
    leaderFact(page?.leader ?? null, locale, copy),
    { key: "might", label: copy.ledger.might, value: might === null ? null : <Num n={might} /> },
    { key: "members", label: copy.ledger.members, value: membersText(page) },
    rankFact(board, clock, copy),
  ];
}

/** Members, Joins & leaves (`?tab=moves`, issue 823, with the 7 days' net) and History, the member
 * history's own page. */
export function AllianceTabs({
  unionId,
  members,
  net,
  current,
  copy,
}: {
  unionId: number;
  members: number;
  /** `+2`, `−2`, `0`. */
  net: string;
  current: "members" | "moves";
  copy: Dictionary;
}) {
  const p = copy.alliancePage;
  const tabs = [
    { key: "members", href: `/alliances/${unionId}`, label: fill(p.membersTab, { n: members }) },
    { key: "moves", href: `/alliances/${unionId}?tab=moves`, label: fill(p.movesTab, { n: net }) },
  ] as const;
  return (
    <nav aria-label={p.sections} className="mt-8 border-b border-rule">
      <ul className="flex flex-wrap gap-x-2">
        {tabs.map((t) => (
          <li key={t.key}>
            <Link
              href={t.href}
              scroll={false}
              aria-current={t.key === current ? "page" : undefined}
              className={`${TAB} border-b-2 border-transparent aria-[current=page]:border-plum`}
            >
              {t.label}
            </Link>
          </li>
        ))}
        <li>
          <TextLink href={`/alliances/${unionId}/history`} className={TAB}>
            {p.historyTab}
          </TextLink>
        </li>
      </ul>
    </nav>
  );
}

/** The member list as tab-separated rows under a header row, in the list's order, with plain integers. */
export function membersTsv(roster: AlliancePageMember[], copy: Dictionary): string {
  const p = copy.alliancePage;
  const head = [copy.ledger.rank, copy.members.name, copy.ledger.might, p.active, p.coins, p.tech];
  const rows = roster.map((m) =>
    [
      m.rank === null ? "" : `R${m.rank}`,
      cell(m.name),
      m.power ?? "",
      m.active ?? "",
      m.dailyHonor ?? "",
      m.dailyTech ?? "",
    ].join("\t"),
  );
  return [head.join("\t"), ...rows].join("\n");
}

function Chip({ label, n }: { label: string; n: number | null }) {
  if (n === null) return null;
  return (
    <li className="rounded-full border border-rule px-2 tabular-nums">
      <span className={MUTED}>{label}</span> <Num n={n} />
    </li>
  );
}

function MemberRow({ m, copy }: { m: AlliancePageMember; copy: Dictionary }) {
  const p = copy.alliancePage;
  return (
    <li className="flex items-start justify-between gap-3 px-3 py-2">
      <div className="min-w-0">
        <p className="flex flex-wrap items-center gap-x-2">
          {m.rank !== null && <span className={`text-sm tabular-nums ${MUTED}`}>R{m.rank}</span>}
          {m.role && (
            <span className={`inline-flex items-center gap-1 text-sm ${MUTED}`}>
              <RoleMark role={m.role} />
              {m.role.kind === "officer" ? m.role.title : copy.leadership.leader}
            </span>
          )}
          <TextLink
            href={`/players/${m.uid}`}
            className="inline-flex min-h-11 min-w-0 items-center break-words font-medium"
          >
            <bdi>{m.name}</bdi>
          </TextLink>
        </p>
        <ul className="flex flex-wrap gap-2 text-sm">
          <Chip label={p.active} n={m.active} />
          <Chip label={p.coins} n={m.dailyHonor} />
          <Chip label={p.tech} n={m.dailyTech} />
        </ul>
      </div>
      <span className="shrink-0 pt-2 text-lg font-medium tabular-nums">
        <Num n={m.power} />
      </span>
    </li>
  );
}

export function AllianceMembers({
  page,
  clock,
  copy,
}: {
  page: AlliancePage;
  clock: Clock;
  copy: Dictionary;
}) {
  return (
    <section className="mt-3">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <p className={`text-sm ${MUTED}`}>
          {fill(copy.alliancePage.read, { date: clock.day(dayDate(page.day)) })}
        </p>
        <CopyRoster text={membersTsv(page.roster, copy)} />
      </div>
      <ul className="drawn-card divide-y divide-rule">
        {page.roster.map((m) => (
          <MemberRow key={m.uid} m={m} copy={copy} />
        ))}
      </ul>
    </section>
  );
}
