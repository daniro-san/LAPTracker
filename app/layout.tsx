// Root layout. Rendered per request so proxy.ts's CSP nonce reaches Next's inline scripts.
import type { Metadata, Viewport } from "next";
import { connection } from "next/server";
import type { ReactNode } from "react";

import { analyticsKey } from "@/lib/analytics/events";
import { fontVariables } from "@/lib/brand/fonts";
import { readTheme } from "@/lib/brand/theme";

import { AnalyticsConsent } from "./_ui/AnalyticsConsent";
import { requestCopy, requestLanguage } from "./_ui/locale";
import { LocaleProvider } from "./_ui/LocaleProvider";
import { PostHogAnalytics } from "./_ui/PostHogAnalytics";
import { VercelInsights } from "./_ui/VercelInsights";

import "./globals.css";

// viewport-fit=cover lets the page draw under the iPhone status bar and notch: the top bars pad themselves
// with env(safe-area-inset-top) and the bottom tabs with env(safe-area-inset-bottom). No themeColor: the
// header colour follows the theme cookie, which a media-query themeColor cannot, and the header now fills
// the status-bar area itself.
export const viewport: Viewport = { viewportFit: "cover" };

export async function generateMetadata(): Promise<Metadata> {
  const copy = await requestCopy();
  return { title: copy.site.name, description: copy.site.description };
}

export default async function RootLayout({ children }: { children: ReactNode }) {
  await connection();
  const [theme, { language, locale }, copy] = await Promise.all([
    readTheme(),
    requestLanguage(),
    requestCopy(),
  ]);
  const production = process.env.VERCEL_ENV === "production";
  // PostHog (D77): production only, like D36, and only once the owner has set the key.
  const posthogKey = analyticsKey(process.env);
  return (
    <html lang={language} data-theme={theme ?? undefined} className={fontVariables}>
      <body className="min-h-screen bg-paper font-body text-ink antialiased">
        <LocaleProvider locale={locale} copy={copy}>
          {children}
          {/* The analytics question on public pages (D115), where analytics is on. */}
          {posthogKey && <AnalyticsConsent />}
        </LocaleProvider>
        {/* Production deployment only: not previews, `next dev`, `next start` or tests (D36). */}
        {production && <VercelInsights />}
        {posthogKey && <PostHogAnalytics apiKey={posthogKey} />}
      </body>
    </html>
  );
}
