"use client";

import { useRouter } from "next/navigation";

import { copy } from "@/lib/copy";

import { PinSheet } from "./PinSheet";

/** What /admin pages show without the session cookie: the heading and the PIN form (a bottom sheet on
 * phones, a card under the heading at ≥ 640 px). */
export function PinGate() {
  const router = useRouter();
  return (
    <div className="mx-auto max-w-md sm:py-6">
      <h1 className="font-display text-display-lg">{copy.admin.title}</h1>
      <p id="pin-prompt" className="text-ink/70">
        {copy.admin.pin.prompt}
      </p>
      <PinSheet gate onUnlocked={() => router.refresh()} />
    </div>
  );
}
