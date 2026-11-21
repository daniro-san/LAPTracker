// Per-request CSP with a nonce: Next injects inline bootstrap scripts, so a static CSP would need
// 'unsafe-inline' for scripts, which plan §12.3 rules out. API routes (JSON) and /img get a fixed deny-all CSP.
// Vercel Web Analytics and Speed Insights (D36) need no extra source: a nonced Next chunk adds their script with
// createElement, which 'strict-dynamic' trusts ('self' in browsers without it), and they send to our own origin.
// PostHog (D77) needs none either: its SDK and replay recorder are our own chunks, and it sends to /ingest.
import { NextResponse, type NextRequest } from "next/server";

const API_CSP = "default-src 'none'; frame-ancestors 'none'";

export function pageCsp(nonce: string, dev: boolean): string {
  return [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${dev ? " 'unsafe-eval'" : ""}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "font-src 'self'",
    `connect-src 'self'${dev ? " ws:" : ""}`,
    // D148: the desk's service worker, /sw.js, for notifications. Without it, worker-src falls back to
    // script-src, where 'strict-dynamic' drops 'self'.
    "worker-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
  ].join("; ");
}

export function proxy(request: NextRequest): NextResponse {
  // Next's own trailing-slash redirect, which next.config skips so PostHog's /ingest/e/ arrives as sent (D77).
  const { pathname } = request.nextUrl;
  if (pathname.length > 1 && pathname.endsWith("/") && !pathname.startsWith("/ingest/")) {
    // A plain URL: a NextURL clone would put the slash back.
    const url = new URL(request.url);
    url.pathname = pathname.replace(/\/+$/, "");
    return NextResponse.redirect(url, 308);
  }
  const res = respond(request);
  // The workspace (D71): no shared or browser cache keeps a private page or answer.
  if (/^\/(api\/)?w(\/|$)/.test(request.nextUrl.pathname)) {
    res.headers.set("Cache-Control", "private, no-store");
  }
  return res;
}

function respond(request: NextRequest): NextResponse {
  const { pathname } = request.nextUrl;
  // Images from /img (D22) and PostHog's answers through /ingest (D77) get the same deny-all CSP: nothing in
  // them should ever run.
  if (/^\/(?:api|img|ingest)\//.test(pathname)) {
    const res = NextResponse.next();
    res.headers.set("Content-Security-Policy", API_CSP);
    return res;
  }
  const nonce = btoa(crypto.randomUUID());
  const csp = pageCsp(nonce, process.env.NODE_ENV === "development");
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set("Content-Security-Policy", csp);
  const res = NextResponse.next({ request: { headers: requestHeaders } });
  res.headers.set("Content-Security-Policy", csp);
  return res;
}

export const config = {
  matcher: [
    {
      source: "/((?!_next/static|_next/image|favicon.ico).*)",
      missing: [
        { type: "header", key: "next-router-prefetch" },
        { type: "header", key: "purpose", value: "prefetch" },
      ],
    },
  ],
};
