"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

import { copy } from "@/lib/copy";

import { forgetPin, PinSheet } from "./PinSheet";

/** What /admin pages show without a valid session cookie: the heading and the PIN form (a bottom sheet
 * on phones, a card under the heading at ≥ 640 px). Shown, it logs this browser out fully: the PIN saved
 * for the action buttons is dropped, and a `stale` cookie (the PIN changed since it was set) is deleted. */
export function PinGate({ stale }: { stale: boolean }) {
  const router = useRouter();
  useEffect(() => {
    forgetPin();
    if (stale) void fetch("/api/admin/session", { method: "DELETE" }).catch(() => {});
  }, [stale]);
  return (
    <div className="mx-auto max-w-md sm:py-6">
      <h1 className="font-display text-display-lg">{copy.admin.title}</h1>
      <p id="pin-prompt" className="text-ink/70">
        {stale ? copy.admin.pin.changed : copy.admin.pin.prompt}
      </p>
      <PinSheet gate onUnlocked={() => router.refresh()} />
    </div>
  );
}
