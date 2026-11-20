// GET /api/w/invite/<id>.<secret> — the link the owner sends a new alliance (D130, issue 453). The secret is
// traded for an HttpOnly cookie and the browser goes to /w/invite, so it never sits in the page's address,
// analytics or a Referer. A wrong link counts under the IP (D73's limits) and goes to the page, which says so.
import { clientIp } from "@/lib/auth";
import { privateError, redirectWith } from "@/lib/private/http";
import { openInviteLink } from "@/lib/private/invite";
import { withContext } from "@/lib/route";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ token: string }> },
): Promise<Response> {
  const { token } = await params;
  return withContext("/api/w/invite/[token]", async (ctx, db) => {
    const opened = await openInviteLink(db, token, clientIp(request.headers), ctx.now());
    if (opened.ok) return redirectWith("/w/invite", [opened.cookie]);
    if (opened.code === "rate_limited") return privateError(429, "rate_limited");
    return redirectWith("/w/invite?e=link", []);
  });
}
