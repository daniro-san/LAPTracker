"use client";

// The footer's "Analytics choices" (D115): opens the analytics question again (AnalyticsConsent.tsx).
import { ASK_CONSENT_EVENT } from "@/lib/analytics/consent";

export function AnalyticsChoices({ label }: { label: string }) {
  return (
    <button
      type="button"
      onClick={() => dispatchEvent(new Event(ASK_CONSENT_EVENT))}
      className="text-button ml-auto flex min-h-11 w-fit min-w-11 items-center justify-end text-xs text-ink/65 underline underline-offset-2"
    >
      {label}
    </button>
  );
}
