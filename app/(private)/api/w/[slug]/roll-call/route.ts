// POST /api/w/[slug]/roll-call — the Roll call tab's writes (issue 298, D103): add a roll call by hand
// (with the add sheet's request id, D100), mark one member (with the version the officer saw), mark "the
// rest", undo that, pick or drop Elixir Scramble team members, delete a roll call or take the officer's own
// delete back within 60 s (its request id, D120), and archive or unarchive one. Same origin and JSON only (D71), zod-
// parsed, a session of this workspace (401 signed_out, D99). A mark another officer changed since answers
// 409 with the newer mark in the officer's words. The lib calls run in `privately`; nothing is logged.
import { z } from "zod";

import type { DeskAction } from "@/lib/analytics/server";
import { requireWorkspace } from "@/lib/private/access";
import { isDay } from "@/lib/private/calendar-time";
import { WORKSPACE_LANG_COOKIE } from "@/lib/private/cookies";
import { counted } from "@/lib/private/desk-action";
import { pickWorkspaceLanguage, WORKSPACE_DICTIONARIES } from "@/lib/private/dictionary";
import {
  isSameOriginJson,
  NO_STORE,
  privately,
  privateError,
  requestCookies,
} from "@/lib/private/http";
import {
  addCall,
  archiveCall,
  deleteCall,
  markOne,
  markRest,
  undoMarks,
} from "@/lib/private/roll-call";
import { ADDED_KINDS, MARKS } from "@/lib/private/roll-call-rules";
import { setTeam } from "@/lib/private/roll-call-team";
import { staleSaid } from "@/lib/private/roll-call-words";
import { SLUG } from "@/lib/private/sign-in";
import { withContext } from "@/lib/route";

/** A serial id (Postgres integer). */
const id = z.number().int().positive().max(2147483647);
const uid = z.number().int().positive().max(Number.MAX_SAFE_INTEGER);
const day = z.string().refine(isDay);
const occasion = z.union([z.object({ id }).strict(), z.object({ entry: id, week: day }).strict()]);
const uids = z.array(uid).min(1).max(150);
const body = z.discriminatedUnion("action", [
  z
    .object({
      action: z.literal("add"),
      kind: z.enum(ADDED_KINDS),
      day,
      requestId: z.uuid(),
    })
    .strict(),
  z
    .object({
      action: z.literal("mark"),
      occasion,
      uid,
      mark: z.enum(MARKS).nullable(),
      version: z.number().int().min(0),
    })
    .strict(),
  z.object({ action: z.literal("rest"), occasion, uids }).strict(),
  z
    .object({
      action: z.literal("undo"),
      occasion,
      items: z
        .array(z.object({ uid, version: z.number().int().min(1) }).strict())
        .min(1)
        .max(150),
    })
    .strict(),
  z.object({ action: z.literal("team"), occasion, uids, on: z.boolean() }).strict(),
  z
    .object({
      action: z.literal("delete"),
      id,
      requestId: z.uuid(),
      undo: z.literal(true).optional(),
    })
    .strict(),
  z.object({ action: z.literal("archive"), id, on: z.boolean() }).strict(),
]);
type Body = z.infer<typeof body>;

const ok = (extra: object = {}) => Response.json({ ok: true, ...extra }, { headers: NO_STORE });
const STATUS = { not_found: 404, not_member: 400, invalid: 400, full: 409, other_team: 409 };

type Access = Extract<Awaited<ReturnType<typeof requireWorkspace>>, { ok: true }>;
type Ctx = {
  db: Parameters<typeof addCall>[0];
  access: Access;
  now: Date;
  /** The server's zone (SERVER_TZ). */
  zone: string;
  request: Request;
};

/** A refused mark: the newer one, who set it and when, in the officer's words. */
async function mark(input: Extract<Body, { action: "mark" }>, c: Ctx) {
  const result = await privately("roll_call.mark", () => markOne(c.db, c.access, input, c.now));
  if (result.ok) return ok({ version: result.version });
  if (result.code !== "stale") return privateError(STATUS[result.code], result.code);
  const language = pickWorkspaceLanguage(
    requestCookies(c.request).get(WORKSPACE_LANG_COOKIE)?.value,
    c.request.headers.get("accept-language"),
  );
  const n = result.newest;
  const said = staleSaid(n, result.kind, WORKSPACE_DICTIONARIES[language], language, c.now);
  return Response.json(
    { code: "stale", mark: n?.mark ?? null, version: n?.version ?? 0, said },
    { status: 409, headers: NO_STORE },
  );
}

async function run(input: Body, c: Ctx): Promise<Response> {
  const { db, access, now } = c;
  switch (input.action) {
    case "add": {
      const made = await privately("roll_call.add", () =>
        addCall(db, access, input, input.requestId),
      );
      return ok({ id: made.id });
    }
    case "mark":
      return mark(input, c);
    case "delete": {
      const done = await privately("roll_call.delete", () => deleteCall(db, access, input, now));
      return done === "ok" ? ok() : privateError(404, done);
    }
    case "archive": {
      const done = await privately("roll_call.archive", () => archiveCall(db, access, input, now));
      return done === "ok" ? ok() : privateError(404, done);
    }
    case "team": {
      const done = await privately("roll_call.team", () => setTeam(db, access, input, now));
      return done.ok ? ok(done) : privateError(STATUS[done.code], done.code);
    }
    default: {
      const done = await privately(`roll_call.${input.action}`, () =>
        input.action === "rest"
          ? markRest(db, access, input, { now, zone: c.zone })
          : undoMarks(db, access, input, now),
      );
      return done.ok ? ok(done) : privateError(STATUS[done.code], done.code);
    }
  }
}

/** The ws_action word (D115): a delete's Undo, an archive and an unarchive have their own. */
function deskAction(input: Body): DeskAction {
  if (input.action === "delete") return input.undo ? "undo_delete" : "delete";
  if (input.action === "archive") return input.on ? "archive" : "unarchive";
  return input.action;
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ slug: string }> },
): Promise<Response> {
  const { slug } = await params;
  if (!SLUG.test(slug)) return privateError(404, "not_found");
  if (!isSameOriginJson(request)) return privateError(403, "forbidden");
  const parsed = body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return privateError(400, "bad_request");
  const jar = requestCookies(request);
  return withContext("/api/w/[slug]/roll-call", async (ctx, db) => {
    const now = ctx.now();
    const access = await requireWorkspace(db, slug, jar, now);
    if (!access.ok) return privateError(401, "signed_out");
    const answer = await run(parsed.data, { db, access, now, zone: ctx.env.SERVER_TZ, request });
    return counted(ctx, access, "roll_call", deskAction(parsed.data), answer);
  });
}
