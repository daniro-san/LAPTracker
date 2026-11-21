"use client";

// Alliance settings → Raid Shield check (issue 474, D137): Saturday's read time (10:00 to 11:00 ST) and the
// Discord summary (only to the Raid Shield channel, D147), opt-in, in a language the officers pick. Shown
// only while the check is on (D134). One Save; a refusal or no answer says so and keeps what was typed.
import { useState } from "react";

import { Button } from "@/lib/brand/components/Button";
import { CheckField } from "@/lib/brand/components/CheckField";
import { FIELD } from "@/lib/brand/components/controls";
import { hhmm } from "@/lib/private/calendar-time";
import type { WorkspaceDictionary, WorkspaceLanguage } from "@/lib/private/dictionary";
import type { ShieldSettingsView } from "@/lib/private/shield-settings";

import { RefusalLine, SIGNED_OUT } from "./SignedOut";

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
  const [v, setV] = useState(props.view);
  const [state, setState] = useState<"idle" | "busy" | "saved" | string>("idle");
  const save = async () => {
    setState("busy");
    const res = await fetch(`/api/w/${props.slug}/raid-prep`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(v),
    }).catch(() => null);
    if (res?.ok) return setState("saved");
    setState(res?.status === 401 ? SIGNED_OUT : t["prep.settings.failed"]);
  };
  const failed = !["idle", "busy", "saved"].includes(state);
  return (
    <section aria-labelledby="raid-prep" className="drawn-card mt-4 max-w-2xl px-4 py-3">
      <h2 id="raid-prep" className="font-subhead text-display-sm">
        {t["prep.settings.head"]}
      </h2>
      <p className="mt-1">{t["prep.settings.lead"]}</p>
      <label className="mt-3 block">
        <span className="font-medium">{t["prep.settings.morning"]}</span>
        <select
          value={v.morningMinute}
          onChange={(e) => setV({ ...v, morningMinute: Number(e.target.value) })}
          className={`${FIELD} mt-1 max-w-40 text-[16px]`}
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
          onChange={(e) => setV({ ...v, discord: e.target.checked })}
        />
      </div>
      {v.discord && (
        <label className="mt-2 block">
          <span className="font-medium">{t["prep.settings.language"]}</span>
          <select
            value={v.language}
            onChange={(e) => setV({ ...v, language: e.target.value as WorkspaceLanguage })}
            className={`${FIELD} mt-1 max-w-56 text-[16px]`}
          >
            {LANGUAGES.map((l) => (
              <option key={l.code} value={l.code}>
                {l.name}
              </option>
            ))}
          </select>
        </label>
      )}
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <Button disabled={state === "busy"} onClick={() => void save()}>
          {t["prep.settings.save"]}
        </Button>
        {state === "saved" && (
          <p role="status" className="text-body-sm font-semibold text-plum">
            {t["prep.settings.saved"]}
          </p>
        )}
        {failed && <RefusalLine text={state} className="text-seal" />}
      </div>
    </section>
  );
}
