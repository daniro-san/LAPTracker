// "Request a Desk" (D130, issue 453) for the owner: the roster lines /admin shows under a request, and the
// lines the admin Discord channel gets when a request arrives and when an invite makes a Desk (issue 500).
// English only (D48). The in-game name and rank are public game data; no other roster field is read or sent
// (D71).
import { copy } from "./copy";
import { allianceLabel, escapeDiscord } from "./notify";
import { fill } from "./words";

const t = copy.admin.invites;

/** "Roster says: R4 · Recruiter, seen 19 Nov", or "Name not found in the roster". */
export function rosterLine(r: { rank: string | null; seenAt: Date | null }): string {
  if (!r.seenAt) return t.roster.notFound;
  const seen = new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  }).format(r.seenAt);
  return fill(t.roster.found, { rank: r.rank ?? t.roster.noRank, date: seen });
}

/** A claimed R5 that the roster lists as R4: the line /admin highlights under the request, else null. */
export function rankWarning(r: { claimed: "r5" | "r4"; rank: string | null }): string | null {
  return r.claimed === "r5" && r.rank && /^R4\b/.test(r.rank)
    ? fill(t.roster.r5AsR4, { rank: r.rank })
    : null;
}

/** The admin channel's line when an alliance completes its Desk through an invite (issue 500); the tag and
 * name are the alliance's newest label (D133). */
export function deskMadeMessage(w: {
  unionId: number;
  slug: string;
  tag: string;
  name: string;
}): string {
  return fill(t.deskMade, {
    alliance: allianceLabel({ unionId: w.unionId, tag: w.tag, name: w.name || null }),
    slug: w.slug,
  });
}

/** The admin channel's line: the alliance, the name typed, the rank claimed and what the roster says. */
export function accessRequestMessage(r: {
  unionId: number;
  tag: string;
  name: string;
  player: string;
  claimed: "r5" | "r4";
  rank: string | null;
  seenAt: Date | null;
}): string {
  return fill(t.discordLine, {
    alliance: allianceLabel({ unionId: r.unionId, tag: r.tag, name: r.name }),
    player: escapeDiscord(r.player),
    claimed: t.claimed[r.claimed],
    roster: escapeDiscord(rosterLine(r)),
  });
}
