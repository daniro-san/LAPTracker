"use client";

// A member's own "This is me" on their page (D142): while none is linked, the D74 matcher's suggestions and
// the search over the alliance's newest roster (the officers' "This is me" parts, ThisIsMe.tsx); while an
// officer has to confirm, the waiting line and "Pick another player"; once linked, "This isn't me". Each
// answer goes to /api/w/[slug]/me, then the page reads again.
import { useRouter } from "next/navigation";
import { useState } from "react";

import { buttonClass } from "@/lib/brand/components/Button";
import type { WorkspaceDictionary, WorkspaceLanguage } from "@/lib/private/dictionary";
import type { LinkPicker } from "@/lib/private/me-link";

import { Me } from "./ThisIsMe";

const ERRORS = { taken: "me.taken", not_in_alliance: "me.notInAlliance" } as const;

async function send(slug: string, body: object): Promise<"ok" | keyof typeof ERRORS | "failed"> {
  const res = await fetch(`/api/w/${slug}/me`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  }).catch(() => null);
  if (res?.ok) return "ok";
  const code = ((await res?.json().catch(() => null)) as { code?: string } | null)?.code;
  return code === "taken" || code === "not_in_alliance" ? code : "failed";
}

export function MeLink(props: {
  slug: string;
  t: WorkspaceDictionary;
  language: WorkspaceLanguage;
  state: { kind: "pick"; picker: LinkPicker } | { kind: "pending" } | { kind: "linked" };
}) {
  const { t, state } = props;
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const write = async (body: object) => {
    setBusy(true);
    const r = await send(props.slug, body);
    setBusy(false);
    if (r !== "ok") return setError(t[r === "failed" ? "me.failed" : ERRORS[r]]);
    setError("");
    router.refresh();
  };
  const refusal = error && (
    <p role="alert" className="mt-2 text-body-sm font-semibold text-seal">
      {error}
    </p>
  );
  if (state.kind !== "pick")
    return (
      <>
        <button
          type="button"
          disabled={busy}
          onClick={() => void write({ action: "drop" })}
          className={buttonClass("secondary", "mt-2")}
        >
          {t[state.kind === "pending" ? "me.pending.cancel" : "profile.me.unlink"]}
        </button>
        {refusal}
      </>
    );
  const me = { name: "", player: null, ...state.picker };
  return (
    <>
      <Me
        t={t}
        language={props.language}
        me={me}
        busy={busy}
        onLink={(uid) => uid !== null && void write({ action: "claim", uid })}
      />
      {refusal}
    </>
  );
}
