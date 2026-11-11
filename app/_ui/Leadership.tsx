// The alliance page's Leadership section: the R5 leader centered on top, then each titled R4 officer
// in a centered row below (2×2 from 640 px, one row from 1024 px), as cards (photo, name, role, Might,
// Kills, Level) that stack to one column on a phone. Each card is one link to the player page. The
// member list below is not changed by it (DESIGN.md `leadership`).

import { RoleMark } from "@/lib/brand/components/RoleMark";
import { TextLink } from "@/lib/brand/components/TextLink";

import { requestCopy } from "./locale";
import type { MemberView } from "./member-views";
import { Num } from "./Num";
import { PlayerAvatar } from "./Pictures";
import { LABEL } from "./StatTable";

// Two centered rows: a short row of officers sits in the middle, and a second R5 joins the leader.
const ROW = "flex flex-wrap justify-center gap-3";
// One officer wide (half the row) from 640 px, a third of the row from 1024 px.
const LEADER_WIDTH = "w-full sm:w-[calc((100%-0.75rem)/2)] lg:w-[calc((100%-1.5rem)/3)]";
// Two per row from 640 px, four from 1024 px.
const OFFICER_WIDTH = "w-full sm:w-[calc((100%-0.75rem)/2)] lg:w-[calc((100%-2.25rem)/4)]";

/** Renders nothing when the alliance has no leader or titled officer on record. */
export async function Leadership({ members }: { members: MemberView[] }) {
  if (members.length === 0) return null;
  const copy = await requestCopy();
  const leaders = members.filter((m) => m.role?.kind === "leader");
  const officers = members.filter((m) => m.role?.kind === "officer");
  return (
    <section aria-labelledby="leadership" className="mt-8">
      <h2 id="leadership" className="mb-2 font-subhead text-display-md">
        {copy.leadership.title}
      </h2>
      <div className="flex flex-col gap-3">
        {leaders.length > 0 && (
          <ul className={ROW}>
            {leaders.map((m) => (
              <Card key={m.uid} m={m} copy={copy} width={LEADER_WIDTH} />
            ))}
          </ul>
        )}
        {officers.length > 0 && (
          <ul className={ROW}>
            {officers.map((m) => (
              <Card key={m.uid} m={m} copy={copy} width={OFFICER_WIDTH} />
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}

function Card({
  m,
  copy,
  width,
}: {
  m: MemberView;
  copy: Awaited<ReturnType<typeof requestCopy>>;
  width: string;
}) {
  const now = m.after ?? m.before;
  const figures = [
    [copy.ledger.might, now?.power ?? null],
    [copy.ledger.kills, now?.kills ?? null],
    [copy.ledger.level, now?.lv ?? null],
  ] as const;
  return (
    <li className={`relative flex min-w-0 flex-col gap-2 border border-rule p-3 ${width}`}>
      <div className="flex min-w-0 items-center gap-3">
        <PlayerAvatar uid={m.uid} hasAvatar={m.hasAvatar} size="lg" />
        <div className="min-w-0 break-words">
          <TextLink
            stretch
            href={`/players/${m.uid}`}
            className="inline-flex min-h-11 items-center font-subhead text-display-sm leading-tight"
          >
            {m.name}
          </TextLink>
          <p className="flex flex-wrap items-center gap-x-2 text-sm text-ink/70">
            {m.role && <RoleMark role={m.role} />}
            <span>{m.role?.kind === "officer" ? m.role.title : copy.leadership.leader}</span>
            {m.status === "left" && (
              <span className="font-medium text-seal">
                <span aria-hidden="true">− </span>
                {copy.members.left}
              </span>
            )}
          </p>
        </div>
      </div>
      {/* Equal thirds while the three fit; in a narrow card (four in a row, or exact numbers) a
          figure that does not fit wraps to the next line instead of overlapping its neighbour. */}
      <dl className="flex flex-wrap gap-2">
        {figures.map(([label, value]) => (
          <div key={label} className="flex-1">
            <dt className={LABEL}>{label}</dt>
            <dd className="text-base font-medium tabular-nums">
              <Num n={value} />
            </dd>
          </div>
        ))}
      </dl>
    </li>
  );
}
