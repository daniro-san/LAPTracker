"use client";

// The tracker key's part of Alliance settings (D124): with a key, "Key set, ends in ••••abcd", its state,
// quota left and when it was checked, then Replace and Remove; without one (or on Replace), a password field
// and Save and test. The key is typed into a password field, sent once, and never comes back: the page
// shows only what the server says about it. One request id per open form (D100), so a retry after a lost
// answer makes no second test call. A key saved counts as `ws_key_saved` with the state the server answered.
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

import { track } from "@/lib/analytics/events";
import { buttonClass } from "@/lib/brand/components/Button";
import type { WorkspaceDictionary } from "@/lib/private/dictionary";
import type { KeyState } from "@/lib/private/tracker-key";
import { fill } from "@/lib/words";

import { AskSheet } from "./AskSheet";
import { RefusalLine, SIGNED_OUT } from "./SignedOut";

const REFUSALS: Record<string, keyof WorkspaceDictionary> = {
  bad_request: "key.bad",
  key_refused: "key.refused",
  tracker_unreachable: "key.unreachable",
  keys_off: "key.state.off",
  rate_limited: "key.rateLimited",
};

/** The route's answer: the key's state when it went through, else the refusal's code ("failed" for anything else). */
async function send(
  slug: string,
  body: object,
): Promise<{ state: KeyState | undefined } | { code: string }> {
  try {
    const res = await fetch(`/api/w/${slug}/tracker-key`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    if (res.ok) {
      const answer = (await res.json().catch(() => ({}))) as { state?: KeyState };
      return { state: answer.state };
    }
    return { code: ((await res.json()) as { code?: string }).code ?? "failed" };
  } catch {
    return { code: "failed" };
  }
}

type View = { state: KeyState; last4: string | null; quota: string | null; checked: string | null };

/** The saved key: "Key set, ends in ••••abcd", its state, quota left and when it was checked. */
function KeySummary({ view, t }: { view: View; t: WorkspaceDictionary }) {
  const details = [view.quota, view.checked].filter(Boolean).join(" · ");
  return (
    <>
      <p className="font-semibold">{fill(t["key.set"], { last4: view.last4 ?? "" })}</p>
      <p
        className={
          view.state === "invalid" || view.state === "reenter"
            ? "font-semibold text-seal"
            : undefined
        }
      >
        {t[`key.state.${view.state}`]}
      </p>
      {details && <p className="text-body-sm text-ink/75">{details}</p>}
    </>
  );
}

/** The last answer: what went through, or the refusal (the signed-out note included). */
function Note({ note }: { note: { ok: boolean; text: string } | null }) {
  if (!note) return null;
  if (!note.ok) return <RefusalLine text={note.text} className="mt-2 font-semibold text-seal" />;
  return (
    <p role="status" className="mt-2 font-semibold">
      {note.text}
    </p>
  );
}

/** Replace and Remove, under a saved key. */
function KeyActions(props: {
  t: WorkspaceDictionary;
  onReplace: () => void;
  onRemove: () => void;
}) {
  const { t } = props;
  return (
    <div className="mt-3 flex flex-wrap gap-2">
      <button type="button" className={buttonClass("secondary")} onClick={props.onReplace}>
        {t["key.replace"]}
      </button>
      <button type="button" className={buttonClass("secondary")} onClick={props.onRemove}>
        {t["key.remove"]}
      </button>
    </div>
  );
}

/** The password field and Save and test; Cancel when a key is already saved (Replace). */
function KeyEntry(props: {
  t: WorkspaceDictionary;
  keyPage: string;
  busy: boolean;
  onSave: (key: string) => Promise<boolean>;
  onCancel: (() => void) | null;
}) {
  const { t, busy } = props;
  const [draft, setDraft] = useState("");
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (await props.onSave(draft.trim())) setDraft("");
  };
  return (
    <form onSubmit={submit} className="mt-3">
      <label htmlFor="tracker-key-input" className="font-semibold">
        {t["key.label"]}
      </label>
      <p id="tracker-key-help" className="text-body-sm text-ink/70">
        {t["key.help"]}
      </p>
      <p className="text-body-sm">
        {t["key.get"]}{" "}
        <a
          href={props.keyPage}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex min-h-11 items-center font-semibold text-plum underline underline-offset-4"
        >
          {t["key.getLink"]}
        </a>
      </p>
      <input
        id="tracker-key-input"
        type="password"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        autoComplete="off"
        autoCapitalize="none"
        spellCheck={false}
        required
        aria-describedby="tracker-key-help"
        className="drawn-field mt-2 min-h-11 w-full px-3"
      />
      <div className="mt-3 flex flex-wrap gap-2">
        <button type="submit" disabled={busy} className={buttonClass("primary")}>
          {busy ? t["key.saving"] : t["key.save"]}
        </button>
        {props.onCancel && (
          <button type="button" className={buttonClass("secondary")} onClick={props.onCancel}>
            {t["key.cancel"]}
          </button>
        )}
      </div>
    </form>
  );
}

