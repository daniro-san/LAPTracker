"use client";

// The PIN pattern (plan Phase 5): a bottom sheet, `inputmode="numeric"`, asked once per session,
// with a visible checking / failed state. The PIN lives in sessionStorage so the action buttons can
// send it as x-edit-pin; the server cookie only unlocks the admin pages.
import { useState } from "react";

const KEY = "lap_pin";

export function savedPin(): string | null {
  try {
    return sessionStorage.getItem(KEY);
  } catch {
    return null;
  }
}

const MESSAGES: Record<number, string> = {
  401: "Wrong PIN.",
  429: "Too many attempts. Wait a few minutes.",
};

export function PinSheet({ onUnlocked }: { onUnlocked: (pin: string) => void }) {
  const [pin, setPin] = useState("");
  const [state, setState] = useState<"idle" | "checking" | string>("idle");
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setState("checking");
    try {
      const res = await fetch("/api/admin/session", {
        method: "POST",
        headers: { "x-edit-pin": pin },
      });
      if (!res.ok) return setState(MESSAGES[res.status] ?? "Could not check the PIN. Try again.");
      try {
        sessionStorage.setItem(KEY, pin);
      } catch {
        // Private mode: the pages unlock through the cookie; actions will ask again.
      }
      onUnlocked(pin);
    } catch {
      setState("Could not reach the server. Try again.");
    }
  }
  return (
    <div className="fixed inset-x-0 bottom-0 z-50 border-t border-zinc-300 bg-white p-4 shadow-[0_-8px_24px_var(--sheet-shadow)] dark:border-zinc-700 dark:bg-zinc-900">
      <form onSubmit={submit} className="mx-auto flex max-w-md flex-col gap-3">
        <label htmlFor="pin" className="font-semibold">
          Admin PIN
        </label>
        <input
          id="pin"
          type="password"
          inputMode="numeric"
          autoComplete="off"
          pattern="[0-9]*"
          maxLength={8}
          value={pin}
          onChange={(e) => setPin(e.target.value)}
          className="min-h-11 rounded-xs border border-zinc-300 bg-white px-3 text-lg tracking-widest dark:border-zinc-700 dark:bg-zinc-950"
        />
        <button
          type="submit"
          disabled={pin.length < 6 || state === "checking"}
          className="min-h-11 rounded-xs bg-zinc-900 px-4 font-semibold text-white disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900"
        >
          {state === "checking" ? "Checking…" : "Unlock"}
        </button>
        {state !== "idle" && state !== "checking" && (
          <p role="alert" className="text-sm text-red-800 dark:text-red-300">
            ✗ {state}
          </p>
        )}
      </form>
    </div>
  );
}
