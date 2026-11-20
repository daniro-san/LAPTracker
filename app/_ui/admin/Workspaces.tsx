// /admin's Workspaces section (D71, D73): reads the workspaces after the page's own isAdmin() check and
// hands them, as words, to the card that edits them; then the Discord section (D96), which registers the
// "Send to LAPTracker" command in their servers; then the squads read's progress and its button (D117,
// amendment 2026-11-19b).
import { ALLIANCES, OWN_ALLIANCE_ID } from "@/config/alliances";
import { copy, fill } from "@/lib/copy";
import { getEnv } from "@/lib/env";
import { withPageDb } from "@/lib/page";
import { squadsProgress, type SquadsProgress } from "@/lib/queries/squads-progress";
import { adminFeatures } from "@/lib/queries/workspace-features";
import { listTombstones, listWorkspaces, type AdminWorkspace } from "@/lib/queries/workspaces";
import { quotaDayRead } from "@/lib/schedule";
import { defaultSettings, resolveFeatures, type FeatureSettings } from "@/lib/workspace-features";
import { keyUsable, masterFingerprint } from "@/lib/workspace-keys";

import { DiscordCommandCard, type GuildView } from "./DiscordCommandCard";
import { AdminSection } from "./parts";
import { SquadsCard, type SquadsRowView } from "./SquadsCard";
import { WorkspacesCard } from "./WorkspacesCard";

const t = copy.admin.workspaces;
const ago = new Intl.RelativeTimeFormat("en", { numeric: "auto" });

/** "Last seen": minutes under an hour, hours under two days, else days. */
function seen(at: Date, now: Date): string {
  const minutes = Math.round((at.getTime() - now.getTime()) / 60_000);
  if (minutes > -60) return ago.format(minutes, "minute");
  if (minutes > -2880) return ago.format(Math.round(minutes / 60), "hour");
  return ago.format(Math.round(minutes / 1440), "day");
}

const day = (at: Date) => at.toISOString().slice(0, 10);

/** D125: "Deletion asked by an officer on … · deleted after …", or null when none is asked. */
function deletionLine(deletion: AdminWorkspace["deletion"]): string | null {
  if (!deletion) return null;
  const d = t.deletion;
  const who = deletion.byOwner ? d.owner : (deletion.by ?? d.officer);
  return fill(d.line, { who, asked: day(deletion.askedAt), date: day(deletion.purgeAfter) });
}

/** The workspaces the daily job deleted (D125): what is left of each, no member data. */
function Deleted({ rows }: { rows: Awaited<ReturnType<typeof listTombstones>> }) {
  if (rows.length === 0) return null;
  const d = t.deletion;
  return (
    <div className="mt-6">
      <h3 className="font-subhead text-display-sm">{d.deleted}</h3>
      <p className="text-body-sm text-ink/70">{d.deletedHelp}</p>
      <ul className="mt-2 grid gap-2 text-body-sm break-words">
        {rows.map((r) => (
          <li key={r.id}>
            {fill(d.tombstone, {
              slug: r.slug,
              alliance: r.alliance ?? String(r.unionId),
              who: r.byOwner ? d.owner : d.officer,
              asked: day(r.requestedAt),
              purged: day(r.purgedAt),
            })}
          </li>
        ))}
      </ul>
    </div>
  );
}

function allianceLabel(unionId: number): string {
  const alliance = ALLIANCES.find((a) => a.unionId === unionId);
  return alliance ? `${alliance.tag} · ${alliance.name}` : String(unionId);
}

/**
 * squadTargets' rule, from the key's status without opening it: the squads read is on (D126), and the
 * workspace is the own alliance with no key of its own (or keys are off: no `current` fingerprint), or its
 * key is usable now (D124).
 */
function squadsOn(
  w: AdminWorkspace,
  settings: FeatureSettings,
  current: string | null,
  now: Date,
): boolean {
  if (!resolveFeatures(settings, []).on.has("squads")) return false;
  const k = w.trackerKey;
  if (k.set && current) return k.masterFp === current && keyUsable(k.status, k.statusAt, now);
  return w.unionId === OWN_ALLIANCE_ID;
}

/** One workspace's squads read of this quota day in words, and what its button does. */
function squadsRow(
  unionId: number,
  alliance: string,
  p: SquadsProgress | undefined,
  now: Date,
): SquadsRowView {
  const s = t.squads;
  if (!p) return { unionId, alliance, lines: [s.none], action: "run" };
  const state = p.batchRunning
    ? s.batchRunning
    : fill(s.status[p.status], { reason: p.reason ?? "" });
  const progress = fill(s.progress, {
    reached: p.reached,
    members: p.members,
    retrying: p.retrying,
    failed: p.failed,
    quota: p.quotaRemaining ?? s.quotaUnknown,
  });
  const last = p.lastBatchAt ? [fill(s.lastBatch, { ago: seen(p.lastBatchAt, now) })] : [];
  return {
    unionId,
    alliance,
    lines: [state, progress, ...last],
    action: p.status === "running" && !p.batchRunning ? "next" : null,
  };
}

