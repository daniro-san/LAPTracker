// POST /api/w/[slug]/import {csv, apply, decisions} — the one-time sheet import (issue 297, D80): same
// origin, a JSON body and a session of this workspace (D71). `apply: false` reads the sheet and answers
// how each row matches a member; `apply: true` writes it once every open row has a person's decision.
// The sheet is read in memory and never stored or logged; only its facts and the confirmed names stay.
import { z } from "zod";

import { requireWorkspace } from "@/lib/private/access";
import {
  isSameOriginJson,
  NO_STORE,
  privateError,
  privately,
  requestCookies,
} from "@/lib/private/http";
import { applyImport, previewImport } from "@/lib/private/sheet-import";
import { SLUG } from "@/lib/private/sign-in";
import { withContext } from "@/lib/route";

const body = z
  .object({
    csv: z.string().min(1).max(300_000),
    apply: z.boolean(),
    decisions: z
      .array(
        z
          .object({ line: z.number().int().min(1), uid: z.number().int().positive().nullable() })
          .strict(),
      )
      .max(2000),
  })
  .strict();

const REFUSED = { no_name_column: 422, undecided: 409, not_member: 400 } as const;

export async function POST(
  request: Request,
  { params }: { params: Promise<{ slug: string }> },
): Promise<Response> {
  const { slug } = await params;
  if (!SLUG.test(slug)) return privateError(404, "not_found");
  if (!isSameOriginJson(request)) return privateError(403, "forbidden");
  const parsed = body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return privateError(400, "bad_request");
  const { csv, apply, decisions } = parsed.data;
  return withContext("/api/w/[slug]/import", async (ctx, db) => {
    const access = await requireWorkspace(db, slug, requestCookies(request), ctx.now());
    if (!access.ok) return privateError(401, "signed_out");
    const where = { now: ctx.now(), serverZone: ctx.env.SERVER_TZ };
    if (!apply) {
      const preview = await privately("sheet_import.preview", () =>
        previewImport(db, access, csv, where),
      );
      if (!preview) return privateError(REFUSED.no_name_column, "no_name_column");
      return Response.json(preview, { headers: NO_STORE });
    }
    const result = await privately("sheet_import.apply", () =>
      applyImport(db, access, csv, decisions, where),
    );
    if (typeof result === "string") return privateError(REFUSED[result], result);
    return Response.json(result, { headers: NO_STORE });
  });
}
