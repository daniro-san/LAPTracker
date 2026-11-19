"use client";

// The thefts page's body (issue 321): "Add a theft", which opens the form sheet, then the log grouped by
// alliance and attacker. After a save the server renders the page again. After a delete, "Theft deleted."
// with Undo (D123).
import { useRouter } from "next/navigation";
import { useState } from "react";

import { buttonClass } from "@/lib/brand/components/Button";
import type { WorkspaceLanguage } from "@/lib/private/dictionary";

import { UndoLine } from "./DeleteRecord";
import { postTheft } from "./theft-client";
import type { AllianceCard, TheftWords } from "./theft-data";
import { TheftCards } from "./TheftCards";
import { TheftForm } from "./TheftForm";

export function TheftsBoard(props: {
  slug: string;
  t: TheftWords;
  language: WorkspaceLanguage;
  alliances: AllianceCard[];
  roster: { uid: number; name: string }[];
  start: { day: string; time: string };
  serverZone: string;
}) {
  const { alliances, ...form } = props;
  const { t, slug } = props;
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [deleted, setDeleted] = useState<{ id: number; requestId: string } | null>(null);
  const undo = async () => {
    if (!deleted) return false;
    const answer = await postTheft(slug, { action: "remove", ...deleted, undo: true });
    if (answer !== "ok") return false;
    setDeleted(null);
    router.refresh();
    return true;
  };
  return (
    <>
      <button
        type="button"
        aria-haspopup="dialog"
        onClick={() => setOpen(true)}
        className={buttonClass("primary", "mt-4 w-full sm:w-auto")}
      >
        {t["thefts.add"]}
      </button>
      {deleted && (
        <UndoLine
          key={deleted.requestId}
          done={t["thefts.removed"]}
          undo={t["thefts.undo"]}
          failed={t["thefts.undoFailed"]}
          onUndo={undo}
        />
      )}
      {open && (
        <TheftForm
          {...form}
          onClose={() => setOpen(false)}
          onSaved={() => {
            setOpen(false);
            router.refresh();
          }}
        />
      )}
      {alliances.length === 0 ? (
        <p className="drawn-card mt-4 px-4 py-5">{t["thefts.empty"]}</p>
      ) : (
        <TheftCards
          alliances={alliances}
          slug={slug}
          t={t}
          language={props.language}
          onDeleted={(id, requestId) => setDeleted({ id, requestId })}
        />
      )}
    </>
  );
}
