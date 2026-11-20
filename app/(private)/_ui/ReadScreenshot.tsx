"use client";

// "Read from a screenshot" beside a paste box (issue 347, D109): the officer picks a picture (several for
// "Paste updates"), each is read by the desk's reader (POST /api/w/[slug]/shots/read, one at a time, as
// "Send screenshots" sends them: PNG, no status bar, at most 1080 px wide) and its text lines go into the
// paste box. Nothing is saved: the paste's own reading runs and the officer checks and saves. The picture
// is not kept anywhere, and the line under the button says so. When a later picture fails, the text of the
// pictures before it is still handed over. `accept="image/*"` without `capture` opens the photo library on
// an iPhone. `link`: a text link above the editor's main "Fill the fields" button.
import { useRef, useState } from "react";

import { track } from "@/lib/analytics/events";
import { buttonClass } from "@/lib/brand/components/Button";
import { STATUS_BAR_ASPECT, STATUS_BAR_SHARE } from "@/lib/screenshot/status-bar";

import { isSignedOut, pictureText, post, toPng } from "./screenshot-upload";
import { RefusalLine, SIGNED_OUT } from "./SignedOut";

const STATUS_BAR = { share: STATUS_BAR_SHARE, aspect: STATUS_BAR_ASPECT };
const LINK =
  "inline-flex min-h-11 items-center font-semibold text-plum underline underline-offset-4 disabled:text-ink/60 disabled:no-underline";

export interface ShotWords {
  read: string;
  reading: string;
  failed: string;
  busy: string;
  notKept: string;
}

type ShotKey = "shot.read" | "shot.reading" | "shot.failed" | "shot.busy" | "shot.notKept";

/** The control's words, from the editor's or Paste updates' words. */
export const shotWords = (w: Record<ShotKey, string>): ShotWords => ({
  read: w["shot.read"],
  reading: w["shot.reading"],
  failed: w["shot.failed"],
  busy: w["shot.busy"],
  notKept: w["shot.notKept"],
});

/** Each picture's lines in turn; on a failure, the pages read before it and why it stopped. */
async function readPictures(slug: string, files: File[], query: string) {
  const pages: string[][] = [];
  for (const file of files) {
    try {
      const png = await toPng(file, STATUS_BAR);
      // `button=1`: this is "Read from a screenshot", the one use of the reader its switch turns off (D126);
      // with the switch off the button is not shown, so a 403 is a stale page and reads as a failure.
      const url = `/api/w/${slug}/shots/read${query ? `${query}&` : "?"}button=1`;
      const read = (await post(url, png, "image/png")) as {
        lines: string[];
      };
      pages.push(read.lines);
    } catch (e) {
      const status = e instanceof Error ? e.message : "";
      const why = isSignedOut(e) ? SIGNED_OUT : status === "429" ? "busy" : "failed";
      return { pages, why } as const;
    }
  }
  return { pages, why: null };
}

export function ReadScreenshot(props: {
  slug: string;
  /** Where the control sits, for the `ws_text_read` event only (D115). */
  place: "paste_updates" | "facts" | "garrison";
  /** Added to the read's address: "?text=plain" for the garrison plan's enemy might (D121). */
  query?: string;
  words: ShotWords;
  multiple?: boolean;
  link?: boolean;
  /** The text read, every picture's lines one after another. */
  onText: (text: string) => void;
}) {
  const { words } = props;
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function read(files: File[]) {
    setBusy(true);
    setError(null);
    const { pages, why } = await readPictures(props.slug, files, props.query ?? "");
    const text = pictureText(pages);
    if (text !== "") props.onText(text);
    if (why === SIGNED_OUT) setError(SIGNED_OUT);
    else if (why === "busy") setError(words.busy);
    else if (why === "failed" || text === "") setError(words.failed);
    if (why !== SIGNED_OUT) {
      const outcome = why === "busy" ? "busy" : text === "" ? "failed" : "read";
      track("ws_text_read", { place: props.place, outcome });
    }
    setBusy(false);
    if (input.current) input.current.value = "";
  }

  return (
    <div className={props.link ? "mt-1" : "mt-2"}>
      <input
        ref={input}
        type="file"
        accept="image/*"
        multiple={props.multiple}
        hidden
        onChange={(e) => {
          const files = [...(e.target.files ?? [])];
          if (files.length > 0) void read(files);
        }}
      />
      <button
        type="button"
        disabled={busy}
        onClick={() => input.current?.click()}
        className={props.link ? LINK : buttonClass("secondary")}
      >
        {words.read}
      </button>
      <p aria-live="polite" className="text-body-sm text-ink/75">
        {busy ? words.reading : words.notKept}
      </p>
      {error && <RefusalLine text={error} className="mt-1 text-body-sm text-seal" />}
    </div>
  );
}
