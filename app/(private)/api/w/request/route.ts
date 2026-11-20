// POST /api/w/request {union_id, name, role} — "Request a Desk" (D130, issue 453): no account, same origin,
// JSON, at most 3 a day per address and 30 a day for the site. Sets the status cookie and answers the status
// link and the roster match (`found` or `not_found`, for analytics only). The owner gets one line in the
// admin Discord channel. 409 `has_desk`: the alliance already has a workspace.
import { clientIp } from "@/lib/auth";
import { createNotifier } from "@/lib/notify";
import { accessRequestMessage } from "@/lib/notify-request";
import { requestInput, submitRequest } from "@/lib/private/access-request";
import { isSameOriginJson, NO_STORE, privateError } from "@/lib/private/http";
import { withContext } from "@/lib/route";

export async function POST(request: Request): Promise<Response> {
  if (!isSameOriginJson(request)) return privateError(403, "forbidden");
  const parsed = requestInput.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return privateError(400, "bad_request");
  return withContext("/api/w/request", async (ctx, db) => {
    const sent = await submitRequest(db, parsed.data, clientIp(request.headers), ctx.now());
    if (!sent.ok)
      return privateError(
        { has_desk: 409, rate_limited: 429, unknown_alliance: 400 }[sent.code],
        sent.code === "unknown_alliance" ? "bad_request" : sent.code,
      );
    const line = accessRequestMessage({
      unionId: parsed.data.union_id,
      ...sent.line,
      seenAt: sent.seenAt,
    });
    await createNotifier(ctx.env, ctx.fetch)
      .admin(line)
      .catch(() => null);
    const headers = new Headers(NO_STORE);
    headers.append("Set-Cookie", sent.cookie);
    return Response.json(
      { status: `/api/w/request/${sent.credential}`, match: sent.match },
      { headers },
    );
  });
}
