"use client";

// "This is me" in the settings sheet (issue 334): the linked player and "This isn't me", or the name matcher's
// suggestions (D74) and a search over the alliance's newest roster, each row confirmed with "That’s me". Each
// row shows the player's rank and might, so look-alike names can be told apart.
import { useMemo, useState } from "react";

import { buttonClass } from "@/lib/brand/components/Button";
import { compactLarge } from "@/lib/compact";
import type { WorkspaceDictionary, WorkspaceLanguage } from "@/lib/private/dictionary";
import type { Player, Profile } from "@/lib/private/profile";
import { searchRoster } from "@/lib/private/roster-search";

type Words = WorkspaceDictionary;

/** "This is me": the linked player and "This isn't me", or the matcher's suggestions and the search. */
export function Me(props: {
  t: Words;
  language: WorkspaceLanguage;
  me: Profile | "loading" | "failed";
  busy: boolean;
  onLink: (uid: number | null) => void;
}) {
  const { t, language, me, busy, onLink } = props;
  if (me === "loading") return <p className="mt-2 text-body-sm">{t["profile.me.loading"]}</p>;
  if (me === "failed") return <p className="mt-2 text-body-sm">{t["profile.loadFailed"]}</p>;
  if (me.player) {
    const [before, after] = t["profile.me.linked"].split("{name}");
    return (
      <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
        <p className="min-w-0">
          {me.player.name === null ? (
            t["profile.me.gone"]
          ) : (
            <>
              {before}
              <b translate="no">{me.player.name}</b>
              {after}
            </>
          )}
        </p>
        <button
          type="button"
          disabled={busy}
          onClick={() => onLink(null)}
          className={buttonClass("secondary")}
        >
          {t["profile.me.unlink"]}
        </button>
      </div>
    );
  }
  const pick = { t, language, busy, onLink };
  return (
    <>
      {me.suggestions.length === 0 ? (
        <p className="mt-2 text-body-sm">{t["profile.me.none"]}</p>
      ) : (
        <>
          <p className="mt-2">{t["profile.me.ask"]}</p>
          <Pick {...pick} players={me.suggestions} />
        </>
      )}
      <Search {...pick} roster={me.roster} />
      <p className="mt-2 text-body-sm text-ink/70">{t["profile.me.undo"]}</p>
    </>
  );
}

type PickProps = {
  t: Words;
  language: WorkspaceLanguage;
  players: Player[];
  busy: boolean;
  onLink: (uid: number) => void;
};

/** "R4 · Goddess · Might 85.8M": what is known of the player, compact numbers as everywhere (D78). */
function detailOf(p: Player, t: Words, language: WorkspaceLanguage): string {
  const might =
    p.might === null
      ? null
      : Math.abs(p.might) < 1000
        ? String(p.might)
        : compactLarge(p.might, language);
  return [p.rank, might && t["members.meta.might"].replace("{v}", might)]
    .filter(Boolean)
    .join(" · ");
}

/** Players to choose from, each confirmed with its own "That’s me". */
function Pick({ t, language, players, busy, onLink }: PickProps) {
  return (
    <ul className="mt-1 grid gap-1.5">
      {players.map((p) => (
        <li key={p.uid} className="flex items-center justify-between gap-3">
          <span className="flex min-w-0 flex-col">
            <span translate="no" className="truncate font-semibold">
              {p.name}
            </span>
            <span className="text-body-sm text-ink/70">{detailOf(p, t, language)}</span>
          </span>
          <button
            type="button"
            disabled={busy}
            aria-label={`${p.name} · ${t["profile.me.confirm"]}`}
            onClick={() => onLink(p.uid)}
            className={buttonClass("secondary")}
          >
            {t["profile.me.confirm"]}
          </button>
        </li>
      ))}
    </ul>
  );
}

/** The alliance's newest roster, filtered as the officer types (name keys, D74), shown while none is linked. */
function Search({ roster, ...pick }: Omit<PickProps, "players"> & { roster: Player[] }) {
  const [query, setQuery] = useState("");
  const found = useMemo(() => searchRoster(query, roster), [query, roster]);
  return (
    <div className="mt-3">
      <label htmlFor="profile-find" className="text-body-sm font-semibold">
        {pick.t["profile.me.find"]}
      </label>
      <input
        id="profile-find"
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        maxLength={64}
        autoComplete="off"
        className="drawn-field mt-1 min-h-11 w-full px-3"
      />
      {query.trim() !== "" &&
        (found.length > 0 ? (
          <Pick {...pick} players={found} />
        ) : (
          <p role="status" className="mt-1 text-body-sm">
            {pick.t["profile.me.noResult"]}
          </p>
        ))}
    </div>
  );
}
