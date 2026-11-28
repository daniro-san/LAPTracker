// POST /api/w/[slug]/desk-language — Alliance settings → Language (issue 438). Officers only: same origin,
// JSON, an officer's session (401 signed_out, D99), so the setting is always the session's own workspace's.
// {language}: "en" | "pt-BR" | "fr", or "" to follow each viewer's browser. 429 rate_limited.
import { requireWorkspace } from "@/lib/private/access";
import { deskLanguageInput, saveDeskLanguageFor } from "@/lib/private/desk-language";
import {
  isSameOriginJson,
  NO_STORE,
  privateError,
  privately,
  requestCookies,
} from "@/lib/private/http";
import { SLUG } from "@/lib/private/sign-in";
import { withContext } from "@/lib/route";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ slug: string }> },
): Promise<Response> {
  const { slug } = await params;
  if (!SLUG.test(slug)) return privateError(404, "not_found");
  if (!isSameOriginJson(request)) return privateError(403, "forbidden");
  const parsed = deskLanguageInput.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return privateError(400, "bad_request");
  const input = parsed.data;
  return withContext("/api/w/[slug]/desk-language", slug, async (ctx, db) => {
    const now = ctx.now();
    const access = await requireWorkspace(db, slug, requestCookies(request), now);
    if (!access.ok) return privateError(401, "signed_out");
    const done = await privately("deskLanguage.save", () =>
      saveDeskLanguageFor(db, access, input, now),
    );
    if (!done.ok) return privateError(429, done.code);
    return Response.json({ language: input.language }, { headers: NO_STORE });
  });
}
