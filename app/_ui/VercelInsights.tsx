"use client";
// Vercel Web Analytics and Speed Insights (D36). The root layout renders this on the production deployment only.
// Both scripts send the page URL. The query string and hash are cut first, so nothing a visitor typed
// (`/players?q=<name>`) leaves the browser.
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";

function withoutQuery<T extends { url: string }>(event: T): T {
  return { ...event, url: event.url.split(/[?#]/, 1)[0] };
}

export function VercelInsights() {
  return (
    <>
      <Analytics beforeSend={withoutQuery} />
      <SpeedInsights beforeSend={withoutQuery} />
    </>
  );
}
