"use client";
// Error boundary (Phase 5b, plan §12.3): "Something cracked." ("Data temporarily unavailable." when the
// database did not answer, D143) and a Retry that calls reset(). The
// thrown error is never rendered — no message, digest or stack in the markup (app/error.test.ts). React
// handles the error, so PostHog's autocapture never sees it: it is sent here, with the boundary's name
// (D115), and scrubbed like every exception (lib/analytics/sanitise.ts).
import Link from "next/link";
import { useRouter } from "next/navigation";
import { startTransition, useEffect } from "react";

import { ErrorPage, primaryAction, secondaryAction } from "@/app/_ui/ErrorPage";
import { useCopy } from "@/app/_ui/LocaleProvider";
import { withPostHog } from "@/lib/analytics/events";
import { CrackedBottle } from "@/lib/brand/components/Vignettes";
import { DATA_UNAVAILABLE } from "@/lib/data-unavailable";

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
  const router = useRouter();
  const t = copy.errors.server;
  // A server error is in the page's server render: `reset` alone re-renders the same failed payload, so the
  // server is asked again too (Next's pattern for retrying a server error).
  const retry = () =>
    startTransition(() => {
      router.refresh();
      reset();
    });
  // The database did not answer (D143): the server kept this digest (lib/data-unavailable.ts).
  const said = error.digest === DATA_UNAVAILABLE ? copy.errors.unavailable : t;
  return (
    <ErrorPage
      code={said.code}
      title={said.title}
      body={said.body}
      art={<CrackedBottle />}
      copy={copy}
      actions={
        <>
          <button type="button" onClick={retry} className={primaryAction}>
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
