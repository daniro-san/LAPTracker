// GET /img/desk/[slug]?size=192|512 — a workspace's chosen icon from our own origin (issue 462, D167, D22): its
// alliance badge (the tracker site's preset, as /img/badge/[id]) or its Discord server's icon (the hash the bot
// read, fetched here from Discord's CDN). Viewers and Discord load only this route, never Discord's CDN, and it
// never redirects there. Nothing private: the icon, by the workspace's public address. The desk mark has no
// file here (the site's /icon/<size> is it), so that choice, or a choice with nothing behind it, is a 404.
import { getAppContext } from "@/lib/app-context";
import {
  badgeSource,
  fetchImage,
  imageResponse,
  logImageFailure,
  notFoundImage,
} from "@/lib/images";
import { workspaceBranding } from "@/lib/repo/workspace-branding";
import { WORKSPACE_SLUG } from "@/lib/repo/workspaces";
import { ICON_HASH } from "@/lib/workspace-branding";

import { resizedResponse } from "../../resize";

const SIZES = new Set([192, 512]);
/** Short: an officer who changes the icon sees it in the tab within the hour. */
const DESK_CACHE = "public, max-age=3600, s-maxage=3600, stale-while-revalidate=86400";
/** The one host this route fetches besides the tracker site's (D22 amendment, D167). */
const DISCORD_CDN = "https://cdn.discordapp.com";

/** The picture to fetch for the saved choice: the tracker's badge file, or the server's icon on Discord's CDN. */
function sourceOf(
  b: NonNullable<Awaited<ReturnType<typeof workspaceBranding>>>,
  siteBaseUrl: string,
  size: number,
): string | null {
  if (b.icon === "badge" && b.badgeId !== null) return badgeSource(b.badgeId, siteBaseUrl);
  const hash = b.discordIconHash;
  if (b.icon !== "discord" || !hash || !ICON_HASH.test(hash) || !/^\d{5,25}$/.test(b.guildId))
    return null;
  return `${DISCORD_CDN}/icons/${b.guildId}/${hash}.png?size=${size}`;
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ slug: string }> },
): Promise<Response> {
  const { slug } = await params;
  const size = Number(new URL(request.url).searchParams.get("size") ?? 512);
  if (!WORKSPACE_SLUG.test(slug) || !SIZES.has(size)) return notFoundImage();
  const ctx = getAppContext();
  const { db, close } = ctx.openDb();
  const branding = await workspaceBranding(db, slug)
    .catch(() => null)
    .finally(close);
  if (!branding) return notFoundImage();
  const source = sourceOf(branding, ctx.env.LAP_SITE_BASE_URL, size);
  if (!source) return notFoundImage();
  const image = await fetchImage(source, ctx.fetch);
  if (!("body" in image)) {
    logImageFailure("/img/desk", slug, image);
    return notFoundImage();
  }
  return (
    (await resizedResponse(image, size, "cover", DESK_CACHE)) ?? imageResponse(image, DESK_CACHE)
  );
}
