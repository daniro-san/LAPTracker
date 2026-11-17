"use client";

// New members added by hand, waiting for the roster (D106), above the Members list: "Add a new member"
// (the facts editor with a name field), and each one waiting, tagged "New · waiting for tonight's roster".
// A row opens its sheet: the facts to edit like any member's, "Link to a member" (the closest names
// first) and Delete, which asks first.
import { useRouter } from "next/navigation";
import { useState } from "react";

import { buttonClass } from "@/lib/brand/components/Button";
import { Sheet } from "@/lib/brand/components/Sheet";
import { Tag } from "@/lib/brand/components/Tag";
import { fill, isolate } from "@/lib/copy";
import { NONE } from "@/lib/private/fact-text";

import { AskSheet } from "./AskSheet";
import { FactsEditor } from "./FactsEditor";
import type { LifecycleWords, PendingRow } from "./member-lifecycle-data";
import { Facts, type EditorContext } from "./MemberCards";
import { PendingLink, type RosterName } from "./PendingLink";
import { sheetWords } from "./sheet-words";
import { SIGNED_OUT, SignedOutNote } from "./SignedOut";

type Words = LifecycleWords;

/** Link or delete: one request, then the page reads again. */
function useAction(slug: string, onDone: () => void) {
  const router = useRouter();
  const [state, setState] = useState<"idle" | "busy" | "failed" | typeof SIGNED_OUT>("idle");
  const run = async (body: object) => {
    setState("busy");
    const res = await fetch(`/api/w/${slug}/pending`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    }).catch(() => null);
    if (res?.status === 401) return setState(SIGNED_OUT);
    if (!res?.ok) return setState("failed");
    router.refresh();
    onDone();
  };
  return { state, run };
}

function PendingSheet(props: {
  row: PendingRow;
  roster: RosterName[];
  words: Words;
  editor: EditorContext;
  onClose: () => void;
}) {
  const { row, words: t } = props;
  const [step, setStep] = useState<"link" | "delete" | null>(null);
  const action = useAction(props.editor.slug, props.onClose);
  return (
    <Sheet
      labelledBy="pending-sheet-title"
      onCancel={props.onClose}
      title={<span translate="no">{isolate(row.name)}</span>}
      words={sheetWords(t)}
    >
      <Tag>{t["pending.tag"]}</Tag>
      {row.unmatched && <p className="mt-1 text-body-sm">{row.unmatched}</p>}
      <Facts card={row} editor={props.editor} zoneNow={null} />
      <div className="mt-4 flex flex-wrap gap-2 border-t border-rule pt-3">
        <button
          type="button"
          disabled={action.state === "busy"}
          onClick={() => setStep("link")}
          className={buttonClass("primary")}
        >
          {t["pending.link"]}
        </button>
        <button
          type="button"
          disabled={action.state === "busy"}
          onClick={() => setStep("delete")}
          className={buttonClass("secondary")}
        >
          {t["pending.delete"]}
        </button>
      </div>
      {action.state === "failed" && (
        <p role="alert" className="mt-2 font-semibold text-seal">
          {t["pending.failed"]}
        </p>
      )}
      {action.state === SIGNED_OUT && <SignedOutNote className="mt-2" />}
      {step === "link" && (
        <PendingLink
          name={row.name}
          roster={props.roster}
          words={t}
          onPick={(to) => {
            setStep(null);
            void action.run({ action: "link", uid: row.uid, to });
          }}
          onClose={() => setStep(null)}
        />
      )}
      {step === "delete" && (
        <AskSheet
          id="pending-delete-ask"
          question={fill(t["pending.deleteAsk"], { name: isolate(row.name) })}
          yes={t["pending.delete"]}
          no={t["pending.keep"]}
          onAnswer={(yes) => {
            setStep(null);
            if (yes) void action.run({ action: "delete", uid: row.uid });
          }}
        />
      )}
    </Sheet>
  );
}

export function PendingMembers(props: {
  rows: PendingRow[];
  roster: RosterName[];
  words: Words;
  editor: EditorContext;
}) {
  const { rows, words: t } = props;
  const [open, setOpen] = useState<number | null>(null);
  const [adding, setAdding] = useState(false);
  const row = rows.find((r) => r.uid === open);
  return (
    <section aria-labelledby={rows.length > 0 ? "pending-head" : undefined} className="mt-4">
      {rows.length > 0 && (
        <>
          <h2 id="pending-head" className="font-subhead text-display-sm">
            {t["pending.head"]}
          </h2>
          <ul className="mt-1">
            {rows.map((r) => (
              <li key={r.uid}>
                <button
                  type="button"
                  aria-haspopup="dialog"
                  onClick={() => setOpen(r.uid)}
                  className="tint-button flex min-h-14 w-full flex-col items-start justify-center border-t border-rule px-1 py-1.5 text-left"
                >
                  <span translate="no" className="max-w-full truncate font-semibold">
                    <bdi>{r.name}</bdi>
                  </span>
                  <Tag>{t["pending.tag"]}</Tag>
                </button>
              </li>
            ))}
          </ul>
        </>
      )}
      <button
        type="button"
        aria-haspopup="dialog"
        onClick={() => setAdding(true)}
        className={buttonClass("secondary", rows.length > 0 ? "mt-2" : "")}
      >
        {t["pending.add"]}
      </button>
      {adding && (
        <FactsEditor
          {...props.editor}
          uid={null}
          name=""
          facts={{}}
          autoStatus={NONE}
          mode="edit"
          onClose={() => setAdding(false)}
        />
      )}
      {row && (
        <PendingSheet
          row={row}
          roster={props.roster}
          words={t}
          editor={props.editor}
          onClose={() => setOpen(null)}
        />
      )}
    </section>
  );
}
