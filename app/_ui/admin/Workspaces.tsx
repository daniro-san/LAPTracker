// /admin's Workspaces section (D71, D73): reads the workspaces after the page's own isAdmin() check and
// hands them, as words, to the card that edits them; then the Discord section (D96), which registers the
// "Send to LAPTracker" command in their servers.
import { ALLIANCES } from "@/config/alliances";
import { copy, fill } from "@/lib/copy";
import { getEnv } from "@/lib/env";
import { withPageDb } from "@/lib/page";
import { listWorkspaces } from "@/lib/queries/workspaces";
import { masterFingerprint } from "@/lib/workspace-keys";

import { DiscordCommandCard, type GuildView } from "./DiscordCommandCard";
import { AdminSection } from "./parts";
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

export async function Workspaces({ now }: { now: Date }) {
  const rows = await withPageDb((db) => listWorkspaces(db, now));
  // D124: a key sealed under another master key reads "needs to be entered again", worked out from its
  // fingerprint, with no write and no tracker call. /admin never sees a key.
  const secret = getEnv().WORKSPACE_KEYS_SECRET;
  const current = secret ? masterFingerprint(secret) : null;
  const views = rows.map((w) => {
    const alliance = ALLIANCES.find((a) => a.unionId === w.unionId);
    return {
      id: w.id,
      unionId: w.unionId,
      slug: w.slug,
      alliance: alliance ? `${alliance.tag} · ${alliance.name}` : String(w.unionId),
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
      people: w.signedIn.map((p) => ({
        id: p.userId,
        name: p.name ?? t.signOutUsers.noName,
        tier: p.tier,
        seen: fill(t.signOutUsers.seen, { ago: seen(p.lastSeen, now) }),
      })),
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
        <WorkspacesCard workspaces={views} />
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
