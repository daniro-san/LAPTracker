// The event alliance page's member list (plan Phase 5c) under its "Members" heading, where every drilldown
// lands (`#members`): the URL's `show=` and `sort=` start the list (`filterFromUrl`), and the Joined / Left
// line gives the two member lists' read times as the page's clock writes them ("10:00", "Nov 14, 14:00").
import type { AllianceRow, MemberRow, Role } from "@/lib/queries";

import { hhmmOn, onTwoDays, type Clock } from "./format";
import { requestCopy } from "./locale";
import { arrivalOf, canCompare, filterFromUrl, MEMBERS_ID, viewsOf } from "./member-views";
import { MembersExplorer } from "./MembersExplorer";

interface Detail {
  before: AllianceRow | null;
  after: AllianceRow | null;
  membersBefore: MemberRow[];
  membersAfter: MemberRow[];
  rolesBefore: ReadonlyMap<number, Role>;
  rolesAfter: ReadonlyMap<number, Role>;
}

export async function EventMembers({
  detail,
  canDelta,
  search,
  clock,
  page,
}: {
  detail: Detail;
  canDelta: boolean;
  search: Promise<Record<string, string | string[] | undefined>>;
  clock: Clock;
  /** This alliance page's own address, without the query: the arrival line's × goes back to it. */
  page: string;
}) {
  const [copy, params] = await Promise.all([requestCopy(), search]);
  const { before, after, membersBefore, membersAfter } = detail;
  const compared = canCompare(membersBefore, membersAfter);
  const members = viewsOf(detail);
  const initial = filterFromUrl(params, { canDelta, compared }, members);
  const [from, to] = [before?.sourceUpdatedAt, after?.sourceUpdatedAt];
  // A War turnout or Kill share row opened the list sorted by ± Kills: one line says why (D158 rule 7 (d)).
  const arrival = initial.sort === "killsDelta" ? arrivalOf(params.from) : null;
  return (
    <section aria-labelledby={MEMBERS_ID}>
      <h2 id={MEMBERS_ID} className="mb-2 mt-8 scroll-mt-20 font-subhead text-display-md">
        {copy.ledger.members}
      </h2>
      {arrival && (
        <p className="mb-2 flex items-center justify-between gap-2 border-l-2 border-yarn pl-3 text-sm">
          <span className="min-w-0">
            {arrival === "war_turnout" ? copy.ledger.arrivedTurnout : copy.ledger.arrivedKillShare}
          </span>
          <a
            href={`${page}#${MEMBERS_ID}`}
            aria-label={copy.ledger.arrivedClear}
            className="tint-button flex min-h-11 min-w-11 shrink-0 items-center justify-center text-lg"
          >
            <span aria-hidden="true">×</span>
          </a>
        </p>
      )}
      <MembersExplorer
        // A link to this page with another filter remounts the list, so it starts from the new URL.
        key={`${initial.show}:${initial.sort}`}
        members={members}
        canDelta={canDelta}
        compared={compared}
        capacity={after?.capacity ?? before?.capacity ?? null}
        initial={initial}
        reads={{
          from: from ? hhmmOn(clock, from, onTwoDays(clock, from, to)) : "—",
          to: to ? hhmmOn(clock, to, true) : "—",
        }}
      />
    </section>
  );
}
