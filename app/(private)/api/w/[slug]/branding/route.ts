// POST /api/w/[slug]/branding — Alliance settings → Branding (issue 462, D167). Officers only: same origin,
// JSON, an officer's session (401 signed_out, D99), so the settings are always the session's own workspace's.
// {title, icon, accent}: the tab title ("" for the default, at most 40 characters once cleaned: 400 too_long),
// the icon ("badge" | "discord" | "mark"; 400 no_discord_icon when the server has none or the bot cannot read
// it) and one of the curated accents. 429 rate_limited. The title never leaves in a log.
import { requireWorkspace } from "@/lib/private/access";
import { brandingInput, saveBrandingFor } from "@/lib/private/branding";
import {
  isSameOriginJson,
  NO_STORE,
  privateError,
  privately,
  requestCookies,
} from "@/lib/private/http";
import { SLUG } from "@/lib/private/sign-in";
import { withContext } from "@/lib/route";

const STATUS = { too_long: 400, no_discord_icon: 400, rate_limited: 429 } as const;

export async function POST(
  request: Request,
  { params }: { params: Promise<{ slug: string }> },
): Promise<Response> {
  const { slug } = await params;
  if (!SLUG.test(slug)) return privateError(404, "not_found");
  if (!isSameOriginJson(request)) return privateError(403, "forbidden");
  const parsed = brandingInput.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return privateError(400, "bad_request");
  const input = parsed.data;
  return withContext("/api/w/[slug]/branding", slug, async (ctx, db) => {
    const now = ctx.now();
    const access = await requireWorkspace(db, slug, requestCookies(request), now);
    if (!access.ok) return privateError(401, "signed_out");
    const deps = { env: ctx.env, fetch: ctx.fetch, now };
    const done = await privately("branding.save", () => saveBrandingFor(db, access, input, deps));
    if (!done.ok) return privateError(STATUS[done.code], done.code);
    return Response.json(
      { title: done.title, custom: done.custom, icon: input.icon, accent: input.accent },
      { headers: NO_STORE },
    );
  });
}
