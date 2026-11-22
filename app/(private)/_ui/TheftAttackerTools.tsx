"use client";

// Two parts of an opened attacker card in the thefts log (issue 321, D97 amended 2026-11-19): the
// attacker's server, which an officer sets from the player's profile in the game, and, for a player of our
// own server, the warning to paste into in-game mail in English, Portuguese or French.
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

import { buttonClass } from "@/lib/brand/components/Button";
import { chip, FIELD } from "@/lib/brand/components/controls";
import type { WorkspaceLanguage } from "@/lib/private/dictionary";
import { WARNING_LANGUAGES, type WarningLanguage } from "@/lib/private/theft-warning";
import { fill } from "@/lib/words";

import { CopyButton } from "./CopyButton";
import { SIGNED_OUT, SignedOutNote } from "./SignedOut";
import { postTheft } from "./theft-client";
import type { AttackerCard, TheftWords } from "./theft-data";

/** Each language by its own name, as a player would recognise it. */
const LANGUAGE_NAME: Record<WarningLanguage, string> = {
  en: "English",
  "pt-BR": "Português",
  fr: "Français",
};

/** "325" → 325; "" → null (not known); anything else is not a server number. */
function serverValue(text: string): number | null | undefined {
  const s = text.trim();
  if (s === "") return null;
  return /^\d{1,5}$/.test(s) && Number(s) > 0 ? Number(s) : undefined;
}

export function ServerForm(props: {
  card: AttackerCard;
  slug: string;
  t: TheftWords;
  server: number;
}) {
  const { card, t } = props;
  const router = useRouter();
  const [text, setText] = useState(card.server.value?.toString() ?? "");
  const [busy, setBusy] = useState(false);
  const [said, setSaid] = useState("");
  const value = serverValue(text);
  // A number, or null for "not known" (an officer's word, which replaces the inferred server).
  const send = async (server: number | null) => {
    setBusy(true);
    const r = await postTheft(props.slug, { action: "server", attacker: card.key, server });
    setBusy(false);
    setSaid(r === "ok" ? t["thefts.saved"] : r === SIGNED_OUT ? SIGNED_OUT : t["thefts.e.failed"]);
    if (r === "ok" && server === null) setText("");
    if (r === "ok") router.refresh();
  };
  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (typeof value === "number") void send(value);
  };
  const id = `server-${card.key}`;
  return (
    <form onSubmit={submit} className="mt-3 border-t border-rule pt-3">
      <label htmlFor={id} className="block font-semibold">
        {t["thefts.server.label"]}
      </label>
      <p id={`${id}-help`} className="text-body-sm text-ink/80">
        {fill(t["thefts.server.help"], { server: props.server })}
      </p>
      <div className="mt-1 flex flex-wrap items-center gap-2">
        <input
          id={id}
          value={text}
          onChange={(e) => setText(e.target.value)}
          inputMode="numeric"
          maxLength={5}
          aria-describedby={`${id}-help`}
          aria-invalid={value === undefined}
          className={`${FIELD} max-w-32 tabular-nums`}
        />
        <button
          type="submit"
          disabled={busy || typeof value !== "number" || value === card.server.value}
          className={buttonClass("secondary")}
        >
          {t["thefts.save"]}
        </button>
        {!card.server.notKnown && (
          <button
            type="button"
            disabled={busy}
            onClick={() => void send(null)}
            className="inline-flex min-h-11 items-center text-body-sm font-semibold text-plum underline underline-offset-4"
          >
            {t["thefts.server.notKnown"]}
          </button>
        )}
      </div>
      {said === SIGNED_OUT ? (
        <SignedOutNote />
      ) : (
        <p role="status" className="text-body-sm">
          {said}
        </p>
      )}
    </form>
  );
}

export function Warning(props: {
  warnings: Record<WarningLanguage, string>;
  t: TheftWords;
  language: WorkspaceLanguage;
  id: string;
}) {
  const { t } = props;
  const first = (WARNING_LANGUAGES as readonly string[]).includes(props.language)
    ? (props.language as WarningLanguage)
    : "en";
  const [language, setLanguage] = useState<WarningLanguage>(first);
  const textId = `${props.id}-warning`;
  return (
    <section className="mt-3 border-t border-rule pt-3" aria-labelledby={`${textId}-title`}>
      <h3 id={`${textId}-title`} className="font-semibold">
        {t["thefts.warn.title"]}
      </h3>
      <p className="text-body-sm text-ink/80">{t["thefts.warn.help"]}</p>
      <div className="mt-1 flex flex-wrap gap-2">
        {WARNING_LANGUAGES.map((l) => (
          <button
            key={l}
            type="button"
            lang={l}
            aria-pressed={l === language}
            onClick={() => setLanguage(l)}
            className={chip(l === language)}
          >
            {LANGUAGE_NAME[l]}
          </button>
        ))}
      </div>
      <p
        id={textId}
        lang={language}
        translate="no"
        className="mt-2 border-l-2 border-rule pl-2 text-body-sm break-words"
      >
        {props.warnings[language]}
      </p>
      <CopyButton
        text={props.warnings[language]}
        describedBy={textId}
        labels={{
          copy: t["thefts.warn.copy"],
          copied: t["thefts.warn.copied"],
          failed: t["thefts.warn.failed"],
        }}
        className="mt-2"
      />
    </section>
  );
}
