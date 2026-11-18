"use client";

// The analytics question (D115): a bar fixed to the bottom of a public page, so nothing on the page moves when
// it appears. It shows on a public page until the visitor answers on this device, and again when the
// footer's "Analytics choices" asks for it. "Allow" and "No thanks" weigh the same. The desk, the board and
// /admin never show it. The root layout renders it only when analytics is on (D77).
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

import { useCopy } from "@/app/_ui/LocaleProvider";
import {
  ASK_CONSENT_EVENT,
  storeConsent,
  storedConsent,
  type Consent,
} from "@/lib/analytics/consent";
import { withPostHog } from "@/lib/analytics/events";
import { areaOf } from "@/lib/analytics/sanitise";
import { buttonClass } from "@/lib/brand/components/Button";

/** Kept at once; applied to PostHog when its chunk has loaded (it waits for it). */
function answer(consent: Consent) {
  storeConsent(consent);
  withPostHog((ph) => {
    void import("@/lib/analytics/posthog").then((m) => m.answerConsent(ph, consent));
  });
}

export function AnalyticsConsent() {
  const copy = useCopy().consent;
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  useEffect(() => {
    // After hydration: the answer lives in this browser only, so the server always renders no bar.
    if (storedConsent() === null) setOpen(true);
    const ask = () => setOpen(true);
    addEventListener(ASK_CONSENT_EVENT, ask);
    return () => removeEventListener(ASK_CONSENT_EVENT, ask);
  }, []);
  if (!open || areaOf(pathname).area !== "public") return null;
  const choose = (consent: Consent) => {
    answer(consent);
    setOpen(false);
  };
  return (
    <section
      aria-label={copy.label}
      className="fixed inset-x-0 bottom-0 z-30 border-t border-rule bg-paper pr-[env(safe-area-inset-right)] pb-[env(safe-area-inset-bottom)] pl-[env(safe-area-inset-left)] text-ink shadow-[0_-8px_24px_var(--sheet-shadow)]"
    >
      <div className="mx-auto flex max-w-[960px] flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:gap-4 sm:px-6">
        <p className="text-body-sm sm:flex-1">{copy.body}</p>
        <div className="flex gap-2 sm:shrink-0">
          <button
            type="button"
            onClick={() => choose("granted")}
            className={buttonClass("secondary", "flex-1 sm:flex-none")}
          >
            {copy.accept}
          </button>
          <button
            type="button"
            onClick={() => choose("denied")}
            className={buttonClass("secondary", "flex-1 sm:flex-none")}
          >
            {copy.decline}
          </button>
        </div>
      </div>
    </section>
  );
}
