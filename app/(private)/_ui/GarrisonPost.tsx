"use client";

// "Post to Discord" for the garrison plan (D121): the plan goes to the channel the officer picks, the
// members' (the default) or the leaders'. One request id per choice (D100), as NoticePublish keeps one: a
// double tap or a retry after a lost answer posts once. A refusal from Discord ("failed") or another
// channel gets a new id. Post waits while a change is saved, is off after a failed save (the screen may not
// be the saved plan), and is off with its reason while the enemy might is carried over and not saved.
import { useState } from "react";

import { buttonClass } from "@/lib/brand/components/Button";
import { fill } from "@/lib/copy";
import type { GarrisonKey, GarrisonWords } from "@/lib/private/dictionary.garrison";

import { Choice } from "./CalendarFields";
import { newRequestId } from "./request-id";
import { RefusalLine, SIGNED_OUT } from "./SignedOut";

type Channel = "members" | "leaders";

const REFUSAL: Record<string, GarrisonKey> = {
  posting: "garrison.post.posting",
  not_saved: "garrison.post.saveEnemy",
};

export function GarrisonPost(props: {
  slug: string;
  entry: number;
  week: string;
  words: GarrisonWords;
  /** Post is off: a change is being saved, or the last save failed. */
  busy: boolean;
  /** Post is off for this reason (the enemy might is not saved for this siege); null when it may post. */
  blocked: string | null;
  /** "Last posted to Discord Sat, Nov 21, 10:00." from the server; null before the first post. */
  posted: string | null;
  /** Each channel's name as set up for the workspace (D102); null where none is. */
  channels: Record<Channel, string | null>;
}) {
  const { words, channels } = props;
  const open = (["members", "leaders"] as const).filter((c) => channels[c] !== null);
  const [channel, setChannel] = useState<Channel>(open[0] ?? "members");
  const [requestId, setRequestId] = useState(() => newRequestId());
  const [state, setState] = useState<"idle" | "busy" | "done">("idle");
  const [error, setError] = useState<string | null>(null);
  const notSetUp = fill(words["garrison.post.notSetUp"], {
    channel: words[`garrison.channelName.${channel}`],
  });
  async function post() {
    setState("busy");
    setError(null);
    const body = { action: "post", entry: props.entry, week: props.week, channel, requestId };
    const res = await fetch(`/api/w/${props.slug}/garrison`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    }).catch(() => null);
    const json = (await res?.json().catch(() => null)) as { code?: string } | null;
    if (res?.ok) return setState("done");
    setState("idle");
    const code = json?.code ?? "failed";
    if (code === "failed") setRequestId(newRequestId());
    if (code === SIGNED_OUT) return setError(SIGNED_OUT);
    setError(code === "not_set_up" ? notSetUp : words[REFUSAL[code] ?? "garrison.post.failed"]);
  }
  const line =
    state === "done"
      ? words["garrison.posted"]
      : open.length === 0
        ? notSetUp
        : (props.blocked ?? props.posted);
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
              setRequestId(newRequestId());
              setState("idle");
            }}
          />
        </div>
      )}
      <button
        type="button"
        disabled={props.busy || props.blocked !== null || state === "busy" || open.length === 0}
        onClick={() => void post()}
        className={buttonClass("primary")}
      >
        {words["garrison.post"]}
      </button>
      <p role="status" className="w-full text-body-sm">
        {line}
      </p>
      {error && (
        <RefusalLine text={error} className="w-full border-l-4 border-seal pl-3 text-body-sm" />
      )}
    </>
  );
}
