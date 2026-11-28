"use client";

// Alliance settings → Features (D134, issue 476): each feature the site's owner allows, by group, one checkbox
// each; a feature that spends tracker calls says about how many, and the card's first line adds up what the
// alliance's choices spend on its key. A feature the owner did not allow is not listed. Since issue 585 a tick
// changes only the draft: Save sends one switch at a time (`sendChanges`), and "Not saved yet" shows until then.
// D162: a feature the alliance's plan leaves out shows a "Premium" note in its group instead of a checkbox,
// and a link opens the Plans page.
import { useRouter } from "next/navigation";
import { useState } from "react";

import { CheckField } from "@/lib/brand/components/CheckField";
import { TextLink } from "@/lib/brand/components/TextLink";
import type { AllianceFeaturesView } from "@/lib/private/alliance-features";
import type { WorkspaceDictionary } from "@/lib/private/dictionary";
import { fill } from "@/lib/words";

import { PremiumNote } from "./PremiumNote";
import { SaveRow } from "./SaveRow";
import {
  afterSave,
  featureChanges,
  refusalWords,
  sendChanges,
  shownOn,
  type SwitchPost,
} from "./settings-save";
import { SIGNED_OUT } from "./SignedOut";

/**
 * POST /api/w/[slug]/features. `saved`: the switch as the server stored it, or null when refused; `code`: the
 * refusal's code ("failed" for no answer).
 */
const postSwitch =
  (slug: string): SwitchPost =>
  async ({ feature, on }) => {
    const res = await fetch(`/api/w/${slug}/features`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ feature, on }),
    }).catch(() => null);
    const body = (await res?.json().catch(() => ({}))) as
      { code?: unknown; on?: unknown } | undefined;
    if (res?.ok && typeof body?.on === "boolean") return { saved: body.on, code: null };
    return { saved: null, code: typeof body?.code === "string" ? body.code : "failed" };
  };

/** The officer's ticks as a draft, and Save: one switch at a time, the rest kept on a refusal. */
function useFeatureDraft(slug: string, view: AllianceFeaturesView, t: WorkspaceDictionary) {
  const router = useRouter();
  const stored = Object.fromEntries(
    view.groups.flatMap((g) => g.features.map((f) => [f.feature, f.on] as const)),
  );
  // The boxes the officer changed and has not saved. `sent`: what the last Save stored, shown until the
  // refreshed page (a new `view`) brings the stored values.
  const [draft, setDraft] = useState<Record<string, boolean>>({});
  const [sent, setSent] = useState<{ view: AllianceFeaturesView; on: Record<string, boolean> }>({
    view,
    on: {},
  });
  const through = sent.view === view ? sent.on : {};
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const changes = featureChanges({ ...stored, ...through }, { ...stored, ...through, ...draft });
  const tick = (feature: string, on: boolean) => {
    setSaved(false);
    setDraft((d) => ({ ...d, [feature]: on }));
  };
  const save = async () => {
    setBusy(true);
    setError(null);
    const result = await sendChanges(changes, postSwitch(slug));
    setBusy(false);
    // What went through is stored now; what was not sent stays in the draft as "Not saved yet".
    const next = afterSave(changes, result, through);
    setSent({ view, on: next.through });
    setDraft(next.draft);
    setSaved(result.code === null);
    // not_allowed: the owner changed it meanwhile; the refreshed page leaves it out.
    router.refresh();
    const { code } = result;
    if (code === null) return;
    setError(code === SIGNED_OUT ? SIGNED_OUT : refusalWords(code, result.unsent[0], t));
  };
  const checked = (feature: string, on: boolean) => shownOn(feature, on, draft, through);
  return { checked, tick, changes: changes.length, busy, saved, error, save };
}

export function AllianceFeatures({
  slug,
  view,
  language,
  t,
}: {
  slug: string;
  view: AllianceFeaturesView;
  language: string;
  t: WorkspaceDictionary;
}) {
  const { checked, tick, changes, busy, saved, error, save } = useFeatureDraft(slug, view, t);
  const n = (x: number) => new Intl.NumberFormat(language).format(x);
  const { daily, peak } = view.estimate;
  return (
    <section aria-labelledby="features" className="drawn-card mt-6 max-w-2xl px-4 py-3">
      <h2 id="features" className="font-subhead text-display-sm">
        {t["switches.head"]}
      </h2>
      <p className="mt-1">{t["switches.lead"]}</p>
      <p className="mt-2 font-semibold">
        {fill(t[peak > daily ? "switches.estimatePeak" : "switches.estimate"], {
          daily: n(daily),
          peak: n(peak),
          members: n(view.members),
        })}
      </p>
      {view.groups.map(({ group, features, premium }) => (
        <fieldset key={group} className="mt-4">
          <legend className="font-subhead text-body-lg font-semibold">
            {t[`switches.group.${group}`]}
          </legend>
          <div className="mt-1 grid gap-1">
            {features.map((f) => (
              <CheckField
                key={f.feature}
                label={t[`switches.name.${f.feature}`]}
                help={
                  f.calls
                    ? fill(t[f.calls.weekly ? "switches.callsWeekly" : "switches.calls"], {
                        n: n(f.calls.n),
                      })
                    : undefined
                }
                checked={checked(f.feature, f.on)}
                disabled={busy}
                onChange={(e) => tick(f.feature, e.currentTarget.checked)}
              />
            ))}
            {premium.map((f) => (
              <PremiumNote key={f} slug={slug} name={t[`switches.name.${f}`]} t={t} />
            ))}
          </div>
        </fieldset>
      ))}
      <p className="mt-4">
        {t["plans.cardLead"]}{" "}
        <TextLink href={`/w/${slug}/settings/plans`} className="inline-flex min-h-11 items-center">
          {t["plans.see"]}
        </TextLink>
      </p>
      <SaveRow
        changes={changes}
        busy={busy}
        saved={saved}
        error={error}
        onSave={() => void save()}
        t={t}
        language={language}
      />
    </section>
  );
}
