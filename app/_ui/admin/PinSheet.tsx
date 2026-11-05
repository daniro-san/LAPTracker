"use client";

// The PIN pattern (plan Phase 5): a bottom sheet, `inputmode="numeric"`, asked once per session,
// with a visible checking / failed state. The PIN lives in sessionStorage so the action buttons can
// send it as x-edit-pin; the server cookie only unlocks the admin pages.
import { useState } from "react";

import { buttonClass } from "@/lib/brand/components/Button";
import { copy } from "@/lib/copy";

const KEY = "lap_pin";

export function savedPin(): string | null {
  try {
    return sessionStorage.getItem(KEY);
  } catch {
    return null;
  }
}

const t = copy.admin.pin;

const MESSAGES: Record<number, string> = { 401: t.wrong, 429: t.tooMany };

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
      if (!res.ok) return setState(MESSAGES[res.status] ?? t.failed);
      try {
        sessionStorage.setItem(KEY, pin);
      } catch {
        // Private mode: the pages unlock through the cookie; actions will ask again.
      }
      onUnlocked(pin);
    } catch {
      setState(t.offline);
    }
  }
  return (
    <div className="fixed inset-x-0 bottom-0 z-50 border-t border-rule bg-paper p-4 shadow-[0_-8px_24px_var(--sheet-shadow)]">
      <form onSubmit={submit} className="mx-auto flex max-w-md flex-col gap-3">
        <label htmlFor="pin" className="font-semibold">
          {t.label}
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
          className="drawn-field min-h-11 px-3 text-lg tracking-widest"
        />
        <button
          type="submit"
          disabled={pin.length < 6 || state === "checking"}
          className={buttonClass("primary", "font-semibold")}
        >
          {state === "checking" ? t.checking : t.unlock}
        </button>
        {state !== "idle" && state !== "checking" && (
          <p role="alert" className="text-sm text-seal">
            ✗ {state}
          </p>
        )}
      </form>
    </div>
  );
}
