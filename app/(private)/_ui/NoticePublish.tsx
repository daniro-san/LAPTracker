"use client";

// "Publish to Discord" on a notice's page (issue 345, D102). Where it goes follows the notice's audience: a
// members notice to the members' channel, a leadership one to the leaders'. Without that channel the button
// is off and says why. The sheet asks "Post to #channel?" with the written languages ticked; Post sends them
// once (a request id per opened sheet, D100), and the page then shows who posted it last and when. When
// Discord refused it, the sheet takes a new request id, so the next Post tries again.
import { useRouter } from "next/navigation";
import { useState } from "react";

import { track } from "@/lib/analytics/events";
import { buttonClass } from "@/lib/brand/components/Button";
import { CheckField } from "@/lib/brand/components/CheckField";
import { Notice } from "@/lib/brand/components/Notice";
import { Sheet } from "@/lib/brand/components/Sheet";
import { fill } from "@/lib/copy";
import type { WorkspaceDictionary, WorkspaceKey } from "@/lib/private/dictionary";
import type { NoticeLanguage } from "@/lib/private/notice-rules";

import { LANGUAGE_NAME } from "./languages";
import { sheetWords } from "./sheet-words";
import { RefusalLine, SIGNED_OUT } from "./SignedOut";

export interface PublishProps {
  slug: string;
  id: number;
  t: WorkspaceDictionary;
  publish: {
    audience: "members" | "leaders";
    /** The audience's channel name, without "#"; null when none is set up. */
    channel: string | null;
    /** "Posted to Discord by Rook · …", or null when never posted. */
    last: string | null;
  };
  /** The written languages, in the order the page shows them. */
  written: NoticeLanguage[];
}

/** The route's answer: "ok", or its code; "lost" when no answer came (it may have posted). */
async function send(slug: string, body: object): Promise<string> {
  try {
    const res = await fetch(`/api/w/${slug}/notices/publish`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    if (res.ok) return "ok";
    const { code } = (await res.json().catch(() => ({}))) as { code?: string };
    return code ?? "failed";
  } catch {
    return "lost";
  }
}

/** A refusal's words; SIGNED_OUT for the signed-out note (RefusalLine shows it). */
function refusal(
  code: string,
  audience: PublishProps["publish"]["audience"],
  t: WorkspaceDictionary,
): string {
  const words: Record<string, WorkspaceKey> = {
    posting: "notices.publish.busy",
    recent: "notices.publish.recent",
    no_text: "notices.publish.pick",
    not_found: "notices.publish.gone",
    not_set_up: `notices.publish.off.${audience}`,
  };
  return code === SIGNED_OUT ? SIGNED_OUT : t[words[code] ?? "notices.publish.failed"];
}

function PublishSheet(props: PublishProps & { channel: string; onClose: () => void }) {
  const { t } = props;
  const router = useRouter();
  const [chosen, setChosen] = useState<NoticeLanguage[]>(props.written);
  const [busy, setBusy] = useState(false);
  /** The refusal's code ("no_text" before sending), or null. */
  const [error, setError] = useState<string | null>(null);
  // One per opened sheet (D100): a double tap or a retry after a lost answer posts once. A refusal from
  // Discord ("failed") ends that request, so the next Post gets a new one.
  const [requestId, setRequestId] = useState(() => crypto.randomUUID());
  const post = async () => {
    if (chosen.length === 0) return setError("no_text");
    setBusy(true);
    setError(null);
    const languages = props.written.filter((l) => chosen.includes(l));
    const answer = await send(props.slug, { id: props.id, languages, requestId });
    setBusy(false);
    if (answer === "failed") setRequestId(crypto.randomUUID());
    if (answer !== "ok") return setError(answer);
    track("ws_notice_published", { audience: props.publish.audience });
    props.onClose();
    router.refresh();
  };
  return (
    <Sheet
      labelledBy="publish-title"
      onCancel={props.onClose}
      title={fill(t["notices.publish.ask"], { channel: props.channel })}
      words={sheetWords(t)}
      primary={{
        label: busy ? t["notices.publish.posting"] : t["notices.publish.post"],
        disabled: busy,
        onClick: () => void post(),
      }}
      note={
        error && (
          <RefusalLine
            text={refusal(error, props.publish.audience, t)}
            className="mb-2 border-l-4 border-seal pl-3 text-body-sm font-semibold"
          />
        )
      }
    >
      <fieldset>
        <legend className="font-semibold">{t["notices.publish.languages"]}</legend>
        <div className="mt-2 space-y-1">
          {props.written.map((l) => (
            <CheckField
              key={l}
              label={LANGUAGE_NAME[l]}
              checked={chosen.includes(l)}
              onChange={(ev) =>
                setChosen((c) => (ev.target.checked ? [...c, l] : c.filter((x) => x !== l)))
              }
            />
          ))}
        </div>
      </fieldset>
      <p className="mt-3 text-body-sm text-ink/70">
        {fill(t["notices.publish.help"], { channel: props.channel })}
      </p>
    </Sheet>
  );
}

export function NoticePublish(props: PublishProps) {
  const { t, publish } = props;
  const [open, setOpen] = useState(false);
  const { channel } = publish;
  const off = channel === null || props.written.length === 0;
  return (
    <section aria-labelledby="notice-discord" className="mt-6 border-t border-rule pt-3">
      <h2 id="notice-discord" className="font-subhead text-display-sm">
        {t["notices.discord"]}
      </h2>
      <p id="notice-discord-where" className="mt-1 text-body-sm text-ink/80">
        {channel === null
          ? t[`notices.publish.off.${publish.audience}`]
          : fill(t[`notices.publish.where.${publish.audience}`], { channel })}
      </p>
      {publish.last && (
        <Notice tone="info" className="mt-2">
          {publish.last}
        </Notice>
      )}
      <button
        type="button"
        disabled={off}
        aria-describedby="notice-discord-where"
        onClick={() => setOpen(true)}
        className={buttonClass("secondary", "mt-3")}
      >
        {t["notices.publish"]}
      </button>
      {open && channel !== null && (
        <PublishSheet {...props} channel={channel} onClose={() => setOpen(false)} />
      )}
    </section>
  );
}
