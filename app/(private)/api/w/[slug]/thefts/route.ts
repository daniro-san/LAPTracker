// /api/w/[slug]/thefts (issue 321): the thefts log. GET ?q= finds attackers among the players of the
// other tracked alliances; POST, a write (same origin, JSON), adds a typed theft, deletes an entry (or takes
// the officer's own delete back for a short while, D123), sets an attacker's follow-up step, or sets an
// attacker's server. Every answer is { ok: true }, the players found, or a code. The work runs
// in `privately`, so an error reaches app_errors as its code alone, never with what an officer typed.
import { z } from "zod";

import { requireWorkspace } from "@/lib/private/access";
import { counted } from "@/lib/private/desk-action";
import { featureOn } from "@/lib/private/features";
import {
  isSameOriginJson,
  NO_STORE,
  privateError,
  privately,
  requestCookies,
} from "@/lib/private/http";
import { SLUG } from "@/lib/private/sign-in";
import { FOLLOW_UP_STATES, THEFT_KINDS } from "@/lib/private/theft-groups";
import { addTheft, findAttackers, removeTheft, setFollowUp, setServer } from "@/lib/private/thefts";
import { parseQuery, withContext } from "@/lib/route";

const ROUTE = "/api/w/[slug]/thefts";

const uid = z.number().int().positive().max(Number.MAX_SAFE_INTEGER);
const note = z.string().max(500);
const attacker = z.string().min(1).max(200);

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
      kind: z.enum(THEFT_KINDS),
      note,
      requestId: z.uuid(),
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
      requestId: z.uuid(),
      undo: z.literal(true).optional(),
    })
    .strict(),
  z
    .object({
      action: z.literal("follow"),
      attacker,
      state: z.enum(FOLLOW_UP_STATES),
      note,
      requestId: z.uuid(),
      // The newest step the officer saw (null: none); another officer's newer step makes this a 409.
      expected: z
        .number()
        .int()
        .positive()
        .max(2 ** 31 - 1)
        .nullable(),
    })
    .strict(),
  z
    .object({
      action: z.literal("server"),
      attacker,
      server: z.number().int().min(1).max(99_999).nullable(),
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
  return withContext(ROUTE, slug, async (ctx, db) => {
    const access = await requireWorkspace(db, slug, requestCookies(request), ctx.now());
    if (!access.ok) return privateError(401, "signed_out");
    if (!featureOn(access, "thefts")) return privateError(403, "turned_off");
    const players = await privately("thefts.search", () => findAttackers(db, access, query.q));
    return Response.json({ players }, { headers: NO_STORE });
  });
}

export async function POST(request: Request, { params }: Params): Promise<Response> {
  const { slug } = await params;
  if (!SLUG.test(slug)) return privateError(404, "not_found");
  if (!isSameOriginJson(request)) return privateError(403, "forbidden");
  const parsed = body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return privateError(400, "bad_request");
  const input = parsed.data;
  return withContext(ROUTE, slug, async (ctx, db) => {
    const now = ctx.now();
    const access = await requireWorkspace(db, slug, requestCookies(request), now);
    if (!access.ok) return privateError(401, "signed_out");
    if (!featureOn(access, "thefts")) return privateError(403, "turned_off");
    const result = await privately(`thefts.${input.action}`, () => {
      switch (input.action) {
        case "add":
          return addTheft(db, access, input, { now, zone: ctx.env.SERVER_TZ });
        case "remove":
          return removeTheft(db, access, input, now);
        case "follow":
          return setFollowUp(db, access, input, now);
        case "server":
          return setServer(db, access, input, now);
      }
    });
    if (result !== "ok") {
      const status = result === "not_found" ? 404 : result === "conflict" ? 409 : 400;
      return privateError(status, result);
    }
    // ws_action (D115, D123): the deleter's Undo is undo_delete; an attacker's server is an edit.
    const action =
      input.action === "remove"
        ? input.undo
          ? "undo_delete"
          : "delete"
        : ({ add: "add", follow: "record", server: "edit" } as const)[input.action];
    return counted(
      ctx,
      access,
      "theft",
      action,
      Response.json({ ok: true }, { headers: NO_STORE }),
    );
  });
}
