// POST /api/admin/kvk-opponent — /admin's "KvK opponent" card (D152, issue 306): the opponent's server and up to
// 15 alliance tags for one scheduled event, or the war's result. Only the next KvK and the KvKs among the 4
// scheduled events before it (an Origin of Chaos is not one, #806); the server and tags only before the war and while no Before or After of it runs, and the server not once
// its Start read a tag. The result is admin-only. PIN only, with the PIN's rate limiter. A save of a server, or
// the "Suggest tags" press, reads that server's ranks board once for the KvK (D155): no quota, /admin only.
import { z } from "zod";

import { SERVER } from "@/config/alliances";
import type { AppContext } from "@/lib/app-context";
import { authorize } from "@/lib/auth";
import { MAX_OPPONENT_TAGS } from "@/lib/budget";
import type { Db } from "@/lib/db";
import { opponentTag } from "@/lib/kvk";
import { suggestTags } from "@/lib/opponent-suggest";
import { kvkTimes } from "@/lib/queries/admin-kvk";
import { opponentsAt, saveOpponent, setOpponentResult } from "@/lib/repo/kvk";
import { errorResponse, withContext } from "@/lib/route";
import { nextKvk } from "@/lib/schedule";

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
      tags: z.array(opponentTag).max(MAX_OPPONENT_TAGS),
    })
    .strict(),
  z.object({ event_at: eventAt, result: z.enum(["won", "lost"]).nullable() }).strict(),
  z.object({ event_at: eventAt, suggest: z.literal(true) }).strict(),
]);

type Input = z.infer<typeof body>;

/** The write itself: the result, the board's suggestion, or the server and tags; an error answer, else null. */
async function write(ctx: AppContext, db: Db, input: Input, now: Date): Promise<Response | null> {
  if ("suggest" in input) {
    const outcome = await suggestTags(ctx, db, input.event_at, now, true);
    if (outcome === "no_opponent") return errorResponse(404, outcome);
    if (outcome === "war_started" || outcome === "opponent_read")
      return errorResponse(409, outcome);
    return null;
  }
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
  // The board's read, once per (KvK, server); its failure or refusal leaves the save as it is (D155).
  await suggestTags(ctx, db, input.event_at, now, false);
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
    const times = await kvkTimes(db, nextKvk(now, ctx.env).eventAtUtc, ctx.env);
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
