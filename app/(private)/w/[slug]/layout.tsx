// /w/[slug], an alliance's workspace (D71). Nothing private is read here, so a link pasted in Discord previews
// no private data; each page checks access before it reads anything. The desk's own manifest (D110) replaces
// the public site's, so the desk installs under its own name and opens the desk. The alliance's branding
// (issue 462, D167) is public on purpose: its tab title, icon and accent colour, a title, a choice and a colour
// id, read with no session; the accent goes on the wrapper as `data-accent` (lib/brand/tokens.css).
import type { Metadata } from "next";
import type { ReactNode } from "react";

import { MASK_CLASS } from "@/lib/analytics/sanitise";
import { iconPath } from "@/lib/workspace-branding";

import { deskBranding } from "../../_ui/desk-branding";
import { workspaceWords } from "../../_ui/Frame";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const { t } = await workspaceWords();
  const branding = await deskBranding(slug, t["app.name"]);
  const icon = branding ? [{ url: iconPath(branding, slug, 192), sizes: "192x192" }] : undefined;
  return {
    ...METADATA,
    title: branding?.title ?? METADATA.title,
    manifest: `/w/${slug}/manifest.webmanifest`,
    ...(icon && { icons: { icon, apple: icon } }),
  };
}

const METADATA: Metadata = {
  title: "Officers’ Desk",
  description: "Private.",
  robots: { index: false, follow: false },
  // No preview card: these drop the root opengraph-image, so /w pages carry no og: or twitter: tag
  // (checked in the rendered head of a production build, D73).
  openGraph: null,
  twitter: null,
};

export default async function WorkspaceLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const { t } = await workspaceWords();
  const branding = await deskBranding(slug, t["app.name"]);
  // The default accent needs no attribute: it is the stylesheet's own --burgundy.
  const accent = branding && branding.accent !== "burgundy" ? branding.accent : undefined;
  // Session replay masks every text, attribute, image and field under this class (D77).
  return (
    <div className={MASK_CLASS} data-accent={accent}>
      {children}
    </div>
  );
}
