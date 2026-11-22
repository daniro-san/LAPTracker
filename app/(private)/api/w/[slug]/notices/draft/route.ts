// POST /api/w/[slug]/notices/draft — Translate, Improve writing and Fit to 1,000 (D81, D113, issues 304,
// 305 and 402). The body is the text the officer is editing and nothing else; the answer is a draft per
// language that the officer reviews before saving. A translation that came back mostly untranslated after
// its one retry is listed in `partly`. Translate localizes within the board's room. Fit answers 422
// `still_over` when both its tries came back over the limit. Nothing is stored. The log carries a code, the
// time taken and counts, never the text.
//   {kind: "translate", from, to: [languages], text, limit?}  {kind: "improve", language, tone, text, limit?}
//   {kind: "fit", language, text}
import { z } from "zod";

import { ChatError, type ChatModel } from "@/lib/ai/groq";
import {
  fitText,
  improveText,
  TONES,
  translateText,
  WRITING_LANGUAGES,
  type WritingLanguage,
} from "@/lib/ai/notice-writing";
import { eventWorkspace } from "@/lib/analytics/server";
import { requireWorkspace } from "@/lib/private/access";
import { withActionEvent } from "@/lib/private/desk-action";
import { featureOn, giveBackAllowance, settled, useAllowance } from "@/lib/private/features";
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
/** Each kind's switch (D126). */
const SWITCH = {
  translate: "notice_translate",
  improve: "notice_improve",
  fit: "notice_fit",
} as const;

/** The model's drafts for `ask`; null when Shorten came back over the limit both times (D113). */
async function draftsFor(
  ai: ChatModel,
  ask: z.infer<typeof body>,
  onFailed: (n: number) => void,
): Promise<Answer[] | null> {
  if (ask.kind === "translate") {
    // A language the model did not answer is given back alone; the others were spent (D126).
    return settled(
      ask.to.map(async (to) => ({
        to,
        ...(await translateText(ai, ask.from, to, ask.text, ask.limit ?? NOTICE_LIMIT)),
      })),
      onFailed,
    );
  }
  if (ask.kind === "improve") {
    const limit = ask.limit ?? NOTICE_LIMIT;
    const improved = await improveText(ai, ask.language, ask.tone, ask.text, limit);
    return [{ to: ask.language, text: improved, retried: false, partly: false }];
  }
  const fitted = await fitText(ai, ask.language, ask.text, NOTICE_LIMIT, noticeLength);
  return (
    fitted && [{ to: ask.language, text: fitted.text, retried: fitted.retried, partly: false }]
  );
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ slug: string }> },
): Promise<Response> {
  const { slug } = await params;
  if (!SLUG.test(slug)) return privateError(404, "not_found");
  if (!isSameOriginJson(request)) return privateError(403, "forbidden");
  const parsed = body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return privateError(400, "bad_request");
  return withContext("/api/w/[slug]/notices/draft", slug, async (ctx, db) => {
    const access = await requireWorkspace(db, slug, requestCookies(request), ctx.now());
    if (!access.ok) return privateError(401, "signed_out");
    const ai = ctx.ai?.(eventWorkspace(access));
    if (!ai) return privateError(503, "not_set_up");
    const ask = parsed.data;
    if (!featureOn(access, SWITCH[ask.kind])) return privateError(403, "turned_off");
    // D126: one unit per text asked of the model (Translate: one per language), before it is asked.
    const units = ask.kind === "translate" ? ask.to.length : 1;
    const countedAt = ctx.now();
    if ((await useAllowance(db, access, "ai", units, countedAt)) !== "ok")
      return privateError(429, "cap_reached");
    const started = countedAt.getTime();
    let failed = units;
    try {
      const answers = await draftsFor(ai, ask, (n) => (failed = n));
      if (!answers) {
        privateLog("notices.fit.still_over", { ms: ctx.now().getTime() - started });
        return privateError(422, "still_over");
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
      return withActionEvent(ctx, access, "notice_ai", ask.kind, drafts);
    } catch (error) {
      if (!(error instanceof ChatError)) throw error;
      // D126: the model did not answer, so the alliance's daily count gets these units back.
      await giveBackAllowance(db, access, "ai", failed, countedAt);
      privateLog(`notices.${ask.kind}.${error.kind}`, { ms: ctx.now().getTime() - started });
      return privateError(FAILURE[error.kind], error.kind);
    }
  });
}
