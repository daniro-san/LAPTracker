// Security headers that don't vary per request (plan §12.3). The nonce-based CSP lives in proxy.ts.
// `env` inlines the footer's live version at build time (D59).
import type { NextConfig } from "next";

import { buildVersion } from "./lib/build-version";

const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-Frame-Options", value: "DENY" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), payment=(), usb=()",
  },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  // Without this, `next dev` writes AGENTS.md into the repo (issue 126).
  agentRules: false,
  // PostHog's paths end in a slash (/ingest/e/, D77); proxy.ts keeps the slash redirect for every other path.
  skipTrailingSlashRedirect: true,
  env: { BUILD_VERSION: buildVersion(process.env) },
  // The OCR (D74, D96): Tesseract.js starts its worker from a file path at run time, so it is not bundled,
  // and the routes that read pictures ship its worker, its WebAssembly core and the English data. Keys are
  // route globs without the route group: `*` stands for [slug].
  serverExternalPackages: ["tesseract.js"],
  outputFileTracingIncludes: Object.fromEntries(
    ["/api/w/*/shots/read", "/api/discord/interactions"].map((route) => [
      route,
      [
        "./lib/screenshot/tessdata/**",
        "./node_modules/tesseract.js/src/**",
        "./node_modules/.pnpm/tesseract.js-core@*/node_modules/tesseract.js-core/**",
      ],
    ]),
  ),
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
