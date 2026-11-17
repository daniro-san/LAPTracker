"use client";

// "Read from a screenshot" beside a paste box (issue 347, D109): the officer picks a picture (several for
// "Paste updates"), each is read by the desk's reader (POST /api/w/[slug]/shots/read, one at a time, as
// "Send screenshots" sends them: PNG, no status bar, at most 1080 px wide) and its text lines go into the
// paste box. Nothing is saved: the paste's own reading runs and the officer checks and saves. The picture
// is not kept anywhere. `accept="image/*"` without `capture` opens the photo library on an iPhone.
import { useRef, useState } from "react";

import { buttonClass } from "@/lib/brand/components/Button";
import { STATUS_BAR_ASPECT, STATUS_BAR_SHARE } from "@/lib/screenshot/status-bar";

import { isSignedOut, pictureText, post, toPng } from "./screenshot-upload";
import { RefusalLine, SIGNED_OUT } from "./SignedOut";

const STATUS_BAR = { share: STATUS_BAR_SHARE, aspect: STATUS_BAR_ASPECT };

export function ReadScreenshot(props: {
  slug: string;
  words: { read: string; reading: string; failed: string };
  multiple?: boolean;
  /** The text read, every picture's lines one after another. */
  onText: (text: string) => void;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function read(files: File[]) {
    setBusy(true);
    setError(null);
    const pages: string[][] = [];
    try {
      for (const file of files) {
        const png = await toPng(file, STATUS_BAR);
        const read = (await post(`/api/w/${props.slug}/shots/read`, png, "image/png")) as {
          lines: string[];
        };
        pages.push(read.lines);
      }
      const text = pictureText(pages);
      if (text === "") setError(props.words.failed);
      else props.onText(text);
    } catch (e) {
      setError(isSignedOut(e) ? SIGNED_OUT : props.words.failed);
    } finally {
      setBusy(false);
      if (input.current) input.current.value = "";
    }
  }

  return (
    <div className="mt-2">
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
        aria-busy={busy}
        onClick={() => input.current?.click()}
        className={buttonClass("secondary")}
      >
        {busy ? props.words.reading : props.words.read}
      </button>
      <span aria-live="polite" className="sr-only">
        {busy ? props.words.reading : ""}
      </span>
      {error && <RefusalLine text={error} className="mt-2 text-body-sm text-seal" />}
    </div>
  );
}
