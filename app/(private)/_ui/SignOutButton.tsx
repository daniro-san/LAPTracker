"use client";

// "Sign out": a same-origin JSON POST (D71), then the workspace's address again, which shows the sign-in.
// Unsaved notice text kept on this device goes too: the next officer on a shared phone must not see it.
// When the page holds unsaved work (an element marked `data-unsaved`: the notice editor, a draft with
// fixes), it asks first (ADV-4), with the safe answer first.
import { useRouter } from "next/navigation";
import { useState } from "react";

import { forgetPerson } from "@/lib/analytics/events";

import { AskSheet } from "./AskSheet";
import { forgetAllKept } from "./notice-keep";

export function SignOutButton({
  slug,
  words,
}: {
  slug: string;
  words: { label: string; ask: string; stay: string };
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [asking, setAsking] = useState(false);
  async function signOut() {
    setBusy(true);
    forgetAllKept();
    // D115: events after sign-out belong to no one.
    forgetPerson();
    try {
      await fetch(`/api/w/${slug}/logout`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: "{}",
      });
    } finally {
      router.refresh();
      setBusy(false);
    }
  }
  const tap = () => (document.querySelector("[data-unsaved]") ? setAsking(true) : void signOut());
  return (
    <>
      <button
        type="button"
        onClick={tap}
        disabled={busy}
        className="min-h-11 min-w-11 shrink-0 px-2 text-body-sm whitespace-nowrap font-semibold underline underline-offset-4 disabled:opacity-60"
      >
        {words.label}
      </button>
      {asking && (
        <AskSheet
          id="sign-out-ask"
          question={words.ask}
          yes={words.label}
          no={words.stay}
          onAnswer={(yes) => {
            setAsking(false);
            if (yes) void signOut();
          }}
        />
      )}
    </>
  );
}
