// "Request a Desk" (D130, issue 453) for the owner: the roster line /admin shows under a request, and the one
// line the admin Discord channel gets when a request arrives. English only (D48). The in-game name and rank are
// public game data; no other roster field is read or sent (D71).
import { copy, fill } from "./copy";
import { allianceLabel, escapeDiscord } from "./notify";

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
