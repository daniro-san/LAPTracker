"use client";
// Error boundary (Phase 5b, plan §12.3): "Something cracked." and a Retry that calls reset(). The
// thrown error is never rendered — no message, digest or stack in the markup (app/error.test.ts).
import Link from "next/link";

import { ErrorPage, primaryAction, secondaryAction } from "@/app/_ui/ErrorPage";
import { useCopy } from "@/app/_ui/LocaleProvider";
import { CrackedBottle } from "@/lib/brand/components/Vignettes";

export default function ErrorBoundary({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
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
