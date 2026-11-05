"use client";

// The PIN pattern (plan Phase 5): a bottom sheet (a <dialog>, app/_ui/admin/sheet.ts),
// `inputmode="numeric"`, asked once per session, with a visible checking / failed state. The PIN lives in
// sessionStorage so the action buttons can send it as x-edit-pin; the server cookie only unlocks the
// admin pages.
import { useState } from "react";

import { buttonClass } from "@/lib/brand/components/Button";
import { copy } from "@/lib/copy";

import { GATE_CARD, MODAL_CARD, SHEET, useSheet } from "./sheet";

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

export function PinSheet({
  gate = false,
  onUnlocked,
  onCancel,
}: {
  /** The /admin gate: the sheet is the page, open and non-modal. Otherwise an action asked for it. */
  gate?: boolean;
  onUnlocked: (pin: string) => void;
  onCancel?: () => void;
}) {
  const ref = useSheet(!gate);
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
    <dialog
      ref={ref}
      open={gate || undefined}
      aria-labelledby="pin-label"
      {...(gate && { "aria-describedby": "pin-prompt" })}
      onCancel={(e) => {
        e.preventDefault();
        onCancel?.();
      }}
      className={`${SHEET} ${gate ? GATE_CARD : MODAL_CARD}`}
    >
      <form onSubmit={submit} className="mx-auto flex max-w-md flex-col gap-3">
        <label id="pin-label" htmlFor="pin" className="font-semibold">
          {t.label}
        </label>
        <input
          id="pin"
          type="password"
          inputMode="numeric"
          autoComplete="off"
          autoFocus
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
    </dialog>
  );
}
