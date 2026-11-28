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
  TITLE_LIMIT,
  titleLength,
} from "../workspace-branding";
import type { WorkspaceAccess } from "./access";
import { botIn } from "./discord-setup";

export { workspaceBranding } from "../repo/workspace-branding";

/** At most this many saves per 15 minutes per workspace: an officer trying looks saves often. */
const SAVES = 60;
const WINDOW_MS = 15 * 60_000;

/** The raw title is bounded at the boundary; its length is checked once cleaned. "" is the default title. */
export const brandingInput = z
  .object({
    title: z.string().max(1000),
    icon: z.enum(BRAND_ICONS),
    accent: z.enum(ACCENTS),
  })
  .strict();
export type BrandingInput = z.infer<typeof brandingInput>;

type DiscordEnv = Pick<Env, "DISCORD_API_BASE_URL" | "DISCORD_BOT_TOKEN">;

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
    const found = await botIn(deps.env, deps.fetch, before.guildId);
    const hash = found.state === "in" ? found.icon : null;
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
