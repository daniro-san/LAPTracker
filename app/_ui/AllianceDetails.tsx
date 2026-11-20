"use client";

// "Get today's details" (D133, issue 459) on the page of an alliance outside the daily read. The server says
// what the box shows now (`state`); a press POSTs to /api/alliances/[unionId]/details and, once the roster is
// stored, refreshes the page so the details appear. One lookup per alliance per server day for the whole
// site: a press that lost the race refreshes too, and shows the other visitor's lookup.
import { useRouter } from "next/navigation";
import { useState } from "react";

import { buttonClass } from "@/lib/brand/components/Button";
import { fill } from "@/lib/copy";

import { useCopy } from "./LocaleProvider";

/** What the box shows before a press: the button, or why there is none today. */
export type DetailsView =
  | { state: "button" }
  | { state: "got"; time: string }
  | { state: "usedUp" | "failed" | "eventPause" | "running" };

type Refusal = "usedUp" | "failed" | "eventPause" | "tooMany" | "error";

const REFUSAL: Record<string, Refusal> = {
  cap: "usedUp",
  quota: "usedUp",
  failed: "failed",
  event_window: "eventPause",
  rate_limited: "tooMany",
};

export function AllianceDetails({ unionId, view }: { unionId: number; view: DetailsView }) {
  const a = useCopy().alliances;
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [refused, setRefused] = useState<Refusal | null>(null);

  async function press() {
    setBusy(true);
    setRefused(null);
    try {
      const res = await fetch(`/api/alliances/${unionId}/details`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: "{}",
      });
      const { code } = (await res.json().catch(() => ({}))) as { code?: string };
      // Stored, by this press or by another visitor's a moment before: the page shows it.
      if (code === "done" || code === "taken" || code === "daily") return router.refresh();
      setRefused(REFUSAL[code ?? ""] ?? "error");
    } catch {
      setRefused("error");
    } finally {
      setBusy(false);
    }
  }

  const line = (text: string) => <p className="text-body-sm text-ink/80">{text}</p>;
  return (
    <section className="mt-3 mb-4 border-l-2 border-plum/60 pl-3" aria-live="polite">
      <p>{a.notDaily}</p>
      {view.state === "button" && !refused && (
        <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1">
          <button
            type="button"
            onClick={press}
            disabled={busy}
            className={buttonClass("secondary", "font-semibold")}
          >
            {busy ? a.getting : a.get}
          </button>
          {line(a.getNote)}
        </div>
      )}
      {refused && line(a[refused])}
      {view.state === "got" && line(fill(a.got, { time: view.time }))}
      {view.state === "running" && line(a.getting)}
      {(view.state === "usedUp" || view.state === "failed" || view.state === "eventPause") &&
        line(a[view.state])}
    </section>
  );
}
