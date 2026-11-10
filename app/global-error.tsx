"use client";
// Last-resort boundary for errors in the root layout itself: it replaces <html>, so it brings the
// stylesheet and fonts back. Same page and same rule as error.tsx: the error is never rendered. It is
// outside the request's language, so it stays English.
import "./globals.css";

import { ErrorPage, primaryAction } from "@/app/_ui/ErrorPage";
import { CrackedBottle } from "@/lib/brand/components/Vignettes";
import { fontVariables } from "@/lib/brand/fonts";
import { en } from "@/lib/copy";

const t = en.errors.server;

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
          clock={null}
          copy={en}
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
