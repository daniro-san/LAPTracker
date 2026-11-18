"use client";
// Error boundary (Phase 5b, plan §12.3): "Something cracked." and a Retry that calls reset(). The
// thrown error is never rendered — no message, digest or stack in the markup (app/error.test.ts). React
// handles the error, so PostHog's autocapture never sees it: it is sent here, with the boundary's name
// (D115), and scrubbed like every exception (lib/analytics/sanitise.ts).
import Link from "next/link";
import { useEffect } from "react";

import { ErrorPage, primaryAction, secondaryAction } from "@/app/_ui/ErrorPage";
import { useCopy } from "@/app/_ui/LocaleProvider";
import { withPostHog } from "@/lib/analytics/events";
import { CrackedBottle } from "@/lib/brand/components/Vignettes";

export default function ErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    withPostHog((ph) => ph.captureException(error, { boundary: "page" }));
  }, [error]);
  const copy = useCopy();
  const t = copy.errors.server;
  return (
    <ErrorPage
      code={t.code}
      title={t.title}
      body={t.body}
      art={<CrackedBottle />}
      copy={copy}
      actions={
        <>
          <button type="button" onClick={() => reset()} className={primaryAction}>
            {t.retry}
          </button>
          <Link href="/" className={secondaryAction}>
            {t.back}
          </Link>
        </>
      }
    />
  );
}
