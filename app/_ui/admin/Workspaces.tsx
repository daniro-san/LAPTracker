// /admin's Workspaces section (D71, D73): reads the workspaces after the page's own isAdmin() check and
// hands them, as words, to the card that edits them; then the Discord section (D96), which registers the
// "Send to LAPTracker" command in their servers; then the squads read's progress and its button (D117,
// amendment 2026-11-19b).
import { OWN_ALLIANCE_ID } from "@/config/alliances";
import { copy, fill } from "@/lib/copy";
import { discordClock } from "@/lib/discord-format";
import { getEnv } from "@/lib/env";
import { withPageDb } from "@/lib/page";
import { allianceUsage } from "@/lib/queries/admin-alliances";
import { knownAlliances } from "@/lib/queries/alliance-list";
import { squadsProgress, type SquadsProgress } from "@/lib/queries/squads-progress";
import { adminFeatures, type AdminFeatures } from "@/lib/queries/workspace-features";
import { listTombstones, listWorkspaces, type AdminWorkspace } from "@/lib/queries/workspaces";
import { quotaDayRead } from "@/lib/schedule";
import { stopKind } from "@/lib/squads";
import {
  newAllianceDefaults,
  resolveFeatures,
  type FeatureSettings,
} from "@/lib/workspace-features";
import { keyUsable, masterFingerprint } from "@/lib/workspace-keys";

import { allianceRow, byAttention, type AllianceRow } from "./alliances-view";
import { Alliances } from "./AlliancesTable";
import { DiscordCommandCard, type GuildView } from "./DiscordCommandCard";
import { featuresView, settingsFor } from "./features-view";
import { Invites } from "./Invites";
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

/**
 * D129: the bot seen or not, the commands registered (or not), and each channel's webhook: set by the
 * workspace, `env` while WORKSPACE_DISCORD_WEBHOOKS still covers it, or not set. Never a webhook.
 */
function discordLine(w: AdminWorkspace, site: Partial<Record<string, unknown>> | undefined) {
  const d = t.discord;
  const hook = (c: "leaders" | "members") =>
    w.discord.webhooks.includes(c) ? d.set : site?.[c] ? d.site : d.unset;
  const commands = w.discord.commands;
  return fill(d.line, {
    bot: w.discord.botSeen ? d.botSeen : d.botUnseen,
    commands: commands === null ? d.noCommands : commands.length ? commands.join(", ") : d.noneOn,
    leaders: hook("leaders"),
    members: hook("members"),
  });
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

/** `TAG · Name` for a select or a line; the id when nothing names it (D133). */
export const choiceLabel = (a: { unionId: number; tag: string | null; name: string | null }) =>
  a.tag || a.name ? [a.tag, a.name].filter(Boolean).join(" · ") : String(a.unionId);

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
  const progress = fill(s.progress, {
    read: p.read,
    members: p.members,
    retrying: p.retrying,
    failed: p.failed,
    quota: p.quotaRemaining ?? s.quotaUnknown,
  });
  // D132: everyone left waits for a later turn: the state says so, with the time; nothing to press.
  const idle = p.status === "running" && !p.batchRunning;
  const later = idle && p.dueNow === 0 && p.nextAt !== null;
  const last = p.lastBatchAt ? [fill(s.lastBatch, { ago: seen(p.lastBatchAt, now) })] : [];
  return {
    unionId,
    alliance,
    lines: [stateLine(p, later), progress, ...nextLine(p, later), ...last],
    action: idle && !later ? "next" : null,
  };
}

/** "HH:MM" on the server's clock. */
const serverTime = (at: Date) => discordClock(getEnv().SERVER_TZ).time(at);

/** The day's state: a batch running, everyone left waiting for a later try, or the row's status. */
function stateLine(p: SquadsProgress, later: boolean): string {
  const s = t.squads;
  if (p.batchRunning) return s.batchRunning;
  if (later && p.nextAt)
    return fill(s.waitingLater, { waiting: p.waiting, at: serverTime(p.nextAt) });
  const kind = stopKind(p.reason);
  return fill(s.status[p.status], { reason: kind ? s.reasons[kind] : (p.reason ?? "") });
}

/**
 * D132: when the next waiting member's turn comes, unless the state line already says it. Only while the
 * day runs: a stopped day has no next try.
 */
