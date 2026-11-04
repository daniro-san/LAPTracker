"use client";

import { useRouter } from "next/navigation";

import { PinSheet } from "./PinSheet";

/** What /admin pages render without the session cookie: nothing but the PIN sheet. */
export function PinGate() {
  const router = useRouter();
  return (
    <main className="mx-auto max-w-md px-4 py-10">
      <h1 className="text-xl font-bold">Admin</h1>
      <p className="text-zinc-500 dark:text-zinc-400">Enter the PIN to continue.</p>
      <PinSheet onUnlocked={() => router.refresh()} />
    </main>
  );
}
