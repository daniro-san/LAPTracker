// The save hook of the screenshot import's "Secret Ops report" drafts (issues 299, 321, D97): an officer
// reviewed the entries `parseSecretOpsReport` (D74) read from a member's report, and Save turns them into
// thefts marked "from a photo". Until then nothing counts (D75). The draft list, its review screen and the
// one-save-wins version belong to the import; this takes the reviewed draft only.
import { ALLIANCES } from "../../config/alliances";
import type { Db } from "../db";
import { serverPlayers, type ServerPlayer } from "../queries/server-players";
import { insertThefts, listThefts, type NewTheft } from "../repo/thefts";
import { latestRoster } from "../repo/workspace-rosters";
import { serverDay, serverInstant } from "../schedule";
import { matchName } from "../screenshot/match-name";
import { nameKey } from "../screenshot/name-key";
import type { SecretOpsEntry } from "../screenshot/parse-secret-ops";
import type { WorkspaceAccess } from "./access";
import type { ReviewedEntry } from "./import-kinds";
import { attackerKeyOf } from "./theft-groups";
import { isRealDay, type Clock } from "./thefts";

/** A Secret Operations report after an officer's review. */
export interface SecretOpsDraft {
  /** The member whose report it is, in the workspace's own alliance; null when not known. */
  victimUid: number | null;
  /** When the picture was read: the year of the report's "MM-DD HH:MM" times comes from it. */
  readAt: Date;
  /** The entries kept, as the parser gave them or as the officer corrected them, with what was taken. */
  entries: readonly ReviewedEntry[];
}

export interface SecretOpsSaved {
  saved: number;
  /** Not saved: help from a member, entries naming our own alliance, entries already in the log. */
  left: { help: number; own: number; duplicate: number };
}

/**
 * "11-15 13:46" (server time, no year) as an instant: the year of `readAt`'s server day, or the year
 * before when that date would come after the day the picture was read. Null when not read or not a date.
 */
export function reportInstant(at: string | null, readAt: Date, zone: string): Date | null {
  const [monthDay, hhmm] = at?.split(" ") ?? [];
  if (!monthDay || !hhmm) return null;
  const read = serverDay(readAt, { SERVER_TZ: zone });
  const year = Number(read.slice(0, 4)) - (monthDay > read.slice(5) ? 1 : 0);
  const day = `${year}-${monthDay}`;
  return isRealDay(day) ? serverInstant(day, hhmm, { SERVER_TZ: zone }) : null;
}

/**
 * A tracked player when the name matches exactly one (D74) and the read tag, if any, is theirs. `exact`
 * only for the player's current name with the same tag read (case and all): only then is the attacker
 * taken to be on our server (D97, amended 2026-11-19). A segment, a past name or a missing tag is not.
 */
function trackedPlayer(entry: SecretOpsEntry, players: readonly ServerPlayer[]) {
  const match = matchName(
    entry.name,
    players.map((p) => ({ uid: p.uid, names: [p.name] })),
  );
  if (match.status !== "matched") return null;
  const player = players.find((p) => p.uid === match.uid);
  if (!player || (entry.tag !== "" && player.tag.toLowerCase() !== entry.tag.toLowerCase())) {
    return null;
  }
  return { player, exact: match.via === "current" && entry.tag === player.tag };
}

/** The attacker as stored: the tracked player when one matches, else the name and tag as reviewed. */
function attackerFields(e: SecretOpsEntry, players: readonly ServerPlayer[]) {
  const found = trackedPlayer(e, players);
  const player = found?.player;
  const [name, tag] = player ? [player.name, player.tag] : [e.name, e.tag];
  return {
    attackerKey: attackerKeyOf(player?.uid ?? null, name),
    attackerUid: player?.uid ?? null,
    attackerName: name,
    attackerTag: tag,
    rosterExact: found?.exact ?? false,
  };
}

const sameTheft = (a: Omit<NewTheft, "workspaceId">, b: Omit<NewTheft, "workspaceId">) =>
  a.attackerKey === b.attackerKey &&
  a.victimUid === b.victimUid &&
  (a.at?.getTime() ?? null) === (b.at?.getTime() ?? null);

/**
 * Saves the reviewed entries as thefts of type `ops`, the report being a Secret Ops one: an unreadable
 * sentence (`kind: null`) too. Help (`kind: "help"`) is left out. An entry naming the workspace's own alliance
 * (its tag, or a name that matches one member) is left out: our members help each other, and a help line
 * whose sentence was lost must not read as a theft. The same report saved twice adds nothing the second
 * time: each (attacker, victim, time) is saved only as many times as the log does not hold it yet.
 * An entry without an attacker name refuses the whole draft, so the officer fills it in or drops it.
 */
export async function saveSecretOpsDraft(
  db: Db,
  access: WorkspaceAccess,
  draft: SecretOpsDraft,
  clock: Clock,
): Promise<SecretOpsSaved | "not_in_alliance" | "attacker_missing"> {
  const thefts = draft.entries.filter((e) => e.kind !== "help");
  if (thefts.some((e) => nameKey(e.name) === "")) return "attacker_missing";
  const [roster, players, logged] = await Promise.all([
    latestRoster(db, access.unionId),
    serverPlayers(db),
    listThefts(db, access.workspaceId),
  ]);
  const victim = roster.find((m) => m.uid === draft.victimUid) ?? null;
  if (draft.victimUid !== null && !victim) return "not_in_alliance";
  const ownTag = nameKey(ALLIANCES.find((a) => a.unionId === access.unionId)?.tag ?? "");
  const members = roster.map((m) => ({ uid: m.uid, names: [m.name] }));
  const isOwn = (e: SecretOpsEntry) =>
    (ownTag !== "" && nameKey(e.tag) === ownTag) || matchName(e.name, members).status === "matched";
  const others = players.filter((p) => p.unionId !== access.unionId);
  const rows = thefts
    .filter((e) => !isOwn(e))
    .map((e): NewTheft => ({
      workspaceId: access.workspaceId,
      at: reportInstant(e.at, draft.readAt, clock.zone),
      ...attackerFields(e, others),
      kind: "ops",
      victimUid: victim?.uid ?? null,
      victimName: victim?.name ?? null,
      source: "photo",
      items: e.items?.trim() || null,
      note: null,
      createdBy: access.user.id,
      createdAt: clock.now,
    }));
  const fresh = rows.filter(
    (row, i) =>
      rows.slice(0, i + 1).filter((r) => sameTheft(r, row)).length >
      logged.filter((r) => sameTheft(r, row)).length,
  );
  await insertThefts(db, fresh);
  return {
    saved: fresh.length,
    left: {
      help: draft.entries.length - thefts.length,
      own: thefts.length - rows.length,
      duplicate: rows.length - fresh.length,
    },
  };
}
