// Root layout. Rendered per request so proxy.ts's CSP nonce reaches Next's inline scripts.
import type { Metadata } from "next";
import { connection } from "next/server";
import type { ReactNode } from "react";

import { fontVariables } from "@/lib/brand/fonts";
import { readTheme } from "@/lib/brand/theme";
import { copy } from "@/lib/copy";

import { requestLocale } from "./_ui/locale";
import { LocaleProvider } from "./_ui/LocaleProvider";
import { UpstreamBanner } from "./_ui/UpstreamBanner";

import "./globals.css";

export const metadata: Metadata = {
  title: copy.site.name,
  description: copy.site.description,
};

export default async function RootLayout({ children }: { children: ReactNode }) {
  await connection();
  const [theme, locale] = await Promise.all([readTheme(), requestLocale()]);
  return (
    <html lang={locale} data-theme={theme ?? undefined} className={fontVariables}>
      <body className="min-h-screen bg-paper font-body text-ink antialiased">
        <LocaleProvider locale={locale}>
          <UpstreamBanner />
          {children}
        </LocaleProvider>
      </body>
    </html>
  );
}
