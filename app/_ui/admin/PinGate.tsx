"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

import { copy } from "@/lib/copy";

import { forgetPin, PinSheet } from "./PinSheet";

/** Deletes this browser's session cookie and the PIN its tab saved for the action buttons. */
async function endSession(): Promise<void> {
  forgetPin();
  await fetch("/api/admin/session", { method: "DELETE" }).catch(() => {});
}

/** What /admin pages show without a valid session: the heading and the PIN form (a bottom sheet on
 * phones, a card under the heading at ≥ 640 px). `ended` says why a cookie stopped working: the PIN
 * changed, or the 7-day session expired (D3 amendment); the card then deletes it. Shown at all, it drops
 * the saved PIN. */
export function PinGate({ ended }: { ended: "changed" | "expired" | null }) {
  const router = useRouter();
  useEffect(() => {
    if (ended) void endSession();
    else forgetPin();
  }, [ended]);
  const t = copy.admin.pin;
  return (
    <div className="mx-auto max-w-md sm:py-6">
      <h1 className="font-display text-display-lg">{copy.admin.title}</h1>
      <p id="pin-prompt" className="text-ink/70">
        {ended ? t[ended] : t.prompt}
      </p>
      <PinSheet gate onUnlocked={() => router.refresh()} />
    </div>
  );
}

/** "Log out" in the admin nav: ends the session here and shows the PIN card. */
export function LogoutButton() {
  const router = useRouter();
  return (
    <button
      type="button"
      onClick={() => void endSession().then(() => router.refresh())}
      className="tint-button flex min-h-11 cursor-pointer items-center px-3 text-sm font-medium text-plum"
    >
      {copy.admin.nav.logout}
    </button>
  );
}
