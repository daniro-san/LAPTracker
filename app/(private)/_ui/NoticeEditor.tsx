"use client";

// The notice editor (issues 304, 305, 293, 363), top to bottom: the title, the language tabs with the text of
// the tab in view, Translate and Improve writing, the picture (D119), "Show to members" and the end date, then the save bar.
// Translate and Improve writing fill drafts in the page; nothing is saved until the officer presses Save. A
// save sends only the fields that changed, each with the version the officer was looking at; when someone
// else saved one first, the server refuses (409) and one banner at the top shows both versions. While the
// form is open the bottom tabs are hidden (Frame), so the save bar is never under them. Unsaved text is kept
// on this device (an iPhone never warns before leaving), and the editor offers it back when it opens again.
import { useEffect } from "react";

import { buttonClass } from "@/lib/brand/components/Button";
import { FIELD } from "@/lib/brand/components/controls";
import { Notice } from "@/lib/brand/components/Notice";

import { useEditor, type EditorProps } from "./notice-editor-state";
import { usePictureDraft } from "./notice-picture-state";
import { NoticeActions } from "./NoticeActions";
import { ConflictBanner } from "./NoticeBits";
import { Flags, SaveBar } from "./NoticeEditorParts";
import { NoticeHistory } from "./NoticeHistory";
import { LanguageField } from "./NoticeLanguageField";
import { PictureField } from "./NoticePicture";
import { KeptMark } from "./NoticePictureKept";

export type { EditorProps } from "./notice-editor-state";

/** The notice's picture (D119), with "Kept" while the weekly cleanup would take it. */
function Picture({
  p,
  e,
  picture,
}: {
  p: EditorProps;
  e: ReturnType<typeof useEditor>;
  picture: ReturnType<typeof usePictureDraft>;
}) {
  return (
    <PictureField picture={picture} title={e.draft.values.title} busy={e.busy !== null} t={p.t}>
      {p.id !== null && p.picture?.kept && picture.pending === "keep" && (
        <KeptMark slug={p.slug} id={p.id} kept={p.picture.kept} t={p.t} language={p.viewer} />
      )}
    </PictureField>
  );
}

export function NoticeEditor(p: EditorProps) {
  const picture = usePictureDraft(p.picture ?? null);
  const e = useEditor(p, picture);
  const { draft } = e;
  const { t } = p;
  useEffect(() => {
    if (p.focus) document.getElementById("notice-tabs")?.scrollIntoView({ block: "start" });
  }, [p.focus]);
  return (
    <form
      data-notice-editor=""
      data-unsaved={e.dirty ? "" : undefined}
      className="max-w-2xl"
      onSubmit={(event) => {
        event.preventDefault();
        void e.save();
      }}
    >
      {e.conflicts.length > 0 && (
        <ConflictBanner
          conflicts={e.conflicts}
          mine={(field) => draft.values[field]}
          t={t}
          onKeepMine={() => e.resolve("mine")}
          onUseTheirs={() => e.resolve("theirs")}
          focusRef={e.banner}
        />
      )}
      {e.restorable && (
        <Notice tone="info" className="mt-3">
          <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
            {t["notices.restore.lead"]}
            <button type="button" onClick={e.restore} className={buttonClass("secondary")}>
              {t["notices.restore"]}
            </button>
          </span>
        </Notice>
      )}
      {p.review !== undefined && (
        <Notice tone="info" className="mt-3">
          {t["notices.review.editing"]}
        </Notice>
      )}
      {e.restored && e.dirty && (
        <Notice tone="info" className="mt-3">
          {t["notices.history.restored"]}
        </Notice>
      )}
      <label htmlFor="notice-title" className="mt-3 block font-semibold">
        {t["notices.title"]}
      </label>
      <input
        id="notice-title"
        value={draft.values.title}
        maxLength={200}
        onChange={(ev) => e.set("title", ev.target.value)}
        className={`${FIELD} mt-1 block`}
      />
      <LanguageField p={p} e={e} />
      <NoticeActions p={p} e={e} />
      {!p.pictureOff && <Picture p={p} e={e} picture={picture} />}
      <Flags e={e} t={t} />
      <NoticeHistory p={p} e={e} />
      <SaveBar p={p} e={e} />
    </form>
  );
}
