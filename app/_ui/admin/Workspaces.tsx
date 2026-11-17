// /admin's Workspaces section (D71, D73): reads the workspaces after the page's own isAdmin() check and
// hands them, as words, to the card that edits them; then the Discord section (D96), which registers the
// "Send to LAPTracker" command in their servers.
import { ALLIANCES } from "@/config/alliances";
import { copy, fill } from "@/lib/copy";
import { getEnv } from "@/lib/env";
import { withPageDb } from "@/lib/page";
import { listWorkspaces } from "@/lib/queries/workspaces";

import { DiscordCommandCard, type GuildView } from "./DiscordCommandCard";
import { AdminSection } from "./parts";
import { WorkspacesCard } from "./WorkspacesCard";

const t = copy.admin.workspaces;

export async function Workspaces({ now }: { now: Date }) {
  const rows = await withPageDb((db) => listWorkspaces(db, now));
  const views = rows.map((w) => {
    const alliance = ALLIANCES.find((a) => a.unionId === w.unionId);
    return {
      id: w.id,
      slug: w.slug,
      alliance: alliance ? `${alliance.tag} · ${alliance.name}` : String(w.unionId),
      guild: w.discordGuildId,
      roles: w.leaderRoleIds.join(", "),
      sessions: w.openSessions,
      allowlist: w.allowlist.map(
        (a) =>
          `${a.discordUserId}${a.expiresAt ? ` ${fill(t.until, { date: a.expiresAt.toISOString().slice(0, 10) })}` : ""}`,
      ),
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
