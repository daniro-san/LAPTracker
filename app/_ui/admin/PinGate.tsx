"use client";

import { useRouter } from "next/navigation";

import { copy } from "@/lib/copy";

import { PinSheet } from "./PinSheet";

/** What /admin pages render without the session cookie: nothing but the PIN sheet. */
export function PinGate() {
  const router = useRouter();
  return (
    <main className="mx-auto max-w-md px-4 py-10">
      <h1 className="font-display text-display-lg font-semibold">{copy.admin.title}</h1>
      <p className="text-ink/70">{copy.admin.pin.prompt}</p>
      <PinSheet onUnlocked={() => router.refresh()} />
    </main>
  );
}
