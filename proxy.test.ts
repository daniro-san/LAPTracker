// proxy.ts, run as Next runs it: a real NextRequest in, the NextResponse's headers out. The workspace's pages
// and answers are never kept by a shared or browser cache (D71), and every page gets its own CSP nonce (D11).
import { NextRequest } from "next/server";
import { describe, expect, it } from "vitest";

import { proxy } from "./proxy";

const ORIGIN = "https://laptracker.test";
const run = (path: string) => proxy(new NextRequest(`${ORIGIN}${path}`));
/** The nonce Next hands the page's own scripts: the request header proxy.ts adds (x-nonce). */
const pageNonce = (res: Response) => res.headers.get("x-middleware-request-x-nonce");
const cspNonce = (res: Response) =>
  /script-src [^;]*'nonce-([^']+)'/.exec(res.headers.get("content-security-policy") ?? "")?.[1];

describe("the workspace's cache headers (D71)", () => {
  it("marks every page and answer under /w and /api/w private, no-store, and no public page", () => {
    const workspace = [
      "/w",
      "/w/lnk",
      "/w/lnk/members",
      "/w/lnk/board/me",
      "/api/w/lnk/members/101",
    ];
    for (const path of workspace) {
      expect(run(path).headers.get("cache-control"), path).toBe("private, no-store");
    }
    const open = ["/", "/players", "/players/101", "/events/2", "/api/events", "/img/avatar/101"];
    for (const path of open) expect(run(path).headers.get("cache-control"), path).toBeNull();
  });
});

describe("the page CSP's nonce (D11)", () => {
  it("gives two requests for the same page two different nonces", () => {
    const [first, second] = [cspNonce(run("/players")), cspNonce(run("/players"))];
    expect(first).toMatch(/^[A-Za-z0-9+/=]{20,}$/);
    expect(second).toMatch(/^[A-Za-z0-9+/=]{20,}$/);
    expect(first).not.toBe(second);
  });

  it("puts in script-src the same nonce the page's scripts are given", () => {
    for (const path of ["/", "/w/lnk/members"]) {
      const res = run(path);
      expect(res.headers.get("content-security-policy"), path).toContain("'strict-dynamic'");
      expect(cspNonce(res), path).toBe(pageNonce(res));
    }
  });

  it("gives API answers and /img pictures the deny-all policy, with no nonce (D11, D22)", () => {
    for (const path of ["/api/events", "/api/w/lnk/members/101", "/img/avatar/101"]) {
      const res = run(path);
      expect(res.headers.get("content-security-policy"), path).toBe(
        "default-src 'none'; frame-ancestors 'none'",
      );
      expect(pageNonce(res), path).toBeNull();
    }
  });
});
