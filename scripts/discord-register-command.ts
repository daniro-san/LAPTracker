// `pnpm discord:register <guild id> [<guild id> …]`: registers the app's message commands, "Send to
// LAPTracker" (D96), "Translate for me" and "Translate for everyone" (D101), in each given Discord server,
// where the app is installed with `applications.commands`, through lib/app-commands.ts's
// registerAppCommands (the same function /admin's button calls), with DISCORD_CLIENT_ID and
// DISCORD_CLIENT_SECRET from the environment (.env.local). The guild's commands are replaced by these three
// (PUT is Discord's bulk overwrite). Prints the guild ids and HTTP statuses
// only: never the secret or the token. DISCORD_API_BASE_URL points it at a stub for a local run.
import { APP_COMMANDS, registerAppCommands } from "../lib/app-commands";

const guilds = process.argv.slice(2);
const usage =
  "usage: pnpm discord:register <guild id> … (needs DISCORD_CLIENT_ID and DISCORD_CLIENT_SECRET)";

if (guilds.length === 0 || guilds.some((g) => !/^\d{17,20}$/.test(g))) {
  console.error(usage);
  process.exit(2);
}

const result = await registerAppCommands(
  {
    DISCORD_CLIENT_ID: process.env.DISCORD_CLIENT_ID,
    DISCORD_CLIENT_SECRET: process.env.DISCORD_CLIENT_SECRET,
    DISCORD_API_BASE_URL: process.env.DISCORD_API_BASE_URL || "https://discord.com/api",
  },
  fetch,
  guilds,
);
if (!result.ok) {
  console.error(result.code === "no_credentials" ? usage : `token: HTTP ${result.status}`);
  process.exit(result.code === "no_credentials" ? 2 : 1);
}

let failed = 0;
for (const { guildId, status } of result.guilds) {
  const ok = status >= 200 && status < 300;
  console.log(
    `${guildId}: HTTP ${status}${ok ? ` ${APP_COMMANDS.map((c) => `"${c.name}"`).join(", ")} registered` : ""}`,
  );
  if (!ok) failed += 1;
}
process.exit(failed > 0 ? 1 : 0);
