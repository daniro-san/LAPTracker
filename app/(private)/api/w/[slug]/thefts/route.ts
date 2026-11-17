// /api/w/[slug]/thefts (issue 321): the thefts log. GET ?q= finds attackers among the players of the
// server's other tracked alliances; POST, a write (same origin, JSON), adds a typed theft, removes an
// entry, or sets an attacker's follow-up. Every answer is { ok: true }, the players found, or a code.
// Nothing here is logged.
import { z } from "zod";

import { requireWorkspace } from "@/lib/private/access";
import { isSameOriginJson, NO_STORE, privateError, requestCookies } from "@/lib/private/http";
import { SLUG } from "@/lib/private/sign-in";
import { FOLLOW_UP_STATES } from "@/lib/private/theft-groups";
import { addTheft, findAttackers, removeTheft, setFollowUp } from "@/lib/private/thefts";
import { parseQuery, withContext } from "@/lib/route";

const ROUTE = "/api/w/[slug]/thefts";

const uid = z.number().int().positive().max(Number.MAX_SAFE_INTEGER);
const note = z.string().max(500);

const body = z.discriminatedUnion("action", [
  z
    .object({
      action: z.literal("add"),
      attacker: z.union([
        z.object({ uid }).strict(),
        z.object({ name: z.string().max(64), tag: z.string().max(8) }).strict(),
      ]),
      victimUid: uid.nullable(),
      day: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      time: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
      stolen: z.literal("quest_rewards").nullable(),
      note,
    })
    .strict(),
  z
    .object({
      action: z.literal("remove"),
      id: z
        .number()
        .int()
        .positive()
        .max(2 ** 31 - 1),
    })
    .strict(),
  z
    .object({
      action: z.literal("follow"),
      attacker: z.string().min(1).max(200),
      state: z.enum(FOLLOW_UP_STATES),
      note,
    })
    .strict(),
]);

const search = z.object({ q: z.string().min(1).max(64) }).strict();

type Params = { params: Promise<{ slug: string }> };

export async function GET(request: Request, { params }: Params): Promise<Response> {
  const { slug } = await params;
  if (!SLUG.test(slug)) return privateError(404, "not_found");
  const query = parseQuery(request, search);
  if (!query) return privateError(400, "bad_request");
  return withContext(ROUTE, async (ctx, db) => {
    const access = await requireWorkspace(db, slug, requestCookies(request), ctx.now());
    if (!access.ok) return privateError(401, "signed_out");
    return Response.json(
      { players: await findAttackers(db, access, query.q) },
      { headers: NO_STORE },
    );
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
    const now = ctx.now();
    const access = await requireWorkspace(db, slug, requestCookies(request), now);
    if (!access.ok) return privateError(401, "signed_out");
    const result =
      input.action === "add"
        ? await addTheft(db, access, input, { now, zone: ctx.env.SERVER_TZ })
        : input.action === "remove"
          ? await removeTheft(db, access, input.id)
          : await setFollowUp(db, access, input, now);
    if (result !== "ok") return privateError(result === "not_found" ? 404 : 400, result);
    return Response.json({ ok: true }, { headers: NO_STORE });
  });
}
