"use client";

// EN · PT · FR (D71): a one-year cookie, then the server renders the page again in that language.
import { useRouter } from "next/navigation";

import { WORKSPACE_LANG_COOKIE } from "@/lib/private/cookies";
import type { WorkspaceLanguage } from "@/lib/private/dictionary";

const CHOICES: { id: WorkspaceLanguage; short: string; name: string }[] = [
  { id: "en", short: "EN", name: "English" },
  { id: "pt-BR", short: "PT", name: "Português" },
  { id: "fr", short: "FR", name: "Français" },
];

export function LanguageSwitch({ current, label }: { current: WorkspaceLanguage; label: string }) {
  const router = useRouter();
  const pick = (id: WorkspaceLanguage) => {
    document.cookie = `${WORKSPACE_LANG_COOKIE}=${id}; path=/; max-age=31536000; samesite=lax`;
    router.refresh();
  };
  return (
    <div role="group" aria-label={label} data-tour="language" className="flex items-center">
      {CHOICES.map((c, i) => (
        <span key={c.id} className="flex items-center">
          {i > 0 && <span aria-hidden="true">·</span>}
          <button
            type="button"
            lang={c.id}
            aria-label={c.name}
            aria-pressed={c.id === current}
            onClick={() => pick(c.id)}
            className={`min-h-11 min-w-11 px-2 text-body-sm font-semibold tracking-wide ${
              c.id === current ? "underline decoration-2 underline-offset-4" : "opacity-80"
            }`}
          >
            {c.short}
          </button>
        </span>
      ))}
    </div>
  );
}
