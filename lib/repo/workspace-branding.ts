// A workspace's branding (issue 462, D167): the saved tab title, icon choice and accent, and the Discord
// server's icon hash as the bot last read it. Plain reads and writes; what they mean is in lib/private/branding.ts.
import { eq } from "drizzle-orm";

import type { Db } from "../db";
import { workspaces } from "../schema";
import {
  lookOf,
  type WebhookLook,
  ACCENTS,
  BRAND_ICONS,
  DEFAULT_ACCENT,
  DEFAULT_ICON,
  defaultTitle,
  DESK_TITLE,
  type Accent,
  type Branding,
  type BrandIcon,
} from "../workspace-branding";
import { allianceLabelOf } from "./alliances";

const w = workspaces;

export interface BrandingRow {
  workspaceId: number;
  unionId: number;
  discordGuildId: string;
  title: string | null;
  icon: string | null;
  accent: string | null;
  discordIconHash: string | null;
}

export async function brandingBySlug(db: Db, slug: string): Promise<BrandingRow | null> {
  const [row] = await db
    .select({
      workspaceId: w.id,
      unionId: w.unionId,
      discordGuildId: w.discordGuildId,
      title: w.brandTitle,
      icon: w.brandIcon,
      accent: w.brandAccent,
      discordIconHash: w.discordIconHash,
    })
    .from(w)
    .where(eq(w.slug, slug));
  return row ?? null;
}

/** One save: all three settings together; null is "the default". */
export async function saveBranding(
  db: Db,
  workspaceId: number,
  v: { title: string | null; icon: string | null; accent: string | null },
): Promise<void> {
  await db
    .update(w)
    .set({ brandTitle: v.title, brandIcon: v.icon, brandAccent: v.accent })
    .where(eq(w.id, workspaceId));
}

const isIcon = (v: string | null): v is BrandIcon =>
  (BRAND_ICONS as readonly string[]).includes(v ?? "");
const isAccent = (v: string | null): v is Accent =>
  (ACCENTS as readonly string[]).includes(v ?? "");

/**
 * A workspace's branding as every surface shows it, defaults filled in; null when no workspace has the slug.
 * `fallback`: the title for an alliance with no tag, in the reader's language.
 */
export async function workspaceBranding(
  db: Db,
  slug: string,
  fallback: string = DESK_TITLE,
): Promise<(Branding & { workspaceId: number; guildId: string; tag: string | null }) | null> {
  const row = await brandingBySlug(db, slug);
  if (!row) return null;
  const label = await allianceLabelOf(db, row.unionId);
  return {
    workspaceId: row.workspaceId,
    guildId: row.discordGuildId,
    tag: label?.tag ?? null,
    title: row.title ?? defaultTitle(label?.tag ?? null, fallback),
    custom: row.title !== null,
    icon: isIcon(row.icon) ? row.icon : DEFAULT_ICON,
    accent: isAccent(row.accent) ? row.accent : DEFAULT_ACCENT,
    badgeId: label?.badgeId ?? null,
    discordIconHash: row.discordIconHash,
  };
}

/** Who a workspace's webhook messages post as (issue 462); nothing when the workspace is gone. */
export async function webhookLook(db: Db, slug: string, origin?: string): Promise<WebhookLook> {
  const b = await workspaceBranding(db, slug);
  return b ? lookOf(b, slug, origin) : {};
}

/** The server's icon hash as the bot last read it (null: the server has none). */
export async function setDiscordIconHash(
  db: Db,
  workspaceId: number,
  hash: string | null,
): Promise<void> {
  await db.update(w).set({ discordIconHash: hash }).where(eq(w.id, workspaceId));
}
