// POST /api/w/[slug]/raid-prep — Alliance settings → Raid Shield check (D137, issue 474). Officers only: same
// origin, JSON, an officer's session (401 signed_out, D99). {nightMinute, morningMinute, resetRead,
// resetMinute, discord, language}: when the reads run (issue 859, each moved to the next 15-minute tick)
// and whether the leaders' channel gets the summary. 403 turned_off while the check is off (D134); 400
// out_of_range for a time outside its read's range; 409 event_window when a read's window meets an
// event's (D160), reads_overlap when it meets another read's; 429 rate_limited. A save counts as
// `ws_action` `raid_prep` / `save` and forgets the tick's kept facts (D141): the after-reset time opens
// the tick's gate.
import { requireWorkspace } from "@/lib/private/access";
import { withActionEvent } from "@/lib/private/desk-action";
import {
  isSameOriginJson,
  NO_STORE,
  privateError,
  privately,
  requestCookies,
} from "@/lib/private/http";
import { saveShield, shieldSettingsInput } from "@/lib/private/shield-settings";
import { SLUG } from "@/lib/private/sign-in";
import { withContext } from "@/lib/route";

const STATUS = {
  turned_off: 403,
  rate_limited: 429,
  out_of_range: 400,
  event_window: 409,
  reads_overlap: 409,
} as const;

export async function POST(
  request: Request,
  { params }: { params: Promise<{ slug: string }> },
): Promise<Response> {
  const { slug } = await params;
  if (!SLUG.test(slug)) return privateError(404, "not_found");
  if (!isSameOriginJson(request)) return privateError(403, "forbidden");
  const parsed = shieldSettingsInput.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return privateError(400, "bad_request");
  const input = parsed.data;
  return withContext("/api/w/[slug]/raid-prep", slug, async (ctx, db) => {
    const now = ctx.now();
    const access = await requireWorkspace(db, slug, requestCookies(request), now);
    if (!access.ok) return privateError(401, "signed_out");
    const done = await privately("raid_prep.save", () =>
      saveShield(db, access, input, { env: ctx.env, now }),
    );
    if (!done.ok) return privateError(STATUS[done.code], done.code);
    ctx.wakeCache.forget();
    const body = Response.json({ ok: true }, { headers: NO_STORE });
    return withActionEvent(ctx, access, "raid_prep", "save", body);
  });
}
