"use client";

// /admin/feedback's status of one item (D157): New, Read, Became an issue, Dropped, as four 44 px buttons,
// the current one pressed. A press sends the PIN as x-edit-pin, like the other admin buttons, and keeps the
// new status shown; the page is read again so a filter by status stays true.
import { useRouter } from "next/navigation";
import { useState } from "react";

import { buttonClass } from "@/lib/brand/components/Button";
import { copy } from "@/lib/copy";
import { FEEDBACK_STATUSES, type FeedbackStatus as Status } from "@/lib/feedback-words";

import { forgetPin, PinSheet, savedPin } from "./PinSheet";

const t = copy.admin.feedback;

export function FeedbackStatus({ id, status }: { id: number; status: Status }) {
  const router = useRouter();
  const [shown, setShown] = useState(status);
  const [busy, setBusy] = useState<Status | null>(null);
  const [asking, setAsking] = useState<Status | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function send(next: Status, pin: string) {
    setBusy(next);
    setError(null);
    const res = await fetch("/api/admin/feedback", {
      method: "POST",
      headers: { "x-edit-pin": pin, "content-type": "application/json" },
      body: JSON.stringify({ id, status: next }),
    }).catch(() => null);
    // Read to its end, so the browser finishes the answer.
    await res?.json().catch(() => null);
    setBusy(null);
    if (res?.status === 401) forgetPin();
    if (!res?.ok) return setError(res?.status === 404 ? t.gone : t.failed);
    setShown(next);
    router.refresh();
  }
  const press = (next: Status) => {
    const pin = savedPin();
    if (pin) void send(next, pin);
    else setAsking(next);
  };

  return (
    <div role="group" aria-label={t.setStatus} className="flex flex-wrap gap-2">
      {FEEDBACK_STATUSES.map((s) => (
        <button
          key={s}
          type="button"
          aria-pressed={s === shown}
          disabled={busy !== null}
          onClick={() => press(s)}
          className={buttonClass(s === shown ? "primary" : "secondary", "text-body-sm")}
        >
          {busy === s ? t.saving : t.statuses[s]}
        </button>
      ))}
      {error && (
        <p role="alert" className="basis-full font-semibold text-seal">
          {error}
        </p>
      )}
      {asking && (
        <PinSheet
          onCancel={() => setAsking(null)}
          onUnlocked={(pin) => {
            setAsking(null);
            void send(asking, pin);
          }}
        />
      )}
    </div>
  );
}
