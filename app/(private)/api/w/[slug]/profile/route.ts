// /api/w/[slug]/profile (issue 334): the signed-in officer's own profile sheet. GET reads it; POST, a write
// (same origin, JSON), renames the officer or links and unlinks their player ("This is me"). Every answer
// is the profile as it now stands, or an error code. Nothing here is logged.
import { z } from "zod";

import { requireWorkspace } from "@/lib/private/access";
import { isSameOriginJson, NO_STORE, privateError, requestCookies } from "@/lib/private/http";
import { linkPlayer, profileView, renameOfficer, unlinkPlayer } from "@/lib/private/profile";
import { SLUG } from "@/lib/private/sign-in";
import { withContext } from "@/lib/route";

const ROUTE = "/api/w/[slug]/profile";

const body = z.discriminatedUnion("action", [
  z.object({ action: z.literal("rename"), name: z.string().max(200) }).strict(),
  z
    .object({
      action: z.literal("link"),
      uid: z.number().int().positive().max(Number.MAX_SAFE_INTEGER),
    })
    .strict(),
  z.object({ action: z.literal("unlink") }).strict(),
]);

type Params = { params: Promise<{ slug: string }> };

export async function GET(request: Request, { params }: Params): Promise<Response> {
  const { slug } = await params;
  if (!SLUG.test(slug)) return privateError(404, "not_found");
  return withContext(ROUTE, async (ctx, db) => {
    const access = await requireWorkspace(db, slug, requestCookies(request), ctx.now());
    if (!access.ok) return privateError(401, "signed_out");
    return Response.json(await profileView(db, access), { headers: NO_STORE });
  });
}

export async function POST(request: Request, { params }: Params): Promise<Response> {
  const { slug } = await params;
  if (!SLUG.test(slug)) return privateError(404, "not_found");
  if (!isSameOriginJson(request)) return privateError(403, "forbidden");
  const parsed = body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return privateError(400, "bad_request");
  const input = parsed.data;
  return withContext(ROUTE, async (ctx, db) => {
    const access = await requireWorkspace(db, slug, requestCookies(request), ctx.now());
    if (!access.ok) return privateError(401, "signed_out");
    const result =
      input.action === "rename"
        ? await renameOfficer(db, access, input.name)
        : input.action === "link"
          ? await linkPlayer(db, access, input.uid)
          : await unlinkPlayer(db, access);
    if (typeof result === "string") return privateError(400, result);
    return Response.json(result, { headers: NO_STORE });
  });
}
