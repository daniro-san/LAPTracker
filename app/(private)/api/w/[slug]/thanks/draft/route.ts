// POST /api/w/[slug]/thanks/draft {people: [{name, did}], lastWeek} — "Share the thanks" (issue 404, D114):
// the weekly appreciation post drafted in EN, PT and FR. The model gets placeholders and plain deeds, never
// a name or a number; the names go back in here. Nothing is stored. Officers only (401 signed_out, D99);
// without GROQ_API_KEY, 503 not_set_up and the officer writes their own. Each draft counts three units
// against D101's translation limits; past them, 429 busy. The log carries the time taken and a count,
// never the text or a name.
import { ChatError } from "@/lib/ai/groq";
import { WRITING_LANGUAGES } from "@/lib/ai/notice-writing";
import { requireWorkspace } from "@/lib/private/access";
import { counted } from "@/lib/private/desk-action";
import { isSameOriginJson, NO_STORE, privateError, requestCookies } from "@/lib/private/http";
import { privateLog } from "@/lib/private/log";
import { SLUG } from "@/lib/private/sign-in";
import { draftInput, draftThanks } from "@/lib/private/thanks";
import { quota } from "@/lib/private/translate-limits";
import { withContext } from "@/lib/route";

/** Three calls at once; each may fall back to the second model (D81). */
export const maxDuration = 60;

const FAILURE = { timeout: 504, busy: 429, failed: 502 } as const;

export async function POST(
  request: Request,
  { params }: { params: Promise<{ slug: string }> },
): Promise<Response> {
  const { slug } = await params;
  if (!SLUG.test(slug)) return privateError(404, "not_found");
  if (!isSameOriginJson(request)) return privateError(403, "forbidden");
  const parsed = draftInput.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return privateError(400, "bad_request");
  return withContext("/api/w/[slug]/thanks/draft", async (ctx, db) => {
    const access = await requireWorkspace(db, slug, requestCookies(request), ctx.now());
    if (!access.ok) return privateError(401, "signed_out");
    const ai = ctx.ai;
    if (!ai) return privateError(503, "not_set_up");
    // One unit per language, counted before Groq is asked, with D101's per-person and per-day limits.
    const refused = await quota(db, `desk:${access.user.id}`, WRITING_LANGUAGES.length, ctx.now());
    if (refused !== "ok") return privateError(429, "busy");
    const started = ctx.now().getTime();
    try {
      const texts = await draftThanks(ai, parsed.data);
      privateLog("thanks.draft.ok", {
        ms: ctx.now().getTime() - started,
        people: parsed.data.people.length,
      });
      return counted(
        ctx,
        access,
        "thanks",
        "draft",
        Response.json({ texts }, { headers: NO_STORE }),
      );
    } catch (error) {
      if (!(error instanceof ChatError)) throw error;
      privateLog(`thanks.draft.${error.kind}`, { ms: ctx.now().getTime() - started });
      return privateError(FAILURE[error.kind], error.kind);
    }
  });
}
