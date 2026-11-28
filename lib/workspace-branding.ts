// A workspace's own look (issue 462, D167): the tab title, the icon and the accent colour, nothing else. Pure,
// for the server, the settings card and its preview. The accents' colours are in lib/brand/tokens.css.
import { calloutLength, cleanCallout } from "./post-callout";

/** The accent colours an officer may pick, the default first. Never a free hex: each one is in tokens.css. */
export const ACCENTS = ["burgundy", "indigo", "teal", "forest", "umber", "slate"] as const;
export type Accent = (typeof ACCENTS)[number];
export const DEFAULT_ACCENT: Accent = "burgundy";

/** The badge is the default: it needs no setup. `discord`: the server's icon; `mark`: the desk's own mark. */
export const BRAND_ICONS = ["badge", "discord", "mark"] as const;
export type BrandIcon = (typeof BRAND_ICONS)[number];
export const DEFAULT_ICON: BrandIcon = "badge";

/** The most characters a tab title holds. */
export const TITLE_LIMIT = 40;

/** The title as stored and counted: one line of plain text, single spaces, nothing hidden, no angle brackets. */
export const cleanTitle = (text: string) => cleanCallout(text.replace(/[<>]/g, ""));
export const titleLength = calloutLength;

/** The title when none is saved: "[NSE] Desk"; "Officers' Desk" for an alliance with no tag. */
export const defaultTitle = (tag: string | null, fallback: string) =>
  tag ? `[${tag}] Desk` : fallback;

/** A server icon's hash as Discord gives it: 32 hex digits, `a_` first when animated. */
export const ICON_HASH = /^(?:a_)?[0-9a-f]{32}$/;

/** The title of an alliance with no tag: the desk's own name in English (the dictionary's `app.name`). */
export const DESK_TITLE = "Officers’ Desk";

export interface Branding {
  /** The title as shown: the saved one, else the default. */
  title: string;
  /** Whether the title is a saved one. */
  custom: boolean;
  icon: BrandIcon;
  accent: Accent;
  /** The badge's preset id (101–110), when the alliance has one. */
  badgeId: number | null;
  /** The server's icon hash, as the bot last read it; null: none known. */
  discordIconHash: string | null;
}

/**
 * The icon's address on our own origin, `/img/...`, never Discord's: the badge by its id, the server's icon
 * through `/img/desk/<slug>`, the desk mark as the site's drawn icon. A choice with nothing behind it (no
 * badge id, no server icon) falls back to the desk mark. `size`: the icon's pixels, 192 or 512 for the app.
 * `v` is the choice and its badge id or icon hash: the address changes with the icon, so a cached copy of the
 * old one is never served after a change.
 */
export function iconPath(
  b: Pick<Branding, "icon" | "badgeId" | "discordIconHash">,
  slug: string,
  size: 192 | 512,
): string {
  const version =
    b.icon === "badge" && b.badgeId !== null
      ? `badge-${b.badgeId}`
      : b.icon === "discord" && b.discordIconHash
        ? `discord-${b.discordIconHash}`
        : null;
  return version ? `/img/desk/${slug}?size=${size}&v=${version}` : `/icon/${size}`;
}

/** What a webhook message posts as (issue 462): Discord's per-message `username` and `avatar_url`. */
export interface WebhookLook {
  username?: string;
  avatar_url?: string;
}

/** Discord's own rule for a webhook name: 1 to 80 characters, and not "clyde" or "discord". */
const NAME_REFUSED = /clyde|discord/i;

/**
 * The tab title as the message's name and the chosen icon as its avatar. `origin`: our own address, which
 * Discord fetches the avatar from; without it the avatar stays the webhook's own.
 */
export function lookOf(
  b: Pick<Branding, "title" | "icon" | "badgeId" | "discordIconHash">,
  slug: string,
  origin?: string,
): WebhookLook {
  // Never cut: a title Discord would refuse (over 80 code points, or naming "clyde" or "discord") is left out,
  // so the post still goes out under the webhook's own name.
  const name = b.title;
  const fits = name.trim() !== "" && Array.from(name).length <= 80 && !NAME_REFUSED.test(name);
  return {
    ...(fits && { username: name }),
    ...(origin && { avatar_url: `${origin}${iconPath(b, slug, 512)}` }),
  };
}
