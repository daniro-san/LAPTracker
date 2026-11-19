"use client";

// Alliance settings' "Your alliance's data" (D125): "Download our data", the ZIP the server builds, saved
// by the browser; and "Delete this workspace", asked in a sheet where the officer types the workspace's
// address, with the safe answer first. Once asked, the section says when it happens; the banner above
// carries "Cancel the deletion". One request id per tap or per open sheet (D100).
import { useRouter } from "next/navigation";
import { useState } from "react";

import { buttonClass } from "@/lib/brand/components/Button";
import { fill } from "@/lib/copy";
import type { WorkspaceDictionary } from "@/lib/private/dictionary";

import { AskSheet } from "./AskSheet";
import { newRequestId } from "./request-id";
import { RefusalLine, SIGNED_OUT } from "./SignedOut";

type Note = { ok: boolean; text: string } | null;

/** The note under a button: what went through, or the refusal (the signed-out note included). */
function NoteLine({ note }: { note: Note }) {
  if (!note) return null;
  if (!note.ok) return <RefusalLine text={note.text} className="mt-2 font-semibold text-seal" />;
  return (
    <p role="status" className="mt-2 font-semibold">
      {note.text}
    </p>
  );
}

/** Saves the answer's ZIP under the name the server gave it. */
async function save(res: Response) {
  const name = /filename="([^"]+)"/.exec(res.headers.get("content-disposition") ?? "")?.[1];
  const url = URL.createObjectURL(await res.blob());
  const a = document.createElement("a");
  a.href = url;
  a.download = name ?? "data.zip";
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

const DOWNLOAD_REFUSED: Record<number, keyof WorkspaceDictionary> = {
  429: "data.rateLimited",
  413: "data.tooLarge",
};

function Download({ slug, t }: { slug: string; t: WorkspaceDictionary }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<Note>(null);
  const download = async () => {
    setBusy(true);
    setNote(null);
    try {
      const res = await fetch(`/api/w/${slug}/data-export`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ requestId: newRequestId() }),
      });
      if (res.ok) {
        await save(res);
        setNote({ ok: true, text: t["data.downloaded"] });
        router.refresh();
      } else {
        const refused =
          res.status === 401 ? SIGNED_OUT : t[DOWNLOAD_REFUSED[res.status] ?? "data.failed"];
        setNote({ ok: false, text: refused });
      }
    } catch {
      setNote({ ok: false, text: t["data.failed"] });
    }
    setBusy(false);
  };
  return (
    <div className="mt-3">
      <p className="text-body-sm text-ink/75">{t["data.downloadHelp"]}</p>
      <button
        type="button"
        disabled={busy}
        onClick={() => void download()}
        className={buttonClass("primary", "mt-2")}
      >
        {busy ? t["data.downloading"] : t["data.download"]}
      </button>
      <NoteLine note={note} />
    </div>
  );
}

/** The sheet's body: what goes, what stays, and the address to type. */
function DeleteDetails(props: {
  slug: string;
  t: WorkspaceDictionary;
  graceDate: string;
  typed: string;
  onType: (value: string) => void;
}) {
  const { t, slug } = props;
  return (
    <>
      <p className="mt-2">{fill(t["delete.what"], { date: props.graceDate })}</p>
      <p className="mt-2 font-semibold">{t["delete.stays"]}</p>
      <p className="mt-2">{t["delete.first"]}</p>
      <label htmlFor="delete-address" className="mt-3 block font-semibold">
        {fill(t["delete.type"], { address: slug })}
      </label>
      <input
        id="delete-address"
        value={props.typed}
        onChange={(e) => props.onType(e.target.value)}
        autoComplete="off"
        autoCapitalize="none"
        spellCheck={false}
        className="drawn-field mt-2 min-h-11 w-full px-3"
      />
    </>
  );
}

function Delete({
  slug,
  t,
  graceDate,
}: {
  slug: string;
  t: WorkspaceDictionary;
  graceDate: string;
}) {
  const router = useRouter();
  const [asking, setAsking] = useState(false);
  const [typed, setTyped] = useState("");
  const [busy, setBusy] = useState(false);
  const [requestId, setRequestId] = useState(newRequestId);
  const [note, setNote] = useState<Note>(null);
  const matches = typed.trim().toLowerCase() === slug;
  const ask = async () => {
    setBusy(true);
    setNote(null);
    try {
      const res = await fetch(`/api/w/${slug}/workspace-deletion`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "ask", address: typed, requestId }),
      });
      if (res.ok) router.refresh();
      else setNote({ ok: false, text: res.status === 401 ? SIGNED_OUT : t["delete.failed"] });
    } catch {
      setNote({ ok: false, text: t["delete.failed"] });
    }
    setBusy(false);
    setAsking(false);
  };
  const open = () => (setTyped(""), setNote(null), setRequestId(newRequestId()), setAsking(true));
  return (
    <>
      <button type="button" onClick={open} className={buttonClass("secondary", "mt-3 text-seal")}>
        {t["delete.button"]}
      </button>
      <NoteLine note={note} />
      {asking && (
        <AskSheet
          id="workspace-delete"
          question={t["delete.ask"]}
          yes={t["delete.yes"]}
          no={t["delete.no"]}
          busy={busy || !matches}
          seal
          onAnswer={(yes) => (yes ? void ask() : setAsking(false))}
        >
          <DeleteDetails slug={slug} t={t} graceDate={graceDate} typed={typed} onType={setTyped} />
        </AskSheet>
      )}
    </>
  );
}

export function WorkspaceDataForm(props: {
  slug: string;
  t: WorkspaceDictionary;
  /** The date the deletion asked now would happen after: 14 days from today. */
  graceDate: string;
  /** When the asked deletion happens, or null when none is asked. */
  deletionDate: string | null;
}) {
  const { slug, t } = props;
  return (
    <>
      <section aria-labelledby="workspace-data" className="drawn-card mt-4 max-w-2xl px-4 py-3">
        <h2 id="workspace-data" className="font-subhead text-display-sm">
          {t["data.head"]}
        </h2>
        <p className="mt-1">{t["data.lead"]}</p>
        <Download slug={slug} t={t} />
      </section>
      <section
        aria-labelledby="workspace-delete-head"
        className="drawn-card mt-4 max-w-2xl px-4 py-3"
      >
        <h2 id="workspace-delete-head" className="font-subhead text-display-sm">
          {t["delete.head"]}
        </h2>
        {props.deletionDate ? (
          <p className="mt-1 font-semibold text-seal">
            {fill(t["delete.asked"], { date: props.deletionDate })}
          </p>
        ) : (
          <>
            <p className="mt-1">{t["delete.lead"]}</p>
            <p className="mt-1 text-body-sm text-ink/75">{t["delete.stays"]}</p>
            <Delete slug={slug} t={t} graceDate={props.graceDate} />
          </>
        )}
      </section>
    </>
  );
}
