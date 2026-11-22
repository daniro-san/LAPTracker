"use client";

// The editor's "Kept" mark on a notice's picture (D119): who kept it from the weekly cleanup and when, and
// "Stop keeping", which takes effect at once (it is not held until Save, like the picture itself is not
// deleted until the cleanup). Keep is in the cleanup's review list on Home.
import { useRouter } from "next/navigation";
import { useState } from "react";

import { Notice } from "@/lib/brand/components/Notice";
import { Tag } from "@/lib/brand/components/Tag";
import { fill, isolate } from "@/lib/copy";
import type {
  WorkspaceDictionary,
  WorkspaceKey,
  WorkspaceLanguage,
} from "@/lib/private/dictionary";

import { smallButton } from "./NoticeBits";
import { isSignedOut, post } from "./screenshot-upload";

export function KeptMark(props: {
  slug: string;
  id: number;
  /** `on`: the day it was kept, as words made on the server (its clock, not the viewer's). */
  kept: { by: string | null; on?: string };
  t: WorkspaceDictionary;
  language: WorkspaceLanguage;
}) {
  const { t } = props;
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState<WorkspaceKey | null>(null);
  const unkeep = async () => {
    setBusy(true);
    setFailed(null);
    try {
      const body = JSON.stringify({ id: props.id, keep: false });
      await post(`/api/w/${props.slug}/notices/picture/keep`, body, "application/json");
      router.refresh();
    } catch (e) {
      setFailed(isSignedOut(e) ? "signedOut.text" : "notices.picture.keepFailed");
    }
    setBusy(false);
  };
  return (
    <div className="mt-2">
      <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-body-sm">
        <Tag>{t["notices.picture.kept"]}</Tag>
        <span>
          {fill(t["notices.picture.keptBy"], {
            name: isolate(props.kept.by ?? t["notices.picture.someone"]),
            date: props.kept.on ?? "",
          })}
        </span>
      </p>
      <button type="button" disabled={busy} onClick={unkeep} className={`${smallButton()} mt-2`}>
        {t["notices.picture.unkeep"]}
      </button>
      {failed && (
        <Notice tone="fail" className="mt-2">
          {t[failed]}
        </Notice>
      )}
    </div>
  );
}
