// /admin's New alliances section (D130, issue 453): reads the invite links and the requests after the page's
// own isAdmin() check and hands them, as words, to InvitesCard. English only (D48).
import { copy, fill } from "@/lib/copy";
import { rankWarning, rosterLine } from "@/lib/notify-request";
import { withPageDb } from "@/lib/page";
import {
  listInvites,
  listRequests,
  REQUESTS_SHOWN,
  type AdminInvite,
} from "@/lib/queries/alliance-invites";
import type { AllianceLabel } from "@/lib/queries/alliance-list";

import { InvitesCard } from "./InvitesCard";
import { AdminSection } from "./parts";
import { choiceLabel } from "./Workspaces";

const t = copy.admin.invites;
const day = (at: Date) =>
  new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", timeZone: "UTC" }).format(at);

function stateText(i: AdminInvite): string {
  const s = t.invites.state;
  const until = day(i.expiresAt);
  if (i.state === "used") {
    return fill(s.used, { slug: i.slug ?? "", date: i.usedAt ? day(i.usedAt) : "" });
  }
  if (i.state === "expired") return fill(s.expired, { date: until });
  if (i.state === "cancelled") return s.cancelled;
  if (i.state === "waiting") return fill(s.waiting, { date: until });
  return fill(s[i.state], { name: i.name ?? "", date: until });
}

export async function Invites({
  now,
  unionIds,
  known,
}: {
  now: Date;
  unionIds: number[];
  /** Every alliance an invite may be made for (D133). */
  known: ({ unionId: number } & AllianceLabel)[];
}) {
  const [invites, requests] = await withPageDb((db) =>
    Promise.all([listInvites(db, now), listRequests(db)]),
  );
  const labels = new Map(known.map((a) => [a.unionId, choiceLabel(a)]));
  const label = (unionId: number) => labels.get(unionId) ?? String(unionId);
  const open = new Set(["waiting", "signedIn", "server"]);
  return (
    <AdminSection id="new-alliances" title={t.title} help={t.help}>
      <InvitesCard
        alliances={known
          .filter((a) => !unionIds.includes(a.unionId))
          .map((a) => ({ unionId: a.unionId, label: choiceLabel(a) }))}
        invites={invites.map((i) => ({
          id: i.id,
          alliance: label(i.unionId),
          line: `${label(i.unionId)} · ${fill(t.invites.made, { date: day(i.createdAt) })} · ${stateText(i)}`,
          open: open.has(i.state),
        }))}
        more={requests.more ? fill(t.requests.more, { n: String(REQUESTS_SHOWN) }) : null}
        requests={requests.rows.map((r) => ({
          id: r.id,
          alliance: label(r.unionId),
          line: fill(t.requests.line, {
            alliance: label(r.unionId),
            player: r.player,
            claimed: t.claimed[r.claimed],
            date: day(r.createdAt),
          }),
          roster: rosterLine(r),
          warning: rankWarning(r),
          decided:
            r.decision && r.decidedAt
              ? fill(t.requests[r.decision], { date: day(r.decidedAt) })
              : null,
        }))}
      />
    </AdminSection>
  );
}
