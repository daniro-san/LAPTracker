"use client";

// Alliance settings → Raid Shield check (issue 474, D137): Saturday's read time (10:00 to 11:00 ST) and the
// Discord summary (only to the Raid Shield channel, D147), opt-in, in a language the officers pick. Shown
// only while the check is on (D134). One Save, in the settings' save row (issue 585): off while nothing
// changed, "Not saved yet" while something did; a refusal or no answer says so and keeps what was typed.
import { useRouter } from "next/navigation";
import { useState } from "react";

import { CheckField } from "@/lib/brand/components/CheckField";
import { FIELD } from "@/lib/brand/components/controls";
import { hhmm } from "@/lib/private/calendar-time";
import type { WorkspaceDictionary, WorkspaceLanguage } from "@/lib/private/dictionary";
import type { ShieldSettingsView } from "@/lib/private/shield-settings";

import { SaveRow } from "./SaveRow";
import { SIGNED_OUT } from "./SignedOut";

const LANGUAGES: { code: WorkspaceLanguage; name: string }[] = [
  { code: "en", name: "English" },
  { code: "pt-BR", name: "Português" },
  { code: "fr", name: "Français" },
];

/**
 * The switch's help line: what the summary does, or why it has no channel yet (D147). Switched on with no
 * Raid Shield channel, it says plainly that nothing is posted (the leaders' channel is never used).
 */
function helpKey(channel: "ok" | "reenter" | "none", on: boolean): keyof WorkspaceDictionary {
  if (channel === "ok") return "prep.settings.discordHelp";
  if (channel === "reenter") return "prep.settings.reenter";
  return on ? "prep.settings.notPosting" : "prep.settings.noChannel";
}

/** The card's values, how many differ from what the server has, and Save. */
function useShieldSettings(slug: string, view: ShieldSettingsView, t: WorkspaceDictionary) {
  const router = useRouter();
  const [v, setV] = useState(view);
  // What the server has: the page's view, then each save that went through.
  const [kept, setKept] = useState(view);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const changes = (["morningMinute", "discord", "language"] as const).filter(
    (k) => v[k] !== kept[k],
  ).length;
  const change = (next: ShieldSettingsView) => {
    setSaved(false);
    setV(next);
  };
  const save = async () => {
    setBusy(true);
    setError(null);
    const res = await fetch(`/api/w/${slug}/raid-prep`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(v),
    }).catch(() => null);
    setBusy(false);
    if (res?.ok) {
      setKept(v);
      setSaved(true);
      // The page's "On this page" row reads the stored value ("Summary to Discord: on").
      return router.refresh();
    }
    setError(res?.status === 401 ? SIGNED_OUT : t["prep.settings.failed"]);
  };
  return { v, change, changes, busy, saved, error, save };
}

export function RaidPrepSettings(props: {
  slug: string;
  view: ShieldSettingsView;
  choices: number[];
  /**
   * ok: the Raid Shield channel can take the message (D129, D147; never the leaders'); reenter:
   * the saved Raid Shield webhook must be pasted again; none: no channel yet.
   */
  channel: "ok" | "reenter" | "none";
  t: WorkspaceDictionary;
}) {
  const { t } = props;
  const { v, change, changes, busy, saved, error, save } = useShieldSettings(
    props.slug,
    props.view,
    t,
  );
  return (
    <section aria-labelledby="raid-prep" className="drawn-card mt-4 max-w-2xl px-4 py-3">
      <h2 id="raid-prep" className="font-subhead text-display-sm">
        {t["prep.settings.head"]}
      </h2>
      <p className="mt-1">{t["prep.settings.lead"]}</p>
      <label className="mt-3 grid justify-items-start gap-2">
        <span className="font-medium">{t["prep.settings.morning"]}</span>
        <select
          value={v.morningMinute}
          onChange={(e) => change({ ...v, morningMinute: Number(e.target.value) })}
          className={`${FIELD} max-w-40 text-[16px]`}
        >
          {props.choices.map((m) => (
            <option key={m} value={m}>
              {hhmm(m)}
            </option>
          ))}
        </select>
      </label>
      <div className="mt-3">
        <CheckField
          label={t["prep.settings.discord"]}
          help={t[helpKey(props.channel, v.discord)]}
          checked={v.discord}
          disabled={props.channel !== "ok" && !v.discord}
          onChange={(e) => change({ ...v, discord: e.target.checked })}
        />
      </div>
      {v.discord && (
        <label className="mt-3 grid justify-items-start gap-2">
          <span className="font-medium">{t["prep.settings.language"]}</span>
          <select
            value={v.language}
            onChange={(e) => change({ ...v, language: e.target.value as WorkspaceLanguage })}
            className={`${FIELD} max-w-56 text-[16px]`}
          >
            {LANGUAGES.map((l) => (
              <option key={l.code} value={l.code}>
                {l.name}
              </option>
            ))}
          </select>
        </label>
      )}
      <SaveRow
        changes={changes}
        busy={busy}
        saved={saved}
        error={error}
        onSave={() => void save()}
        t={t}
      />
    </section>
  );
}
