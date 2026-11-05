"use client";

import { useRouter } from "next/navigation";

import { PinSheet } from "./PinSheet";

/** What /admin pages render without the session cookie: nothing but the PIN sheet. */
export function PinGate() {
  const router = useRouter();
  return (
    <main className="mx-auto max-w-md px-4 py-10">
      <h1 className="font-display text-display-lg font-semibold">Admin</h1>
      <p className="text-ink/70">Enter the admin PIN to see this page.</p>
      <PinSheet onUnlocked={() => router.refresh()} />
    </main>
  );
}
