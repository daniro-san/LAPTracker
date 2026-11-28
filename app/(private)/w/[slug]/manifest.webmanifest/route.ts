// GET /w/[slug]/manifest.webmanifest — the Officers' Desk's own web manifest (D110), linked from every
// /w/[slug] page. Added to the home screen from a desk page, the app is named "Officers' Desk" (in the
// phone's language), opens the desk and stays inside it, and Android offers it in Share: its share target
// posts to /w/[slug]/share, inside the scope as Android requires. The public site keeps app/manifest.ts.
// It reads nothing private: the address, the words and the alliance's branding (issue 462, D167: its tab
// title as the app's name, its icon and its accent as the theme colour) are public.
import type { MetadataRoute } from "next";

import { getAppContext } from "@/lib/app-context";
import { accentColor, tokenColor } from "@/lib/brand/palette";
import { workspaceBranding } from "@/lib/private/branding";
import { WORKSPACE_LANG_COOKIE } from "@/lib/private/cookies";
import { workspaceDefaultLanguage } from "@/lib/private/desk-language";
import {
  isWorkspaceLanguage,
  pickWorkspaceLanguage,
  WORKSPACE_DICTIONARIES,
} from "@/lib/private/dictionary";
import { requestCookies } from "@/lib/private/http";
import { SLUG } from "@/lib/private/sign-in";
import { DEFAULT_ACCENT, iconPath } from "@/lib/workspace-branding";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ slug: string }> },
): Promise<Response> {
  const { slug } = await params;
  if (!SLUG.test(slug)) return new Response(null, { status: 404 });
  const { db, close } = getAppContext().openDb();
  // The language switch's cookie, else the workspace's saved language, else the phone's, as on every desk page.
  const cookie = requestCookies(request).get(WORKSPACE_LANG_COOKIE)?.value;
  const preset = isWorkspaceLanguage(cookie)
    ? null
    : await workspaceDefaultLanguage(db, slug).catch(() => null);
  const language = pickWorkspaceLanguage(cookie, request.headers.get("accept-language"), preset);
  const t = WORKSPACE_DICTIONARIES[language];
  const desk = `/w/${slug}`;
  const branding = await workspaceBranding(db, slug, t["app.name"])
    .catch(() => null)
    .finally(close);
  const name = branding?.title ?? t["app.name"];
  const accent = branding?.accent ?? DEFAULT_ACCENT;
  const manifest: MetadataRoute.Manifest = {
    id: desk,
    name,
    short_name: name,
    start_url: desk,
    scope: desk,
    display: "standalone",
    background_color: tokenColor("paper"),
    theme_color: accent === DEFAULT_ACCENT ? tokenColor("plum") : accentColor(accent),
    icons: ([192, 512] as const).map((s) => ({
      src: branding ? iconPath(branding, slug, s) : `/icon/${s}`,
      sizes: `${s}x${s}`,
      type: "image/png",
      purpose: "any",
    })),
    share_target: {
      action: `${desk}/share`,
      method: "POST",
      enctype: "multipart/form-data",
      params: { files: [{ name: "shots", accept: ["image/*"] }] },
    },
  };
  return Response.json(manifest, { headers: { "Content-Type": "application/manifest+json" } });
}
