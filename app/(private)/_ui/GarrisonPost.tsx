"use client";

// "Post to Discord" for the garrison plan (D121): the plan goes to the channel the officer picks, the
// members' (the default) or the leaders', one request id per tap (D100), so a retry after a lost answer
// posts nothing twice. The button waits while a change is being saved, so the post is the plan on screen.
import { useState } from "react";

import { buttonClass } from "@/lib/brand/components/Button";
import { fill } from "@/lib/copy";
import type { GarrisonKey, GarrisonWords } from "@/lib/private/dictionary.garrison";

import { Choice } from "./CalendarFields";
import { newRequestId } from "./request-id";
import { RefusalLine, SIGNED_OUT } from "./SignedOut";

const REFUSAL: Record<string, GarrisonKey> = {
  not_set_up: "garrison.post.notSetUp",
  posting: "garrison.post.posting",
};

type Channel = "members" | "leaders";

export function GarrisonPost(props: {
  slug: string;
  entry: number;
  week: string;
  words: GarrisonWords;
  busy: boolean;
  /** "Last posted to Discord Sat, Nov 21, 10:00." from the server; null before the first post. */
  posted: string | null;
  /** Each channel's name as set up for the workspace (D102); null where none is. */
  channels: Record<Channel, string | null>;
}) {
  const { words, channels } = props;
  const open = (["members", "leaders"] as const).filter((c) => channels[c] !== null);
  const [channel, setChannel] = useState<Channel>(open[0] ?? "members");
  const [state, setState] = useState<"idle" | "busy" | "done">("idle");
  const [error, setError] = useState<string | null>(null);
  async function post() {
    setState("busy");
    setError(null);
    const body = { action: "post", entry: props.entry, week: props.week, channel };
    const res = await fetch(`/api/w/${props.slug}/garrison`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ ...body, requestId: newRequestId() }),
    }).catch(() => null);
    const json = (await res?.json().catch(() => null)) as { code?: string } | null;
    if (res?.ok) return setState("done");
    setState("idle");
    const code = json?.code ?? "failed";
    setError(code === SIGNED_OUT ? SIGNED_OUT : words[REFUSAL[code] ?? "garrison.post.failed"]);
  }
  return (
    <>
      {open.length > 1 && (
        <div className="w-full">
          <Choice
            legend={words["garrison.channel"]}
            name="garrison-channel"
            value={channel}
            options={open.map((c) => ({
              value: c,
              label: fill(words[`garrison.channel.${c}`], { name: channels[c] ?? "" }),
            }))}
            onChange={(c) => {
              setChannel(c);
              setState("idle");
            }}
          />
        </div>
      )}
      <button
        type="button"
        disabled={props.busy || state === "busy" || open.length === 0}
        onClick={() => void post()}
        className={buttonClass("primary")}
      >
        {words["garrison.post"]}
      </button>
      <p role="status" className="w-full text-body-sm">
        {state === "done"
          ? words["garrison.posted"]
          : open.length === 0
            ? words["garrison.post.notSetUp"]
            : props.posted}
      </p>
      {error && (
        <RefusalLine text={error} className="w-full border-l-4 border-seal pl-3 text-body-sm" />
      )}
    </>
  );
}
