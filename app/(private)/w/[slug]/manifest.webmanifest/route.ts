// GET /w/[slug]/manifest.webmanifest — the Officers' Desk's own web manifest (D110), linked from every
// /w/[slug] page. Added to the home screen from a desk page, the app is named "Officers' Desk" (in the
// phone's language), opens the desk and stays inside it, and Android offers it in Share: its share target
// posts to /w/[slug]/share, inside the scope as Android requires. The public site keeps app/manifest.ts.
// It reads nothing private: the address and the words are public.
import type { MetadataRoute } from "next";

import { tokenColor } from "@/lib/brand/palette";
import { WORKSPACE_LANG_COOKIE } from "@/lib/private/cookies";
import { pickWorkspaceLanguage, WORKSPACE_DICTIONARIES } from "@/lib/private/dictionary";
import { requestCookies } from "@/lib/private/http";
import { SLUG } from "@/lib/private/sign-in";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ slug: string }> },
): Promise<Response> {
  const { slug } = await params;
  if (!SLUG.test(slug)) return new Response(null, { status: 404 });
  // The language switch's cookie, else the phone's language, as on every desk page.
  const language = pickWorkspaceLanguage(
    requestCookies(request).get(WORKSPACE_LANG_COOKIE)?.value,
    request.headers.get("accept-language"),
  );
  const t = WORKSPACE_DICTIONARIES[language];
  const desk = `/w/${slug}`;
  const manifest: MetadataRoute.Manifest = {
    id: desk,
    name: t["app.name"],
    short_name: t["app.name"],
    start_url: desk,
    scope: desk,
    display: "standalone",
    background_color: tokenColor("paper"),
    theme_color: tokenColor("plum"),
    icons: [192, 512].map((s) => ({
      src: `/icon/${s}`,
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
