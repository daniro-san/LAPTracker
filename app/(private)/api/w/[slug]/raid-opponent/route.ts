// POST /api/w/[slug]/raid-opponent — Raid prep → This week's raid opponent (issue 861, D165). Officers only:
// same origin, JSON, an officer's session (401 signed_out, D99). Bodies:
//   {action: "set", saturday, server, tag}  → 200 {undo}: one read by tag on the alliance's own key (D124)
//     checks the alliance; `undo` is the opponent it replaced, or null
//   {action: "clear", saturday}             → 200 {undo}: the opponent cleared, for Undo
//   {action: "undo", saturday, id}          → 200: that opponent is current again, with no call; 404 gone
//   {action: "times", startMinute, endMinute} → 200: the Start and End reads' times, each moved to the next tick
// 403 turned_off while Raid prep's switch is off (D126); 409 raid_over once the raid's End read is past;
// 409 no_key: no key reads now (never LAP_API_KEY for another workspace); 503 quota_low: the site key's
// reserve; 404 not_found, 409 not_unique / wrong_server / own_alliance, 502 unavailable from the check;
// 400 out_of_range, 409 event_window / reads_overlap for the times (D160, D137); 429 rate_limited. A 2xx
// counts as `ws_action` `raid_opponent` / `save`, `edit`, `delete` or `undo` and forgets the tick's kept facts (D141): the tick's
// gate opens on a raid read's ticks only while some workspace has an opponent set.
import { requireWorkspace } from "@/lib/private/access";
import { withActionEvent } from "@/lib/private/desk-action";
import {
  isSameOriginJson,
  NO_STORE,
  privateError,
  privately,
  requestCookies,
} from "@/lib/private/http";
import { raidOpponentInput, saveRaidOpponent } from "@/lib/private/raid-opponent";
import { SLUG } from "@/lib/private/sign-in";
import { withContext } from "@/lib/route";

const STATUS = {
  turned_off: 403,
  rate_limited: 429,
  raid_over: 409,
  no_key: 409,
  quota_low: 503,
  not_found: 404,
  not_unique: 409,
  wrong_server: 409,
  own_alliance: 409,
  unavailable: 502,
  gone: 404,
  out_of_range: 400,
  event_window: 409,
  reads_overlap: 409,
} as const;

/** The `ws_action` word of each action (D115). */
const ACTION = { set: "save", times: "edit", clear: "delete", undo: "undo" } as const;

export async function POST(
  request: Request,
  { params }: { params: Promise<{ slug: string }> },
): Promise<Response> {
  const { slug } = await params;
  if (!SLUG.test(slug)) return privateError(404, "not_found");
  if (!isSameOriginJson(request)) return privateError(403, "forbidden");
  const parsed = raidOpponentInput.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return privateError(400, "bad_request");
  const input = parsed.data;
  return withContext("/api/w/[slug]/raid-opponent", slug, async (ctx, db) => {
    const now = ctx.now();
    const access = await requireWorkspace(db, slug, requestCookies(request), now);
    if (!access.ok) return privateError(401, "signed_out");
    const deps = { v1: ctx.v1, secret: ctx.env.WORKSPACE_KEYS_SECRET, now, env: ctx.env };
    const done = await privately("raid_opponent.save", () =>
      saveRaidOpponent(db, deps, access, input),
    );
    if (!done.ok) return privateError(STATUS[done.code], done.code);
    ctx.wakeCache.forget();
    const body = Response.json({ undo: done.undo }, { headers: NO_STORE });
    return withActionEvent(ctx, access, "raid_opponent", ACTION[input.action], body);
  });
}
