// POST /api/admin/kvk-opponent — /admin's "KvK opponent" card (D152, issue 306): the opponent's server and up to
// 15 alliance tags for one scheduled event, or the war's result. Only the next scheduled event and the 4 before
// it; the server and tags only before the war and while no Before or After of it runs, and the server not once
// its Start read a tag. The result is admin-only. PIN only, with the PIN's rate limiter.
import { z } from "zod";

import { SERVER } from "@/config/alliances";
import type { AppContext } from "@/lib/app-context";
import { authorize } from "@/lib/auth";
import { MAX_OPPONENT_TAGS } from "@/lib/budget";
import type { Db } from "@/lib/db";
import { kvkEventTimes, opponentsAt, saveOpponent, setOpponentResult } from "@/lib/repo/kvk";
import { errorResponse, withContext } from "@/lib/route";
import { nextEvent } from "@/lib/schedule";

/** A tag as one path segment of the by-tag lookup: 1–12 characters after NFC, no space, no `/ ? # % \`, no
 * control character, not dots only (`..` would leave the segment). Case-sensitive (plan §2). */
const tag = z
  .string()
  .transform((s) => s.normalize("NFC"))
  .refine((s) => [...s].length >= 1 && [...s].length <= 12)
  .refine((s) => !/[\s/?#%\\\p{Cc}]/u.test(s) && !/^\.+$/.test(s));

const eventAt = z.iso.datetime().transform((s) => new Date(s));

const body = z.union([
  z
    .object({
      event_at: eventAt,
      server: z
        .number()
        .int()
        .min(1)
        .max(9999)
        .refine((n) => n !== SERVER),
      tags: z.array(tag).max(MAX_OPPONENT_TAGS),
    })
    .strict(),
  z.object({ event_at: eventAt, result: z.enum(["won", "lost"]).nullable() }).strict(),
]);

type Input = z.infer<typeof body>;

/** The write itself: the result, or the server and tags; an error answer, else null. */
async function write(ctx: AppContext, db: Db, input: Input, now: Date): Promise<Response | null> {
  if ("result" in input) {
    const saved = await setOpponentResult(db, input.event_at, input.result, now);
    return saved ? null : errorResponse(404, "no_opponent");
  }
  // Duplicates dropped as typed, case-sensitively: `abc` and `ABC` are two tags.
  const tags = [...new Set(input.tags)];
  const opponent = { eventAt: input.event_at, server: input.server, tags };
  const refused = await saveOpponent(db, opponent, now);
  if (refused) return errorResponse(409, refused);
  // INVARIANT cache.write-invalidates-reads (D143): the event page reads the opponent.
  ctx.publicCache.invalidate();
  return null;
}

export function POST(request: Request): Promise<Response> {
  return withContext("/api/admin/kvk-opponent", async (ctx, db) => {
    const auth = await authorize(request.headers, db, ctx, { cron: false, pin: true });
    if (!auth.ok) return errorResponse(auth.status, auth.code);
    const parsed = body.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return errorResponse(400, "bad_request");
    const input = parsed.data;
    const now = ctx.now();
    const times = await kvkEventTimes(db, nextEvent(now, ctx.env).eventAtUtc);
    if (!times.some((t) => t.getTime() === input.event_at.getTime()))
      return errorResponse(404, "not_a_kvk");
    const refused = await write(ctx, db, input, now);
    if (refused) return refused;
    const [o] = await opponentsAt(db, [input.event_at]);
    return Response.json({
      event_at: input.event_at.toISOString(),
      server: o?.server ?? null,
      tags: o?.tags ?? [],
      result: o?.result ?? null,
    });
  });
}
