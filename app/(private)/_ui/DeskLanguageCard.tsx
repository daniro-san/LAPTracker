"use client";

// Alliance settings → Language (issue 438): the language the desk opens in for anyone who has not used the
// EN · PT · FR switch, or "follow each person's browser". One Save (SaveRow, issue 585). Every choice is
// 44 px or taller; each language is named in itself.
import { useRouter } from "next/navigation";
import { useState } from "react";

import type { WorkspaceDictionary, WorkspaceLanguage } from "@/lib/private/dictionary";

import { LANGUAGE_CHOICES } from "./languages";
import { SaveRow } from "./SaveRow";
import { SIGNED_OUT } from "./SignedOut";

/** "" is "follow the browser". */
type Choice = WorkspaceLanguage | "";

const OPTION =
  "flex min-h-11 cursor-pointer items-center gap-3 border border-rule px-3 py-2 has-checked:border-plum has-checked:bg-plum/10";

export function DeskLanguageCard(props: {
  slug: string;
  saved: WorkspaceLanguage | null;
  t: WorkspaceDictionary;
  language: string;
}) {
  const { t } = props;
  const router = useRouter();
  const [kept, setKept] = useState<Choice>(props.saved ?? "");
  const [choice, setChoice] = useState<Choice>(props.saved ?? "");
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pick = (next: Choice) => {
    setSaved(false);
    setError(null);
    setChoice(next);
  };
  const save = async () => {
    setBusy(true);
    setError(null);
    const res = await fetch(`/api/w/${props.slug}/desk-language`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ language: choice }),
    }).catch(() => null);
    setBusy(false);
    if (!res?.ok) {
      if (res?.status === 401) return setError(SIGNED_OUT);
      return setError(t[res?.status === 429 ? "deskLang.rateLimited" : "deskLang.failed"]);
    }
    setKept(choice);
    setSaved(true);
    router.refresh();
  };
  const options: { value: Choice; label: string; lang?: string }[] = [
    { value: "", label: t["deskLang.browser"] },
    ...LANGUAGE_CHOICES.map((c) => ({ value: c.id, label: c.name, lang: c.id })),
  ];
  return (
    <section aria-labelledby="desk-language" className="drawn-card mt-6 max-w-2xl px-4 py-3">
      <h2 id="desk-language" className="font-subhead text-display-sm">
        {t["deskLang.head"]}
      </h2>
      <p className="mt-1">{t["deskLang.lead"]}</p>
      <fieldset className="mt-4 grid gap-2">
        <legend className="font-medium">{t["deskLang.legend"]}</legend>
        {options.map((o) => (
          <label key={o.value || "browser"} className={OPTION}>
            <input
              type="radio"
              name="desk-language"
              checked={choice === o.value}
              onChange={() => pick(o.value)}
              className="size-5 shrink-0"
            />
            <span lang={o.lang}>{o.label}</span>
          </label>
        ))}
      </fieldset>
      <SaveRow
        changes={choice === kept ? 0 : 1}
        busy={busy}
        saved={saved}
        error={error}
        onSave={() => void save()}
        t={t}
        language={props.language}
        savedText={t["deskLang.saved"]}
      />
    </section>
  );
}
