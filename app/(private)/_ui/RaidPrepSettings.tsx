"use client";

// Alliance settings → Raid Shield check (issue 474, D137): the reads' times (issue 859: the night check, the
// morning check, the after-reset check on or off and its time; only the times whose window meets no
// event's), the tracker calls they cost and the trade-off of an earlier after-reset check, and the Discord
// summary (only to the Raid Shield channel, D147), opt-in, in a language the officers pick. Shown only
// while the check is on (D134). One Save, in the settings' save row (issue 585): off while nothing changed,
// "Not saved yet" while something did; a refusal or no answer says so and keeps what was typed.
import { useRouter } from "next/navigation";
import { useState } from "react";

import { CheckField } from "@/lib/brand/components/CheckField";
import { FIELD } from "@/lib/brand/components/controls";
import { hhmm } from "@/lib/private/calendar-time";
import type { WorkspaceDictionary, WorkspaceLanguage } from "@/lib/private/dictionary";
import type { ShieldSettingsView } from "@/lib/private/shield-settings";
import { fill } from "@/lib/words";
import { TRACKER_CALLS } from "@/lib/workspace-features";

const KEYS = [
  "nightMinute",
  "morningMinute",
  "resetRead",
  "resetMinute",
  "discord",
  "language",
] as const;

/** Why a save was refused, in the card's words. */
const REFUSED: Partial<Record<string, keyof WorkspaceDictionary>> = {
  event_window: "prep.settings.eventWindow",
  reads_overlap: "prep.settings.readsOverlap",
};

/**
 * The tracker calls the reads cost (D124, `TRACKER_CALLS`): one call per member a read, the after-reset
 * check's only while it is on.
 */
export const shieldCalls = (members: number, resetRead: boolean) =>
  Math.ceil(members * ((TRACKER_CALLS.shield_check?.perMember ?? 0) - (resetRead ? 0 : 1)));

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
type CardView = ShieldSettingsView & { members: number };

function useShieldSettings(slug: string, view: CardView, t: WorkspaceDictionary) {
  const router = useRouter();
  const [v, setV] = useState(view);
  // What the server has: the page's view, then each save that went through.
  const [kept, setKept] = useState(view);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const changes = KEYS.filter((k) => v[k] !== kept[k]).length;
  const change = (next: CardView) => {
    setSaved(false);
    setV(next);
  };
  const save = async () => {
    setBusy(true);
    setError(null);
    const body = Object.fromEntries(KEYS.map((k) => [k, v[k]]));
    const res = await fetch(`/api/w/${slug}/raid-prep`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    }).catch(() => null);
    setBusy(false);
    if (res?.ok) {
      setKept(v);
      setSaved(true);
      // The page's "On this page" row reads the stored value ("Summary to Discord: on").
      return router.refresh();
    }
    if (res?.status === 401) return setError(SIGNED_OUT);
    const code = res?.status === 409 ? ((await res.json().catch(() => null))?.code ?? "") : "";
    setError(t[REFUSED[code] ?? "prep.settings.failed"]);
  };
  return { v, change, changes, busy, saved, error, save };
}

/** One read's time: the ticks it may take (`choices`), as ST clock times. */
function TimeSelect(props: {
  label: string;
  value: number;
  choices: number[];
  onChange: (minute: number) => void;
}) {
  return (
    <label className="mt-3 grid justify-items-start gap-2">
      <span className="font-medium">{props.label}</span>
      <select
        value={props.value}
        onChange={(e) => props.onChange(Number(e.target.value))}
        className={`${FIELD} max-w-40 text-[16px]`}
      >
        {props.choices.map((m) => (
          <option key={m} value={m}>
            {hhmm(m)}
          </option>
        ))}
      </select>
    </label>
  );
}

/** The three reads' times in the order they run, with the calls they cost and the after-reset trade-off. */
function ReadTimes(props: {
  v: CardView;
  change: (next: CardView) => void;
  choices: { night: number[]; morning: number[]; reset: number[] };
  t: WorkspaceDictionary;
  language: string;
}) {
  const { v, change, choices, t } = props;
  return (
    <>
      <p className="mt-2 font-semibold">
        {fill(t["switches.callsWeekly"], {
          n: new Intl.NumberFormat(props.language).format(shieldCalls(v.members, v.resetRead)),
        })}
      </p>
      <TimeSelect
        label={t["prep.settings.night"]}
        value={v.nightMinute}
        choices={choices.night}
        onChange={(nightMinute) => change({ ...v, nightMinute })}
      />
      <div className="mt-3">
        <CheckField
          label={t["prep.settings.reset"]}
          help={t["prep.settings.resetHelp"]}
          checked={v.resetRead}
          onChange={(e) => change({ ...v, resetRead: e.target.checked })}
        />
      </div>
      {v.resetRead && (
        <>
          <TimeSelect
            label={t["prep.settings.resetAt"]}
            value={v.resetMinute}
            choices={choices.reset}
            onChange={(resetMinute) => change({ ...v, resetMinute })}
          />
          <p className="mt-2 text-body-sm text-ink/80">{t["prep.settings.tradeoff"]}</p>
        </>
      )}
      <TimeSelect
        label={t["prep.settings.morning"]}
        value={v.morningMinute}
        choices={choices.morning}
        onChange={(morningMinute) => change({ ...v, morningMinute })}
      />
    </>
  );
}

export function RaidPrepSettings(props: {
  slug: string;
  view: CardView;
  /** Each read's times whose window meets no event's (D160), from `timeChoices`. */
  choices: { night: number[]; morning: number[]; reset: number[] };
  /**
   * ok: the Raid Shield channel can take the message (D129, D147; never the leaders'); reenter:
   * the saved Raid Shield webhook must be pasted again; none: no channel yet.
   */
  channel: "ok" | "reenter" | "none";
  t: WorkspaceDictionary;
  language: string;
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
      <ReadTimes v={v} change={change} choices={props.choices} t={t} language={props.language} />
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
        language={props.language}
      />
    </section>
  );
}
