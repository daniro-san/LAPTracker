// POST /api/w/[slug]/start-here {changes} — saves the changed languages of the members' board's Start here
// (D105). A write for officers only: same origin, JSON, an officer's session (a member's answers 401). A
// language someone saved after the version the officer was looking at answers 409 with who and when, and
// nothing is written (issue 293).
import { requireWorkspace } from "@/lib/private/access";
import { counted } from "@/lib/private/desk-action";
import { isSameOriginJson, NO_STORE, privateError, requestCookies } from "@/lib/private/http";
import { SLUG } from "@/lib/private/sign-in";
import { saveStartHere, startHereSave } from "@/lib/private/start-here";
import { withContext } from "@/lib/route";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ slug: string }> },
): Promise<Response> {
  const { slug } = await params;
  if (!SLUG.test(slug)) return privateError(404, "not_found");
  if (!isSameOriginJson(request)) return privateError(403, "forbidden");
  const parsed = startHereSave.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return privateError(400, "bad_request");
  return withContext("/api/w/[slug]/start-here", async (ctx, db) => {
    const now = ctx.now();
    const access = await requireWorkspace(db, slug, requestCookies(request), now);
    if (!access.ok) return privateError(401, "signed_out");
    const result = await saveStartHere(db, access, parsed.data, now);
    if (result.ok) {
      const saved = Response.json({ version: result.version }, { headers: NO_STORE });
      return counted(ctx, access, "start_here", "edit", saved);
    }
    return Response.json(
      { code: "conflict", conflicts: result.conflicts },
      { status: 409, headers: NO_STORE },
    );
  });
}
