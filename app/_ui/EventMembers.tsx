// The event alliance page's member list (plan Phase 5c) under its "Members" heading, where every drilldown
// lands (`#members`): the URL's `show=` and `sort=` start the list (`filterFromUrl`), and the Joined / Left
// line gives the two member lists' read times as the page's clock writes them ("10:00", "Nov 14, 14:00").
import type { AllianceRow, MemberRow, Role } from "@/lib/queries";

import { hhmmOn, onTwoDays, type Clock } from "./format";
import { requestCopy } from "./locale";
import { canCompare, filterFromUrl, MEMBERS_ID, viewsOf } from "./member-views";
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
}: {
  detail: Detail;
  canDelta: boolean;
  search: Promise<Record<string, string | string[] | undefined>>;
  clock: Clock;
}) {
  const [copy, params] = await Promise.all([requestCopy(), search]);
  const { before, after, membersBefore, membersAfter } = detail;
  const compared = canCompare(membersBefore, membersAfter);
  const initial = filterFromUrl(params, { canDelta, compared });
  const [from, to] = [before?.sourceUpdatedAt, after?.sourceUpdatedAt];
  return (
    <section aria-labelledby={MEMBERS_ID}>
      <h2 id={MEMBERS_ID} className="mb-2 mt-8 scroll-mt-20 font-subhead text-display-md">
        {copy.ledger.members}
      </h2>
      <MembersExplorer
        // A link to this page with another filter remounts the list, so it starts from the new URL.
        key={`${initial.show}:${initial.sort}`}
        members={viewsOf(detail)}
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
