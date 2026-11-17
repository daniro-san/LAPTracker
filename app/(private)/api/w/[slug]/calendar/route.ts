// POST /api/w/[slug]/calendar — the Calendar tab's writes (issue 300): add an entry, change fields of one
// (each with the version the officer saw), or delete it. A write: same origin and a JSON body (D71). A
// field changed by someone else since answers 409 with its newer value in the officer's words (issue 293).
// The lib calls run in `privately`, so an error reaches app_errors as its code alone, never with what an
// officer typed.
import { z } from "zod";

import { requireWorkspace } from "@/lib/private/access";
import { createEntry, editEntry, removeEntry } from "@/lib/private/calendar";
import { fieldChange, newEntry } from "@/lib/private/calendar-model";
import { conflictSaid, conflictYours } from "@/lib/private/calendar-words";
import { WORKSPACE_LANG_COOKIE } from "@/lib/private/cookies";
import { pickWorkspaceLanguage, WORKSPACE_DICTIONARIES } from "@/lib/private/dictionary";
import {
  isSameOriginJson,
  NO_STORE,
  privately,
  privateError,
  requestCookies,
} from "@/lib/private/http";
import { SLUG } from "@/lib/private/sign-in";
import { withContext } from "@/lib/route";

const id = z.number().int().positive();
const body = z.discriminatedUnion("action", [
  z.object({ action: z.literal("create"), entry: newEntry, requestId: z.uuid() }).strict(),
  z
    .object({
      action: z.literal("edit"),
      entry: id,
      week: z.string().nullable(),
      changes: z.array(fieldChange).min(1).max(10),
    })
    .strict(),
  z
    .object({
      action: z.literal("delete"),
      entry: id,
      scope: z.enum(["all", "one", "after"]),
      week: z.string(),
    })
    .strict(),
]);

const ok = (extra: object = {}) => Response.json({ ok: true, ...extra }, { headers: NO_STORE });
const STATUS = { not_found: 404, invalid: 400, not_in_alliance: 400, same_person: 400 } as const;

export async function POST(
  request: Request,
  { params }: { params: Promise<{ slug: string }> },
): Promise<Response> {
  const { slug } = await params;
  if (!SLUG.test(slug)) return privateError(404, "not_found");
  if (!isSameOriginJson(request)) return privateError(403, "forbidden");
  const parsed = body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return privateError(400, "bad_request");
  const input = parsed.data;
  const jar = requestCookies(request);
  return withContext("/api/w/[slug]/calendar", async (ctx, db) => {
    const now = ctx.now();
    const access = await requireWorkspace(db, slug, jar, now);
    if (!access.ok) return privateError(401, "signed_out");
    if (input.action === "create") {
      const made = await privately("calendar.create", () =>
        createEntry(db, access, input.entry, input.requestId),
      );
      return made.ok ? ok({ id: made.id }) : privateError(409, made.code);
    }
    if (input.action === "delete") {
      const done = await privately("calendar.remove", () => removeEntry(db, access, input));
      return done === "ok" ? ok() : privateError(404, done);
    }
    const result = await privately("calendar.edit", () => editEntry(db, access, input, now));
    if (result.ok) return ok();
    if (result.code !== "stale") return privateError(STATUS[result.code], result.code);
    const language = pickWorkspaceLanguage(
      jar.get(WORKSPACE_LANG_COOKIE)?.value,
      request.headers.get("accept-language"),
    );
    const t = WORKSPACE_DICTIONARIES[language];
    const conflicts = result.conflicts.map((c) => ({
      field: c.field,
      version: c.version,
      said: conflictSaid(c, t, language, now),
      yours: conflictYours(c, t, language),
    }));
    return Response.json({ code: "stale", conflicts }, { status: 409, headers: NO_STORE });
  });
}