/** The workspaces the squads read takes, or that have a row in the quota day, as SquadsCard's rows. */
function squadsRows(page: {
  rows: AdminWorkspace[];
  squads: SquadsProgress[];
  settingsOf: (w: AdminWorkspace) => FeatureSettings;
  current: string | null;
  now: Date;
}): SquadsRowView[] {
  const { squads, current, now } = page;
  return page.rows
    .filter(
      (w) =>
        squadsOn(w, page.settingsOf(w), current, now) ||
        squads.some((p) => p.unionId === w.unionId),
    )
    .map((w) => {
      const p = squads.find((x) => x.unionId === w.unionId);
      return squadsRow(w.unionId, allianceLabel(w.unionId), p, now);
    });
}

export async function Workspaces({ now }: { now: Date }) {
  const squadsDay = quotaDayRead(now, getEnv());
  const [rows, deleted, features, squads] = await withPageDb((db) =>
    Promise.all([
      listWorkspaces(db, now),
      listTombstones(db),
      adminFeatures(db, now),
      squadsProgress(db, squadsDay, now),
    ]),
  );
  // D124: a key sealed under another master key reads "needs to be entered again", worked out from its
  // fingerprint, with no write and no tracker call. /admin never sees a key.
  const secret = getEnv().WORKSPACE_KEYS_SECRET;
  const current = secret ? masterFingerprint(secret) : null;
  // D126: a workspace always has settings (its defaults until changed).
  const settingsOf = (w: AdminWorkspace) =>
    features.settings.get(w.id) ?? defaultSettings(w.unionId);
  const views = rows.map((w) => {
    return {
      id: w.id,
      unionId: w.unionId,
      slug: w.slug,
      alliance: allianceLabel(w.unionId),
      guild: w.discordGuildId,
      roles: w.leaderRoleIds.join(", "),
      memberRoles: w.memberRoleIds.join(", "),
      sessions: w.openSessions,
      allowlist: w.allowlist.map(
        (a) =>
          `${a.discordUserId}${a.expiresAt ? ` ${fill(t.until, { date: a.expiresAt.toISOString().slice(0, 10) })}` : ""}`,
      ),
      // D124: set or not and the status only; /admin cannot read, change or remove the key.
      trackerKey: w.trackerKey.set
        ? fill(t.key.set, {
            status:
              t.key.status[w.trackerKey.masterFp === current ? w.trackerKey.status : "reenter"],
            when: w.trackerKey.statusAt ? seen(w.trackerKey.statusAt, now) : "",
          })
        : t.key.unset,
      deletion: deletionLine(w.deletion),
      people: w.signedIn.map((p) => ({
        id: p.userId,
        name: p.name ?? t.signOutUsers.noName,
        tier: p.tier,
        seen: fill(t.signOutUsers.seen, { ago: seen(p.lastSeen, now) }),
      })),
      features: {
        ...settingsOf(w),
        used: features.usage.get(w.id) ?? { ai: 0, translate: 0 },
      },
    };
  });
  const guilds: GuildView[] = [...new Set(rows.map((w) => w.discordGuildId))].map((guild) => ({
    guild,
    name: rows
      .filter((w) => w.discordGuildId === guild)
      .map((w) => ALLIANCES.find((a) => a.unionId === w.unionId)?.tag ?? w.slug)
      .join(" · "),
  }));
  const env = getEnv();
  return (
    <>
      <AdminSection id="workspaces" title={t.title} help={t.help}>
        <p className="mb-4 text-body-sm text-ink/80">{t.key.rotation}</p>
        <WorkspacesCard workspaces={views} paused={features.paused} />
        <Deleted rows={deleted} />
      </AdminSection>
      <AdminSection id="squads" title={t.squads.title} help={t.squads.help}>
        <SquadsCard day={squadsDay} rows={squadsRows({ rows, squads, settingsOf, current, now })} />
      </AdminSection>
      <AdminSection id="discord" title={t.command.title} help={t.command.help}>
        <DiscordCommandCard
          guilds={guilds}
          ready={Boolean(env.DISCORD_CLIENT_ID && env.DISCORD_CLIENT_SECRET)}
        />
      </AdminSection>
    </>
  );
}
