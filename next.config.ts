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
  env: { BUILD_VERSION: buildVersion(process.env) },
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
