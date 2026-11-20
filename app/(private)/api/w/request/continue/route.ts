// GET /api/w/request/continue — "Continue" on an approved request (D130): the request's status secret opens
// the invite the owner made for it, so the requester goes on without a second link.
import { continueRequest, REQUEST_COOKIE } from "@/lib/private/access-request";
import { redirectWith, requestCookies } from "@/lib/private/http";
import { withContext } from "@/lib/route";

export function GET(request: Request): Promise<Response> {
  return withContext("/api/w/request/continue", async (ctx, db) => {
    const value = requestCookies(request).get(REQUEST_COOKIE)?.value;
    const cookie = await continueRequest(db, value, ctx.now());
    return cookie ? redirectWith("/w/invite", [cookie]) : redirectWith("/w/request", []);
  });
}
