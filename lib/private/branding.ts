// Alliance settings → Branding (issue 462, D167): the desk's tab title, icon and accent colour, nothing else.
// The saved choice is public on purpose (the tab, the installed app and the webhook messages show it), so
// `workspaceBranding` (lib/repo/workspace-branding.ts) needs no session: it reads a title, an icon choice and
// a colour id, never a roster field. Saving is for officers of the workspace only (`WorkspaceAccess`), so
// another workspace's officer cannot change it. The Discord server's icon is read through the bot and served
// by /img/desk/[slug]; viewers never load Discord's CDN (D22).
import { z } from "zod";

import type { Db } from "../db";
import type { Env } from "../env";
import { recordFailure } from "../repo/auth-attempts";
import { saveBranding, setDiscordIconHash, workspaceBranding } from "../repo/workspace-branding";
import {
  ACCENTS,
  BRAND_ICONS,
  cleanTitle,
  DEFAULT_ACCENT,
  DEFAULT_ICON,
  defaultTitle,
  DESK_TITLE,
  ICON_HASH,
  TITLE_LIMIT,
  titleLength,
} from "../workspace-branding";
import type { WorkspaceAccess } from "./access";

export { workspaceBranding } from "../repo/workspace-branding";

/** At most this many saves per 15 minutes per workspace: far above an officer trying looks. */
const SAVES = 30;
const WINDOW_MS = 15 * 60_000;
const TIMEOUT_MS = 10_000;

/** The raw title is bounded at the boundary; its length is checked once cleaned. "" is the default title. */
export const brandingInput = z
  .object({
    title: z.string().max(TITLE_LIMIT * 8),
    icon: z.enum(BRAND_ICONS),
    accent: z.enum(ACCENTS),
  })
  .strict();
export type BrandingInput = z.infer<typeof brandingInput>;

type DiscordEnv = Pick<Env, "DISCORD_API_BASE_URL" | "DISCORD_BOT_TOKEN">;

/** The server's icon hash through the bot: a hash, null (the server has none), or undefined (no answer). */
export async function readGuildIcon(
  env: DiscordEnv,
  doFetch: typeof fetch,
  guildId: string,
): Promise<string | null | undefined> {
  if (!env.DISCORD_BOT_TOKEN) return undefined;
  const res = await doFetch(`${env.DISCORD_API_BASE_URL.replace(/\/$/, "")}/guilds/${guildId}`, {
    headers: { authorization: `Bot ${env.DISCORD_BOT_TOKEN}` },
    signal: AbortSignal.timeout(TIMEOUT_MS),
  }).catch(() => null);
  if (!res?.ok) return undefined;
  const body = (await res.json().catch(() => null)) as { icon?: unknown } | null;
  return typeof body?.icon === "string" && ICON_HASH.test(body.icon) ? body.icon : null;
}

export type BrandingResult =
  | { ok: true; title: string; custom: boolean }
  | { ok: false; code: "too_long" | "no_discord_icon" | "rate_limited" };

/**
 * Save the three settings together. A value equal to the default is stored as none, so the title follows the
 * alliance's tag and the colour and icon follow the defaults. Choosing the server's icon reads it first: a
 * server with no icon, or a bot that cannot read it, refuses the choice.
 */
export async function saveBrandingFor(
  db: Db,
  access: WorkspaceAccess,
  input: BrandingInput,
  deps: { env: DiscordEnv; fetch: typeof fetch; now: Date },
): Promise<BrandingResult> {
  const title = cleanTitle(input.title);
  if (titleLength(title) > TITLE_LIMIT) return { ok: false, code: "too_long" };
  const tries = await recordFailure(db, `branding:ws:${access.workspaceId}`, WINDOW_MS, deps.now);
  if (tries > SAVES) return { ok: false, code: "rate_limited" };
  const before = await workspaceBranding(db, access.slug);
  if (!before) throw new Error("branding: workspace not found");
  if (input.icon === "discord") {
    const hash = await readGuildIcon(deps.env, deps.fetch, before.guildId);
    if (!hash) return { ok: false, code: "no_discord_icon" };
    await setDiscordIconHash(db, access.workspaceId, hash);
  }
  const standard = defaultTitle(before.tag, DESK_TITLE);
  const isDefault = title === "" || title === standard;
  await saveBranding(db, access.workspaceId, {
    title: isDefault ? null : title,
    icon: input.icon === DEFAULT_ICON ? null : input.icon,
    accent: input.accent === DEFAULT_ACCENT ? null : input.accent,
  });
  return { ok: true, title: isDefault ? standard : title, custom: !isDefault };
}
