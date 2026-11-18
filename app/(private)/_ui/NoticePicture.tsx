"use client";

// A notice's picture (D119): in the editor, the "Picture" part with its preview and Add, Replace, Remove and
// Undo, held until Save (notice-picture-state.ts); on the notice page and the members' board, the picture
// itself. The file picker is the hidden input that "Send screenshots" uses (ScreenshotPicker.tsx), one
// picture at a time.
import { useRef } from "react";

import { Notice } from "@/lib/brand/components/Notice";
import { fill } from "@/lib/copy";
import type { WorkspaceDictionary } from "@/lib/private/dictionary";
import type { PictureView } from "@/lib/private/notice-picture-rules";

import type { PictureDraft } from "./notice-picture-state";
import { smallButton } from "./NoticeBits";

/**
 * The picture as a page shows it: as wide as the column at most, its proportions kept, named after the
 * notice's title. A plain img: the picture sits behind the notice's own access check, which next/image's
 * optimiser would fetch without the viewer's session.
 */
export function NoticeImage(props: {
  picture: PictureView | { src: string };
  title: string;
  t: WorkspaceDictionary;
  /** The editor's preview is shorter. */
  small?: boolean;
}) {
  const { picture } = props;
  const tall = props.small ? "max-h-80" : "max-h-96 sm:max-h-[28rem]";
  const img = (
    <img
      src={picture.src}
      alt={fill(props.t["notices.picture.alt"], { title: props.title })}
      {...("width" in picture && { width: picture.width, height: picture.height })}
      loading="lazy"
      className={`block h-auto w-auto max-w-full border border-rule object-contain ${tall}`}
    />
  );
  // A stored picture opens at full size, so a map or a schedule can be read; the preview is not stored yet.
  if (!("width" in picture)) return <div className="mt-2">{img}</div>;
  return (
    <a href={picture.src} className="mt-2 inline-block max-w-full">
      {img}
    </a>
  );
}

export function PictureField({
  picture,
  title,
  busy,
  t,
}: {
  picture: PictureDraft;
  title: string;
  busy: boolean;
  t: WorkspaceDictionary;
}) {
  const input = useRef<HTMLInputElement>(null);
  const off = busy || picture.preparing;
  const pick = () => input.current?.click();
  return (
    <section aria-labelledby="notice-picture" className="mt-6 border-t border-rule pt-4">
      <h2 id="notice-picture" className="font-semibold">
        {t["notices.picture"]}
      </h2>
      <p className="text-body-sm text-ink/70">{t["notices.picture.help"]}</p>
      <input
        ref={input}
        type="file"
        accept="image/*"
        className="sr-only"
        tabIndex={-1}
        aria-hidden="true"
        onChange={(e) => {
          const file = e.currentTarget.files?.[0];
          e.currentTarget.value = "";
          if (file) void picture.choose(file);
        }}
      />
      {picture.shown && <NoticeImage picture={picture.shown} title={title} t={t} small />}
      {picture.pending !== "keep" && (
        <p className="mt-2 text-body-sm" role="status">
          {t[picture.pending === "add" ? "notices.picture.new" : "notices.picture.removing"]}
        </p>
      )}
      {picture.preparing && (
        <p className="mt-2 text-body-sm" role="status">
          {t["notices.picture.preparing"]}
        </p>
      )}
      {picture.unusable && (
        <Notice tone="fail" className="mt-2">
          {t["notices.picture.unusable"]}
        </Notice>
      )}
      <div className="mt-2 flex flex-wrap gap-2">
        <button type="button" disabled={off} onClick={pick} className={smallButton()}>
          {picture.shown ? t["notices.picture.replace"] : t["notices.picture.add"]}
        </button>
        {picture.shown && picture.pending === "keep" && (
          <button type="button" disabled={off} onClick={picture.remove} className={smallButton()}>
            {t["notices.picture.remove"]}
          </button>
        )}
        {picture.pending !== "keep" && (
          <button type="button" disabled={off} onClick={picture.undo} className={smallButton()}>
            {t["notices.picture.undo"]}
          </button>
        )}
      </div>
    </section>
  );
}
