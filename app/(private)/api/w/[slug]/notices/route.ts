// POST /api/w/[slug]/notices {id?, changes} — saves a notice's changed fields (issue 304), or makes a new
// notice when there is no id. A write: same origin, JSON, a valid session. A field someone else saved after
// the version the officer was looking at answers 409 with the newer text, and nothing is written (issue 293).
import { requireWorkspace } from "@/lib/private/access";
import { isSameOriginJson, NO_STORE, privateError, requestCookies } from "@/lib/private/http";
import { noticeSave, saveNotice } from "@/lib/private/notices";
import { SLUG } from "@/lib/private/sign-in";
import { withContext } from "@/lib/route";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ slug: string }> },
): Promise<Response> {
  const { slug } = await params;
  if (!SLUG.test(slug)) return privateError(404, "not_found");
  if (!isSameOriginJson(request)) return privateError(403, "forbidden");
  const parsed = noticeSave.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return privateError(400, "bad_request");
  return withContext("/api/w/[slug]/notices", async (ctx, db) => {
    const now = ctx.now();
    const access = await requireWorkspace(db, slug, requestCookies(request), now);
    if (!access.ok) return privateError(401, "signed_out");
    const { id, changes, requestId } = parsed.data;
    const result = await saveNotice(db, access, id ?? null, changes, now, requestId ?? null);
    if (result.ok) return Response.json({ id: result.id }, { headers: NO_STORE });
    if (result.reason === "conflict") {
      return Response.json(
        { code: "conflict", conflicts: result.conflicts },
        { status: 409, headers: NO_STORE },
      );
    }
    return privateError(result.reason === "not_found" ? 404 : 400, result.reason);
  });
}
