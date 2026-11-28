// POST /api/w/[slug]/glossary — Alliance settings → Glossary (#832, D81 amendment). Officers only: same origin,
// JSON, an officer's session (401 signed_out, D99). {words}: the whole list, at most 100 words of 40
// characters once cleaned (400 invalid, 400 too_many); Undo is this call with the list before. 403
// turned_off while no translating feature is on (D126); 429 rate_limited. The words never leave in a log
// or an event.
import { requireWorkspace } from "@/lib/private/access";
import { glossaryInput, saveGlossaryFor } from "@/lib/private/glossary";
import {
  isSameOriginJson,
  NO_STORE,
  privateError,
  privately,
  requestCookies,
} from "@/lib/private/http";
import { SLUG } from "@/lib/private/sign-in";
import { withContext } from "@/lib/route";

const STATUS = { turned_off: 403, invalid: 400, too_many: 400, rate_limited: 429 } as const;

export async function POST(
  request: Request,
  { params }: { params: Promise<{ slug: string }> },
): Promise<Response> {
  const { slug } = await params;
  if (!SLUG.test(slug)) return privateError(404, "not_found");
  if (!isSameOriginJson(request)) return privateError(403, "forbidden");
  const parsed = glossaryInput.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return privateError(400, "bad_request");
  const input = parsed.data;
  return withContext("/api/w/[slug]/glossary", slug, async (ctx, db) => {
    const now = ctx.now();
    const access = await requireWorkspace(db, slug, requestCookies(request), now);
    if (!access.ok) return privateError(401, "signed_out");
    const done = await privately("glossary.save", () => saveGlossaryFor(db, access, input, now));
    if (!done.ok) return privateError(STATUS[done.code], done.code);
    return Response.json({ words: done.words }, { headers: NO_STORE });
  });
}
