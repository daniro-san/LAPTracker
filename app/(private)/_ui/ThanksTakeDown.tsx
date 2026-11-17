"use client";

// "Take down" on the board's thank-you card, in an officer's preview (D114): asks first (AskSheet, the safe
// answer first), then hides the card. The board then renders as if no thanks had been shared.
import { useRouter } from "next/navigation";
import { useState } from "react";

import { buttonClass } from "@/lib/brand/components/Button";

import { AskSheet } from "./AskSheet";
import { RefusalLine } from "./SignedOut";

export function ThanksTakeDown(props: {
  slug: string;
  id: number;
  words: { takeDown: string; ask: string; keep: string; failed: string };
}) {
  const { words } = props;
  const router = useRouter();
  const [asking, setAsking] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const takeDown = async () => {
    setBusy(true);
    setError(null);
    const res = await fetch(`/api/w/${props.slug}/thanks`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: "take_down", id: props.id }),
    }).catch(() => null);
    setBusy(false);
    if (res?.ok) return router.refresh();
    const code = res ? ((await res.json().catch(() => ({}))) as { code?: string }).code : undefined;
    setError(code === "signed_out" ? code : words.failed);
  };
  return (
    <div className="mt-2 border-t border-rule pt-2">
      <button
        type="button"
        disabled={busy}
        onClick={() => setAsking(true)}
        className={buttonClass("secondary")}
      >
        {words.takeDown}
      </button>
      {error && (
        <RefusalLine
          text={error}
          className="mt-2 border-l-4 border-seal pl-3 text-body-sm font-semibold"
        />
      )}
      {asking && (
        <AskSheet
          id="thanks-take-down"
          question={words.ask}
          yes={words.takeDown}
          no={words.keep}
          onAnswer={(yes) => {
            setAsking(false);
            if (yes) void takeDown();
          }}
        />
      )}
    </div>
  );
}
