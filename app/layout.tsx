// Root layout. Rendered per request so proxy.ts's CSP nonce reaches Next's inline scripts.
import type { Metadata } from "next";
import { connection } from "next/server";
import type { ReactNode } from "react";

import { fontVariables } from "@/lib/brand/fonts";
import { readTheme } from "@/lib/brand/theme";

import { requestCopy, requestLanguage } from "./_ui/locale";
import { LocaleProvider } from "./_ui/LocaleProvider";
import { UpstreamBanner } from "./_ui/UpstreamBanner";
import { VercelInsights } from "./_ui/VercelInsights";

import "./globals.css";

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
  return (
    <html lang={language} data-theme={theme ?? undefined} className={fontVariables}>
      <body className="min-h-screen bg-paper font-body text-ink antialiased">
        <LocaleProvider locale={locale} copy={copy}>
          <UpstreamBanner />
          {children}
        </LocaleProvider>
        {/* Production deployment only: not previews, `next dev`, `next start` or tests (D36). */}
        {process.env.VERCEL_ENV === "production" && <VercelInsights />}
      </body>
    </html>
  );
}
