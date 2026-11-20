// GET /api/w/request/<id>.<secret> — a request's status link (D130): sets the status cookie and goes to
// /w/request, so the answer opens on another device. A wrong link counts under the IP (D73's limits).
import { clientIp } from "@/lib/auth";
import { openRequestLink } from "@/lib/private/access-request";
import { privateError, redirectWith } from "@/lib/private/http";
import { withContext } from "@/lib/route";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ token: string }> },
): Promise<Response> {
  const { token } = await params;
  return withContext("/api/w/request/[token]", async (ctx, db) => {
    const opened = await openRequestLink(db, token, clientIp(request.headers), ctx.now());
    if (opened === "rate_limited") return privateError(429, "rate_limited");
    if (opened === "bad_link") return redirectWith("/w/request?e=link", []);
    return redirectWith("/w/request", [opened]);
  });
}
