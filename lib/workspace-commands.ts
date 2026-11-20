// Which message commands each workspace's Discord server has (D129, issue 483): only those whose feature is on
// (D126), registered by the app's credentials (lib/app-commands.ts) and recorded per workspace, so /admin shows
// which servers have them. Alliance settings registers one workspace's after its officers add the bot; /admin's
// button registers every workspace's; a change of a switch or a pause re-registers the servers that had
// commands, so a command turned off disappears from Discord's Apps menu.
import {
  COMMAND_FEATURE,
  commandsFor,
  registerAppCommands,
  type RegisterResult,
} from "./app-commands";
import type { Db } from "./db";
import type { Env } from "./env";
import { allDiscordStates, recordCommands, workspaceGuilds } from "./repo/workspace-discord";
import { allSettings, pausedAllowances } from "./repo/workspace-features";
import { resolveFeatures, SPENDS, type Allowance, type Feature } from "./workspace-features";

const COMMAND_FEATURES: readonly Feature[] = Object.values(COMMAND_FEATURE);

/** An /admin change of D126's settings, as far as the Discord commands care. */
export type SettingsChange =
  | { action: "switch"; feature: Feature }
  | { action: "copy" }
  | { action: "cap" }
  | { action: "pause"; allowance: Allowance };

/**
 * Whether the change can add or remove a Discord command, so the servers that had commands are registered
 * again: a command's switch, a copy of every switch, or a pause of an allowance a command spends. A cap
 * changes no command.
 */
export const changesCommands = (c: SettingsChange): boolean =>
  c.action === "copy" ||
  (c.action === "switch" && COMMAND_FEATURES.includes(c.feature)) ||
  (c.action === "pause" && COMMAND_FEATURES.some((f) => SPENDS[f] === c.allowance));

export interface CommandDeps {
  env: Pick<Env, "DISCORD_CLIENT_ID" | "DISCORD_CLIENT_SECRET" | "DISCORD_API_BASE_URL">;
  fetch: typeof fetch;
  now: Date;
}

/**
 * Which workspaces to register: every one (`{}`), only `only`, and with `registered` only those whose server
 * already had the app's commands registered (after the owner changes a switch or a pause).
 */
export interface CommandScope {
  only?: readonly number[];
  registered?: boolean;
}

/**
 * Registers each chosen workspace's commands (those turned on) in its server and records what Discord took.
 * The answer is registerAppCommands's, by server; a server Discord refused keeps its recorded commands.
 */
export async function syncCommands(
  db: Db,
  deps: CommandDeps,
  scope: CommandScope,
): Promise<RegisterResult> {
  const [settings, paused, states, guilds] = await Promise.all([
    allSettings(db),
    pausedAllowances(db),
    allDiscordStates(db),
    workspaceGuilds(db),
  ]);
  const chosen = settings.filter(
    (w) =>
      (!scope.only || scope.only.includes(w.workspaceId)) &&
      (!scope.registered || (states.get(w.workspaceId)?.commands ?? null) !== null),
  );
  const targets = chosen.map((w) => ({
    workspaceId: w.workspaceId,
    guildId: guilds.get(w.workspaceId) ?? "",
    commands: commandsFor(resolveFeatures(w.settings, paused).on),
  }));
  if (targets.length === 0) return { ok: true, guilds: [] };
  const result = await registerAppCommands(deps.env, deps.fetch, targets);
  if (!result.ok) return result;
  for (const [i, g] of result.guilds.entries()) {
    const target = targets[i];
    if (!target || g.status < 200 || g.status >= 300) continue;
    const names = target.commands.map((c) => c.name);
    await recordCommands(db, target.workspaceId, names, deps.now);
  }
  return result;
}
