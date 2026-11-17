// POST /api/w/[slug]/notices/draft — Translate and Improve writing (D81, issues 304 and 305). The body is the
// text the officer is editing and nothing else; the answer is a draft per language that the officer reviews
// before saving. Nothing is stored. The log carries a code and the time taken, never the text.
//   {kind: "translate", from, to: [languages], text}  {kind: "improve", language, tone, text}
import { z } from "zod";

import { ChatError } from "@/lib/ai/groq";
import { improveText, TONES, translateText, WRITING_LANGUAGES } from "@/lib/ai/notice-writing";
import { requireWorkspace } from "@/lib/private/access";
import { isSameOriginJson, NO_STORE, privateError, requestCookies } from "@/lib/private/http";
import { privateLog } from "@/lib/private/log";
import { DRAFT_LIMIT, NOTICE_LIMIT } from "@/lib/private/notice-rules";
import { SLUG } from "@/lib/private/sign-in";
import { withContext } from "@/lib/route";

/** Two models at 15 s each, at worst (D81); the platform's default would cut that short on some plans. */
export const maxDuration = 60;

const language = z.enum(WRITING_LANGUAGES);
const text = z.string().trim().min(1).max(DRAFT_LIMIT);
const body = z.discriminatedUnion("kind", [
  z
    .object({
      kind: z.literal("translate"),
      from: language,
      to: z.array(language).min(1).max(2),
      text,
    })
    .strict()
    .refine((b) => new Set(b.to).size === b.to.length && !b.to.includes(b.from)),
  z.object({ kind: z.literal("improve"), language, tone: z.enum(TONES), text }).strict(),
]);

const FAILURE = { timeout: 504, busy: 429, failed: 502 } as const;

export async function POST(
  request: Request,
  { params }: { params: Promise<{ slug: string }> },
): Promise<Response> {
  const { slug } = await params;
  if (!SLUG.test(slug)) return privateError(404, "not_found");
  if (!isSameOriginJson(request)) return privateError(403, "forbidden");
  const parsed = body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return privateError(400, "bad_request");
  return withContext("/api/w/[slug]/notices/draft", async (ctx, db) => {
    const access = await requireWorkspace(db, slug, requestCookies(request), ctx.now());
    if (!access.ok) return privateError(401, "signed_out");
    const ai = ctx.ai;
    if (!ai) return privateError(503, "not_set_up");
    const ask = parsed.data;
    const started = ctx.now().getTime();
    try {
      const drafts =
        ask.kind === "translate"
          ? await Promise.all(
              ask.to.map(async (to) => [to, await translateText(ai, ask.from, to, ask.text)]),
            )
          : [[ask.language, await improveText(ai, ask.language, ask.tone, ask.text, NOTICE_LIMIT)]];
      privateLog(`notices.${ask.kind}.ok`, { ms: ctx.now().getTime() - started });
      return Response.json({ drafts: Object.fromEntries(drafts) }, { headers: NO_STORE });
    } catch (error) {
      if (!(error instanceof ChatError)) throw error;
      privateLog(`notices.${ask.kind}.${error.kind}`, { ms: ctx.now().getTime() - started });
      return privateError(FAILURE[error.kind], error.kind);
    }
  });
}