function nextLine(p: SquadsProgress, later: boolean): string[] {
  if (p.status !== "running" || !p.nextAt || later) return [];
  return [fill(t.squads.nextTry, { at: serverTime(p.nextAt) })];
}

/** The workspaces the squads read takes, or that have a row in the quota day, as SquadsCard's rows. */
function squadsRows(page: {
  rows: AdminWorkspace[];
  squads: SquadsProgress[];
  features: AdminFeatures;
  current: string | null;
  now: Date;
  allianceLabel: (unionId: number) => string;
}): SquadsRowView[] {
  const { squads, current, now, allianceLabel } = page;
  return page.rows
    .filter(
      (w) =>
        squadsOn(w, settingsFor(page.features, w), current, now) ||
        squads.some((p) => p.unionId === w.unionId),
    )
    .map((w) => {
      const p = squads.find((x) => x.unionId === w.unionId);
      return squadsRow(w.unionId, allianceLabel(w.unionId), p, now);
    });
}

/** The Alliances table's rows (D144), the ones that need a look first. */
function allianceRows(page: {
  rows: AdminWorkspace[];
  features: AdminFeatures;
  usage: Awaited<ReturnType<typeof allianceUsage>>;
  current: string | null;
  now: Date;
  allianceLabel: (unionId: number) => string;
}): AllianceRow[] {
  const { features, current, now } = page;
  return page.rows
    .map((w) =>
      allianceRow({
        w,
        alliance: page.allianceLabel(w.unionId),
        features,
        view: featuresView(features, w),
        usage: page.usage.get(w.id),
        current,
        now,
        ago: (at) => seen(at, now),
      }),
    )
    .sort(byAttention);
}

export async function Workspaces({ now }: { now: Date }) {
  const squadsDay = quotaDayRead(now, getEnv());
  const [rows, deleted, features, squads, known, usage] = await withPageDb((db) =>
    Promise.all([
      listWorkspaces(db, now),
      listTombstones(db),
      adminFeatures(db, now),
      squadsProgress(db, squadsDay, now),
      knownAlliances(db),
      allianceUsage(db, squadsDay, now),
    ]),
  );
  const choices = known.map((a) => ({ unionId: a.unionId, label: choiceLabel(a) }));
  const allianceLabel = (id: number) => choices.find((c) => c.unionId === id)?.label ?? String(id);
  // D124: a key sealed under another master key reads "needs to be entered again", worked out from its
  // fingerprint, with no write and no tracker call. /admin never sees a key.
  const secret = getEnv().WORKSPACE_KEYS_SECRET;
  const current = secret ? masterFingerprint(secret) : null;
  const views = rows.map((w) => ({
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
          status: t.key.status[w.trackerKey.masterFp === current ? w.trackerKey.status : "reenter"],
          when: w.trackerKey.statusAt ? seen(w.trackerKey.statusAt, now) : "",
        })
      : t.key.unset,
    deletion: deletionLine(w.deletion),
    discord: discordLine(w, getEnv().WORKSPACE_DISCORD_WEBHOOKS?.[w.slug]),
    people: w.signedIn.map((p) => ({
      id: p.userId,
      name: p.name ?? t.signOutUsers.noName,
      tier: p.tier,
      seen: fill(t.signOutUsers.seen, { ago: seen(p.lastSeen, now) }),
    })),
    features: featuresView(features, w),
  }));
  const guilds: GuildView[] = [...new Set(rows.map((w) => w.discordGuildId))].map((guild) => ({
    guild,
    name: rows
      .filter((w) => w.discordGuildId === guild)
      .map((w) => known.find((a) => a.unionId === w.unionId)?.tag ?? w.slug)
      .join(" · "),
  }));
  const env = getEnv();
  const page = { rows, squads, features, usage, current, now, allianceLabel };
  return (
    <>
      <Alliances rows={allianceRows(page)} />
      <AdminSection id="workspaces" title={t.title} help={t.help}>
        <p className="mb-4 text-body-sm text-ink/80">{t.key.rotation}</p>
        <WorkspacesCard
          workspaces={views}
          alliances={choices}
          paused={features.paused}
          defaults={newAllianceDefaults(features.defaults)}
        />
        <Deleted rows={deleted} />
      </AdminSection>
      <Invites now={now} unionIds={rows.map((w) => w.unionId)} known={known} />
      <AdminSection id="squads" title={t.squads.title} help={t.squads.help}>
        <SquadsCard day={squadsDay} rows={squadsRows(page)} />
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
