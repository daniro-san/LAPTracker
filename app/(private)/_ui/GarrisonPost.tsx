"use client";

// "Post to Discord" for the garrison plan (D121): the saved plan goes to the members' channel, one request
// id per tap (D100), so a retry after a lost answer posts nothing twice. The button waits while a change is
// being saved, so the post is always the plan on screen.
import { useState } from "react";

import { buttonClass } from "@/lib/brand/components/Button";
import type { GarrisonKey, GarrisonWords } from "@/lib/private/dictionary.garrison";

import { newRequestId } from "./request-id";
import { RefusalLine, SIGNED_OUT } from "./SignedOut";

const REFUSAL: Record<string, GarrisonKey> = {
  not_set_up: "garrison.post.notSetUp",
  posting: "garrison.post.posting",
};

export function GarrisonPost(props: {
  slug: string;
  entry: number;
  week: string;
  words: GarrisonWords;
  busy: boolean;
  /** "Last posted to Discord Sat, Nov 21, 10:00." from the server; null before the first post. */
  posted: string | null;
  onPosted: (rev: number) => void;
}) {
  const { words } = props;
  const [state, setState] = useState<"idle" | "busy" | "done">("idle");
  const [error, setError] = useState<string | null>(null);
  async function post() {
    setState("busy");
    setError(null);
    const body = {
      action: "post",
      entry: props.entry,
      week: props.week,
      requestId: newRequestId(),
    };
    const res = await fetch(`/api/w/${props.slug}/garrison`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    }).catch(() => null);
    const json = (await res?.json().catch(() => null)) as { rev?: number; code?: string } | null;
    if (res?.ok && typeof json?.rev === "number") {
      props.onPosted(json.rev);
      return setState("done");
    }
    setState("idle");
    const code = json?.code ?? "failed";
    setError(code === SIGNED_OUT ? SIGNED_OUT : words[REFUSAL[code] ?? "garrison.post.failed"]);
  }
  return (
    <>
      <button
        type="button"
        disabled={props.busy || state === "busy"}
        onClick={() => void post()}
        className={buttonClass("primary")}
      >
        {words["garrison.post"]}
      </button>
      <p role="status" className="w-full text-body-sm">
        {state === "done" ? words["garrison.posted"] : props.posted}
      </p>
      {error && (
        <RefusalLine text={error} className="w-full border-l-4 border-seal pl-3 text-body-sm" />
      )}
    </>
  );
}