interface FormProps {
  slug: string;
  /** The tracker's API page, where a key is made (sign in with Patreon). */
  keyPage: string;
  view: View;
  t: WorkspaceDictionary;
}

export function TrackerKeyForm({ slug, keyPage, view, t }: FormProps) {
  const router = useRouter();
  const set = view.last4 !== null;
  const [editing, setEditing] = useState(!set);
  const [busy, setBusy] = useState(false);
  const [asking, setAsking] = useState(false);
  const [requestId, setRequestId] = useState(() => crypto.randomUUID());
  /** The last answer: a line that went through, or a refusal. */
  const [note, setNote] = useState<{ ok: boolean; text: string } | null>(null);

  /** One write: the key's state when it went through, null when refused. */
  const write = async (body: object, ok: string) => {
    setBusy(true);
    setNote(null);
    const answer = await send(slug, { ...body, requestId });
    setBusy(false);
    setAsking(false);
    if ("code" in answer) {
      const { code } = answer;
      const text = code === SIGNED_OUT ? SIGNED_OUT : t[REFUSALS[code] ?? "key.failed"];
      setNote({ ok: false, text });
      return null;
    }
    setNote({ ok: true, text: ok });
    setRequestId(crypto.randomUUID());
    router.refresh();
    return answer;
  };
  const save = async (key: string) => {
    const done = await write({ action: "set", key }, t["key.saved"]);
    if (!done) return false;
    if (done.state) track("ws_key_saved", { state: done.state });
    setEditing(false);
    return true;
  };
  const remove = async () => {
    if (await write({ action: "remove" }, t["key.removed"])) setEditing(true);
  };

  if (view.state === "off") return <p className="mt-3 font-semibold">{t["key.state.off"]}</p>;
  return (
    <div className="mt-3">
      {set ? (
        <KeySummary view={view} t={t} />
      ) : (
        <p>{t[`key.state.${view.state === "site" ? "site" : "none"}`]}</p>
      )}
      {set && !editing && (
        <KeyActions
          t={t}
          onReplace={() => (setEditing(true), setNote(null))}
          onRemove={() => setAsking(true)}
        />
      )}
      {editing && (
        <KeyEntry
          t={t}
          keyPage={keyPage}
          busy={busy}
          onSave={save}
          onCancel={set ? () => (setEditing(false), setNote(null)) : null}
        />
      )}
      <Note note={note} />
      {asking && (
        <AskSheet
          id="tracker-key-remove"
          question={t["key.removeAsk"]}
          yes={t["key.remove"]}
          no={t["key.keep"]}
          busy={busy}
          seal
          onAnswer={(yes) => (yes ? void remove() : setAsking(false))}
        >
          <p className="mt-2">{t["key.removeMore"]}</p>
        </AskSheet>
      )}
    </div>
  );
}
