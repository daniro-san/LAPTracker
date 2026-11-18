// POST /api/w/[slug]/notices/draft — Translate, Improve writing and Fit to 1,000 (D81, D113, issues 304,
// 305 and 402). The body is the text the officer is editing and nothing else; the answer is a draft per
// language that the officer reviews before saving. A translation that came back mostly untranslated after
// its one retry is listed in `partly`. Translate localizes within the board's room. Fit answers 422
// `still_over` when both its tries came back over the limit. Nothing is stored. The log carries a code, the
// time taken and counts, never the text.
//   {kind: "translate", from, to: [languages], text, limit?}  {kind: "improve", language, tone, text, limit?}
//   {kind: "fit", language, text}
import { z } from "zod";

import { ChatError } from "@/lib/ai/groq";
import {
  fitText,
  improveText,
  TONES,
  translateText,
  WRITING_LANGUAGES,
  type WritingLanguage,
} from "@/lib/ai/notice-writing";
import { requireWorkspace } from "@/lib/private/access";
import { counted } from "@/lib/private/desk-action";
import { isSameOriginJson, NO_STORE, privateError, requestCookies } from "@/lib/private/http";
import { privateLog } from "@/lib/private/log";
import { DRAFT_LIMIT, NOTICE_LIMIT, noticeLength } from "@/lib/private/notice-rules";
import { SLUG } from "@/lib/private/sign-in";
import { START_HERE_MAX } from "@/lib/private/start-here";
import { withContext } from "@/lib/route";

/** At worst four calls of 15 s: both models, then the one retry (or Fit's second try) and its fallback. */
export const maxDuration = 90;

const language = z.enum(WRITING_LANGUAGES);
const text = z.string().trim().min(1).max(DRAFT_LIMIT);
// The room the answer must stay within: the notice board's 1,000 by default; Start here sends its part's own
// cap (D116), never more than its largest.
const limit = z
  .number()
  .int()
  .positive()
  .max(Math.max(...Object.values(START_HERE_MAX)))
  .optional();
const body = z.discriminatedUnion("kind", [
  z
    .object({
      kind: z.literal("translate"),
      from: language,
      to: z.array(language).min(1).max(2),
      text,
      limit,
    })
    .strict()
    .refine((b) => new Set(b.to).size === b.to.length && !b.to.includes(b.from)),
  z.object({ kind: z.literal("improve"), language, tone: z.enum(TONES), text, limit }).strict(),
  // Fit is offered only over the limit (D113).
  z
    .object({ kind: z.literal("fit"), language, text })
    .strict()
    .refine((b) => noticeLength(b.text) > NOTICE_LIMIT),
]);

type Answer = { to: WritingLanguage; text: string; retried: boolean; partly: boolean };

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
      let answers: Answer[];
      if (ask.kind === "translate") {
        answers = await Promise.all(
          ask.to.map(async (to) => ({
            to,
            ...(await translateText(ai, ask.from, to, ask.text, ask.limit ?? NOTICE_LIMIT)),
          })),
        );
      } else if (ask.kind === "improve") {
        const improved = await improveText(
          ai,
          ask.language,
          ask.tone,
          ask.text,
          ask.limit ?? NOTICE_LIMIT,
        );
        answers = [{ to: ask.language, text: improved, retried: false, partly: false }];
      } else {
        const fitted = await fitText(ai, ask.language, ask.text, NOTICE_LIMIT, noticeLength);
        if (!fitted) {
          privateLog("notices.fit.still_over", { ms: ctx.now().getTime() - started });
          return privateError(422, "still_over");
        }
        answers = [{ to: ask.language, text: fitted.text, retried: fitted.retried, partly: false }];
      }
      privateLog(`notices.${ask.kind}.ok`, {
        ms: ctx.now().getTime() - started,
        retried: answers.filter((a) => a.retried).length,
        partly: answers.filter((a) => a.partly).length,
      });
      const drafts = Response.json(
        {
          drafts: Object.fromEntries(answers.map((a) => [a.to, a.text])),
          partly: answers.filter((a) => a.partly).map((a) => a.to),
        },
        { headers: NO_STORE },
      );
      return counted(ctx, access, "notice_ai", ask.kind, drafts);
    } catch (error) {
      if (!(error instanceof ChatError)) throw error;
      privateLog(`notices.${ask.kind}.${error.kind}`, { ms: ctx.now().getTime() - started });
      return privateError(FAILURE[error.kind], error.kind);
    }
  });
}
