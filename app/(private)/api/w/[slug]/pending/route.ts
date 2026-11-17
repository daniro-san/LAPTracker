// POST /api/w/[slug]/pending — new members added by hand before the roster lists them (D106): add one with
// its first facts (the add sheet's request id, D100), link one to a member of the newest roster, or delete
// one. Same origin and JSON only (D71), zod-parsed, a session of this workspace (401 signed_out, D99). An
// add whose facts met a newer save answers 409 with them, as the facts route does. Nothing is logged.
import { z } from "zod";

import { requireWorkspace } from "@/lib/private/access";
import {
  isSameOriginJson,
  NO_STORE,
  privateError,
  privately,
  requestCookies,
} from "@/lib/private/http";
import { FACT_CHANGE } from "@/lib/private/member-facts";
import { addPending, linkPending, removePending } from "@/lib/private/pending-members";
import { SLUG } from "@/lib/private/sign-in";
import { withContext } from "@/lib/route";

/** A pending member's uid is minus its serial id (Postgres integer). */
const pending = z.number().int().negative().min(-2147483647);
const body = z.discriminatedUnion("action", [
  z
    .object({
      action: z.literal("add"),
      requestId: z.uuid(),
      name: z.string().trim().min(1).max(64),
      changes: z
        .array(FACT_CHANGE)
        .max(8)
        .refine((c) => new Set(c.map((x) => x.field)).size === c.length),
    })
    .strict(),
  z
    .object({
      action: z.literal("link"),
      uid: pending,
      to: z.number().int().positive().max(Number.MAX_SAFE_INTEGER),
    })
    .strict(),
  z.object({ action: z.literal("delete"), uid: pending }).strict(),
]);

const answer = (status: number, data: object) => Response.json(data, { status, headers: NO_STORE });

export async function POST(
  request: Request,
  { params }: { params: Promise<{ slug: string }> },
): Promise<Response> {
  const { slug } = await params;
  if (!SLUG.test(slug)) return privateError(404, "not_found");
  if (!isSameOriginJson(request)) return privateError(403, "forbidden");
  const parsed = body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return privateError(400, "bad_request");
  const input = parsed.data;
  return withContext("/api/w/[slug]/pending", async (ctx, db) => {
    const access = await requireWorkspace(db, slug, requestCookies(request), ctx.now());
    if (!access.ok) return privateError(401, "signed_out");
    const now = ctx.now();
    if (input.action === "add") {
      const clock = { now, zone: ctx.env.SERVER_TZ };
      const added = await privately("pending.add", () => addPending(db, access, input, clock));
      if (!added) return privateError(400, "bad_name");
      const conflict = added.results.some((r) => r.status === "conflict");
      return answer(conflict ? 409 : 200, { ok: true, ...added });
    }
    if (input.action === "link") {
      const linked = await privately("pending.link", () =>
        linkPending(db, access, -input.uid, input.to, now),
      );
      if (linked === "ok") return answer(200, { ok: true });
      return privateError(linked === "not_member" ? 400 : 404, linked);
    }
    const gone = await privately("pending.delete", () => removePending(db, access, -input.uid));
    return gone ? answer(200, { ok: true }) : privateError(404, "not_found");
  });
}
