// Root layout. Rendered per request so proxy.ts's CSP nonce reaches Next's inline scripts.
import type { Metadata } from "next";
import { connection } from "next/server";
import type { ReactNode } from "react";

import { readTheme } from "@/lib/brand/theme";

import "./globals.css";

export const metadata: Metadata = {
  title: "OG's LAP Tracker",
  description: "Saturday event snapshots for server 325 alliances.",
};

export default async function RootLayout({ children }: { children: ReactNode }) {
  await connection();
  const theme = await readTheme();
  return (
    <html lang="en" data-theme={theme ?? undefined}>
      <body className="min-h-screen bg-white text-zinc-900 antialiased dark:bg-zinc-950 dark:text-zinc-100">
        {children}
      </body>
    </html>
  );
}
