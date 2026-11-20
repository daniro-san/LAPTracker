// POST /api/w/[slug]/data-export {requestId} — "Download our data" (D125): the workspace's own data as a
// ZIP of CSV files and its notices' pictures, with a README in the officer's language. Officers only (a
// member's session, another workspace's or none answers 401 signed_out); 3 a day per workspace (429).
// The answer is the file itself, under Vercel's 4.5 MB response limit.
import { z } from "zod";

import { ALLIANCES } from "@/config/alliances";
import { requireWorkspace } from "@/lib/private/access";
import { WORKSPACE_LANG_COOKIE } from "@/lib/private/cookies";
import { counted } from "@/lib/private/desk-action";
import { pickWorkspaceLanguage, WORKSPACE_DICTIONARIES } from "@/lib/private/dictionary";
import { featureOn } from "@/lib/private/features";
import { isSameOriginJson, NO_STORE, privateError, requestCookies } from "@/lib/private/http";
import { SLUG } from "@/lib/private/sign-in";
import { downloadData } from "@/lib/private/workspace-export";
import { withContext } from "@/lib/route";

const body = z.object({ requestId: z.uuid() }).strict();

const FAILED = { rate_limited: 429, too_large: 413 } as const;

export async function POST(
  request: Request,
  { params }: { params: Promise<{ slug: string }> },
): Promise<Response> {
  const { slug } = await params;
  if (!SLUG.test(slug)) return privateError(404, "not_found");
  if (!isSameOriginJson(request)) return privateError(403, "forbidden");
  const parsed = body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return privateError(400, "bad_request");
  return withContext("/api/w/[slug]/data-export", slug, async (ctx, db) => {
    const now = ctx.now();
    const cookies = requestCookies(request);
    const access = await requireWorkspace(db, slug, cookies, now);
    if (!access.ok) return privateError(401, "signed_out");
    if (!featureOn(access, "export")) return privateError(403, "turned_off");
    const language = pickWorkspaceLanguage(
      cookies.get(WORKSPACE_LANG_COOKIE)?.value,
      request.headers.get("accept-language"),
    );
    const alliance = ALLIANCES.find((a) => a.unionId === access.unionId);
    const words = {
      now,
      zone: ctx.env.SERVER_TZ,
      language,
      t: WORKSPACE_DICTIONARIES[language],
      alliance: alliance ? `${alliance.tag} · ${alliance.name}` : access.slug,
    };
    const result = await downloadData(db, access, parsed.data.requestId, words);
    if (!result.ok) return privateError(FAILED[result.code], result.code);
    const file = new Response(result.zip as Uint8Array<ArrayBuffer>, {
      headers: {
        ...NO_STORE,
        "content-type": "application/zip",
        "content-disposition": `attachment; filename="${result.filename}"`,
      },
    });
    return counted(ctx, access, "workspace_data", "download", file);
  });
}
