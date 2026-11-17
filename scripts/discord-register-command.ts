// `pnpm discord:register <guild id> [<guild id> …]`: registers the "Send to LAPTracker" message command
// (D96) in each given Discord server, where the app is installed with `applications.commands`. No bot
// token: the app's own client-credentials grant, scope `applications.commands.update`, with
// DISCORD_CLIENT_ID and DISCORD_CLIENT_SECRET from the environment (.env.local). The guild's commands are
// replaced by this one command (PUT is Discord's bulk overwrite). Prints the guild ids and HTTP statuses
// only: never the secret or the token. DISCORD_API_BASE_URL points it at a stub for a local run.
import { IMPORT_COMMAND } from "../lib/import-command";

const base = (process.env.DISCORD_API_BASE_URL || "https://discord.com/api").replace(/\/$/, "");
const id = process.env.DISCORD_CLIENT_ID;
const secret = process.env.DISCORD_CLIENT_SECRET;
const guilds = process.argv.slice(2);

if (!id || !secret || guilds.length === 0 || guilds.some((g) => !/^\d{17,20}$/.test(g))) {
  console.error(
    "usage: pnpm discord:register <guild id> … (needs DISCORD_CLIENT_ID and DISCORD_CLIENT_SECRET)",
  );
  process.exit(2);
}

const token = await fetch(`${base}/oauth2/token`, {
  method: "POST",
  headers: {
    authorization: `Basic ${Buffer.from(`${id}:${secret}`).toString("base64")}`,
    "content-type": "application/x-www-form-urlencoded",
  },
  body: new URLSearchParams({
    grant_type: "client_credentials",
    scope: "applications.commands.update",
  }),
});
if (!token.ok) {
  console.error(`token: HTTP ${token.status}`);
  process.exit(1);
}
const { access_token: bearer } = (await token.json()) as { access_token: string };

let failed = 0;
for (const guild of guilds) {
  const res = await fetch(`${base}/applications/${id}/guilds/${guild}/commands`, {
    method: "PUT",
    headers: { authorization: `Bearer ${bearer}`, "content-type": "application/json" },
    body: JSON.stringify([IMPORT_COMMAND]),
  });
  console.log(
    `${guild}: HTTP ${res.status}${res.ok ? ` "${IMPORT_COMMAND.name}" registered` : ""}`,
  );
  if (!res.ok) failed += 1;
}
process.exit(failed > 0 ? 1 : 0);
