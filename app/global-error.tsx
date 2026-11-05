"use client";
// Last-resort boundary for errors in the root layout itself: it replaces <html>, so it brings the
// stylesheet and fonts back. Same page and same rule as error.tsx: the error is never rendered.
import "./globals.css";

import { ErrorPage, primaryAction } from "@/app/_ui/ErrorPage";
import { CrackedBottle } from "@/lib/brand/components/Vignettes";
import { fontVariables } from "@/lib/brand/fonts";
import { copy } from "@/lib/copy";

const t = copy.errors.server;

export default function GlobalError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en" className={fontVariables}>
      <body className="min-h-screen bg-paper font-body text-ink antialiased">
        <ErrorPage
          code={t.code}
          title={t.title}
          body={t.body}
          art={<CrackedBottle />}
          actions={
            <button type="button" onClick={() => reset()} className={primaryAction}>
              {t.retry}
            </button>
          }
        />
      </body>
    </html>
  );
}
