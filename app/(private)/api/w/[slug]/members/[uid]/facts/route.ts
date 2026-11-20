// POST /api/w/[slug]/members/[uid]/facts {changes} — an officer saves a member's facts (issue 297, D80):
// same origin, a JSON body and a session of this workspace (D71). Each field is written on its own: 200
// when every field was saved or combined, 409 with the newer value of each field another officer saved
// meanwhile (the others are saved). 404 when the uid is not in the workspace's own alliance, now or before
// (D107), nor one of its pending members (D106).
import { z } from "zod";

import { requireWorkspace } from "@/lib/private/access";
import { counted } from "@/lib/private/desk-action";
import {
  isSameOriginJson,
  NO_STORE,
  privateError,
  privately,
  requestCookies,
} from "@/lib/private/http";
import { FACT_CHANGE, saveFacts } from "@/lib/private/member-facts";
import { SLUG } from "@/lib/private/sign-in";
import { withContext } from "@/lib/route";

const body = z
  .object({
    changes: z
      .array(FACT_CHANGE)
      .min(1)
      .max(8)
      .refine((c) => new Set(c.map((x) => x.field)).size === c.length),
  })
  .strict();
/** A game uid, or a pending member's (minus its id, D106). */
const UID = /^-?[1-9]\d{0,15}$/;

export async function POST(
  request: Request,
  { params }: { params: Promise<{ slug: string; uid: string }> },
): Promise<Response> {
  const { slug, uid } = await params;
  if (!SLUG.test(slug) || !UID.test(uid)) return privateError(404, "not_found");
  if (!isSameOriginJson(request)) return privateError(403, "forbidden");
  const parsed = body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return privateError(400, "bad_request");
  return withContext("/api/w/[slug]/members/[uid]/facts", slug, async (ctx, db) => {
    const access = await requireWorkspace(db, slug, requestCookies(request), ctx.now());
    if (!access.ok) return privateError(401, "signed_out");
    const results = await privately("member_facts.save", () =>
      saveFacts(db, access, Number(uid), parsed.data.changes, ctx.now(), ctx.env.SERVER_TZ),
    );
    if (!results) return privateError(404, "not_member");
    const status = results.some((r) => r.status === "conflict") ? 409 : 200;
    const saved = Response.json({ results }, { status, headers: NO_STORE });
    return counted(ctx, access, "member_facts", "save", saved);
  });
}
