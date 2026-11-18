// The notice editor's picture (D119): Add, Replace and Remove are held in the editor like its text, with a
// preview, and nothing reaches the server until Save. Save then sends them (`saveWithPicture`): before the text for
// a saved notice, after it for a new one, which needs the notice's id first.
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import type { WorkspaceKey } from "@/lib/private/dictionary";
import type { PictureView } from "@/lib/private/notice-picture-rules";
import type { Change } from "@/lib/private/notice-rules";

import { saveNotice, type SaveAnswer } from "./notice-client";
import {
  preparePicture,
  removePicture,
  uploadPicture,
  type PictureFailure,
} from "./notice-picture-prep";

/** keep: as saved. add: a prepared picture to upload. remove: take the saved one away. */
type Pending = { kind: "keep" } | { kind: "add"; blob: Blob; url: string } | { kind: "remove" };

export function usePictureDraft(saved: PictureView | null) {
  const router = useRouter();
  const [pending, setPending] = useState<Pending>({ kind: "keep" });
  const [preparing, setPreparing] = useState(false);
  /** The picture could not be read or made small enough. */
  const [unusable, setUnusable] = useState(false);
  const blobUrl = pending.kind === "add" ? pending.url : null;
  useEffect(() => {
    if (!blobUrl) return;
    return () => URL.revokeObjectURL(blobUrl);
  }, [blobUrl]);
  return {
    /** What the preview shows: the new picture, the saved one, or none. */
    shown:
      pending.kind === "add"
        ? { src: pending.url }
        : pending.kind === "remove" || saved === null
          ? null
          : saved,
    hasSaved: saved !== null,
    pending: pending.kind,
    changed: pending.kind !== "keep",
    preparing,
    unusable,
    choose: async (file: File) => {
      setPreparing(true);
      setUnusable(false);
      const blob = await preparePicture(file).catch(() => null);
      setPreparing(false);
      if (!blob) return setUnusable(true);
      setPending({ kind: "add", blob, url: URL.createObjectURL(blob) });
    },
    remove: () => {
      setUnusable(false);
      setPending(saved ? { kind: "remove" } : { kind: "keep" });
    },
    undo: () => {
      setUnusable(false);
      setPending({ kind: "keep" });
    },
    /**
     * Sends the held change to notice `id`; why it failed, or null. Once it went through, the change is no
     * longer held and the page reads the saved picture again, so a text save that fails after it leaves the
     * editor in step with what is stored (review of PR 422).
     */
    apply: async (slug: string, id: number): Promise<PictureFailure | null> => {
      if (pending.kind === "keep") return null;
      const answer =
        pending.kind === "add"
          ? await uploadPicture(slug, id, pending.blob)
          : await removePicture(slug, id);
      if ("failed" in answer && answer.failed) return answer.failed;
      setPending({ kind: "keep" });
      router.refresh();
      return null;
    },
  };
}

export type PictureDraft = ReturnType<typeof usePictureDraft>;

/** The text save's answer, or the picture's refusal as the line to show. */
export type SavedAnswer = SaveAnswer | { ok: false; conflicts: null; picture: WorkspaceKey };

/**
 * The editor's Save with its picture (D119). A saved notice's picture goes first, so a refused picture
 * leaves the text unsaved too. A new notice's goes after the text, which gives the notice its id; a retried
 * Save answers the same notice (D100), so the picture can be sent again.
 */
export async function saveWithPicture(
  p: { slug: string; id: number | null; review?: number | undefined },
  picture: PictureDraft,
  changes: Change[],
  requestId: string,
): Promise<SavedAnswer> {
  const refused = (failed: PictureFailure, saved: boolean): SavedAnswer =>
    // The notice is in the trash (D118): the text save's own answer, so the editor offers to restore it.
    // The picture change stays held and goes in with the next Save.
    failed === "deleted"
      ? { ok: false, conflicts: null, signedOut: false, deleted: true }
      : {
          ok: false,
          conflicts: null,
          picture:
            failed !== "notices.picture.failed" || !saved ? failed : "notices.picture.notSent",
        };
  const before = p.id !== null ? await picture.apply(p.slug, p.id) : null;
  if (before) return refused(before, false);
  const answer =
    changes.length > 0
      ? await saveNotice(p.slug, p.id, changes, requestId, p.review ?? null)
      : ({ ok: true, id: p.id ?? 0 } as const);
  const after = answer.ok && p.id === null ? await picture.apply(p.slug, answer.id) : null;
  return after ? refused(after, true) : answer;
}
