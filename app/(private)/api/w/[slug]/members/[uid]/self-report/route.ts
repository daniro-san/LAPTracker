// POST /api/w/[slug]/members/[uid]/self-report (D154, issue 301): an officer answers what a member sent about
// themselves, as the card showed it (the user, the field, its version). "use" puts it on the card: the
// fact's next version with source `member`, named by the fact version the card showed (D80), so another
// officer's newer save is refused with 409 and its value; "seen" only marks it seen. Same origin, JSON, an
// officer of this workspace (requireWorkspace). 404 `changed` when the report is no longer that one (the
// member sent again, their link was removed, they left); 409 `removed` for "use" on a taken-back report.
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
import { answerReport, REPORT_FIELDS } from "@/lib/private/self-report";
import { SLUG } from "@/lib/private/sign-in";
import { withContext } from "@/lib/route";

const INT = z.number().int().max(2_147_483_647);
const body = z.discriminatedUnion("action", [
  z
    .object({
      action: z.literal("use"),
      user: INT.positive(),
      field: z.enum(REPORT_FIELDS),
      version: INT.positive(),
      factVersion: INT.min(0),
    })
    .strict(),
  z
    .object({
      action: z.literal("seen"),
      user: INT.positive(),
      field: z.enum(REPORT_FIELDS),
      version: INT.positive(),
    })
    .strict(),
]);
/** A game uid: pending members (D106) have no link, so no report. */
const UID = /^[1-9]\d{0,15}$/;

export async function POST(
  request: Request,
  { params }: { params: Promise<{ slug: string; uid: string }> },
): Promise<Response> {
  const { slug, uid } = await params;
  if (!SLUG.test(slug) || !UID.test(uid)) return privateError(404, "not_found");
  if (!isSameOriginJson(request)) return privateError(403, "forbidden");
  const parsed = body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return privateError(400, "bad_request");
  const input = parsed.data;
  return withContext("/api/w/[slug]/members/[uid]/self-report", slug, async (ctx, db) => {
    const access = await requireWorkspace(db, slug, requestCookies(request), ctx.now());
    if (!access.ok) return privateError(401, "signed_out");
    const result = await privately("self_report.answer", () =>
      answerReport(db, access, Number(uid), input, ctx.now()),
    );
    if (result === "changed") return privateError(404, "changed");
    if (result === "removed") return privateError(409, "removed");
    if (result !== "ok") return Response.json(result.conflict, { status: 409, headers: NO_STORE });
    const done = Response.json({ ok: true }, { headers: NO_STORE });
    return counted(ctx, access, "self_report", input.action === "use" ? "accept" : "mark", done);
  });
}
