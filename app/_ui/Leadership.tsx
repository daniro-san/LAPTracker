// The alliance page's Leadership section: the R5 leader, then each titled R4 officer, as a grid of
// cards (photo, name, role, Might, Kills, Level) that stacks to one column on a phone. Each card is
// one link to the player page. The member list below is not changed by it (DESIGN.md `leadership`).
import Link from "next/link";

import { RoleMark } from "@/lib/brand/components/RoleMark";
import { copy } from "@/lib/copy";

import type { MemberView } from "./member-views";
import { Num } from "./Num";
import { PlayerAvatar } from "./Pictures";
import { LABEL } from "./StatTable";

const roleWord = (m: MemberView) =>
  m.role?.kind === "officer" ? m.role.title : copy.leadership.leader;

/** Renders nothing when the alliance has no leader or titled officer on record. */
export function Leadership({ members }: { members: MemberView[] }) {
  if (members.length === 0) return null;
  return (
    <section aria-labelledby="leadership" className="mt-8">
      <h2 id="leadership" className="mb-2 font-subhead text-display-md">
        {copy.leadership.title}
      </h2>
      <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {members.map((m) => {
          const now = m.after ?? m.before;
          const figures = [
            [copy.ledger.might, now?.power ?? null],
            [copy.ledger.kills, now?.kills ?? null],
            [copy.ledger.level, now?.lv ?? null],
          ] as const;
          return (
            <li key={m.uid} className="relative flex min-w-0 flex-col gap-2 border border-rule p-3">
              <div className="flex min-w-0 items-center gap-3">
                <PlayerAvatar uid={m.uid} hasAvatar={m.hasAvatar} size="lg" />
                <div className="min-w-0 break-words">
                  <Link
                    href={`/players/${m.uid}`}
                    className="inline-flex min-h-11 items-center font-subhead text-display-sm leading-tight text-plum after:absolute after:inset-0 after:content-[''] hover:underline focus-visible:underline"
                  >
                    {m.name}
                  </Link>
                  <p className="flex flex-wrap items-center gap-x-2 text-sm text-ink/70">
                    {m.role && <RoleMark role={m.role} />}
                    <span>{roleWord(m)}</span>
                    {m.status === "left" && (
                      <span className="font-medium text-seal">
                        <span aria-hidden="true">− </span>
                        {copy.members.left}
                      </span>
                    )}
                  </p>
                </div>
              </div>
              <dl className="grid grid-cols-3 gap-2">
                {figures.map(([label, value]) => (
                  <div key={label} className="min-w-0">
                    <dt className={LABEL}>{label}</dt>
                    <dd className="text-base font-medium tabular-nums">
                      <Num n={value} />
                    </dd>
                  </div>
                ))}
              </dl>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
