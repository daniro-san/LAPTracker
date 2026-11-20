"use client";

// Alliance settings → Features (D134, issue 476): each feature the site's owner allows, by group, one checkbox
// each, saved at once; a feature that spends tracker calls says about how many, and the card's first line
// adds up what the alliance's choices spend on its key. A feature the owner did not allow is not listed.
import { useRouter } from "next/navigation";
import { useState } from "react";

import { CheckField } from "@/lib/brand/components/CheckField";
import { fill } from "@/lib/copy";
import type { AllianceFeaturesView } from "@/lib/private/alliance-features";
import type { WorkspaceDictionary } from "@/lib/private/dictionary";

import { RefusalLine, SIGNED_OUT } from "./SignedOut";

/**
 * POST /api/w/[slug]/features. `saved`: the switch as the server stored it, or null when refused; `code`: the
 * refusal's code ("failed" for no answer).
 */
async function postSwitch(
  slug: string,
  feature: string,
  on: boolean,
): Promise<{ saved: boolean | null; code: string | null }> {
  const res = await fetch(`/api/w/${slug}/features`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ feature, on }),
  }).catch(() => null);
  const body = (await res?.json().catch(() => ({}))) as
    { code?: unknown; on?: unknown } | undefined;
  if (res?.ok && typeof body?.on === "boolean") return { saved: body.on, code: null };
  return { saved: null, code: typeof body?.code === "string" ? body.code : "failed" };
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
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // The box shows the tap at once; a refusal puts it back, and a save shows the value the server stored.
  const [tapped, setTapped] = useState<{ feature: string; on: boolean } | null>(null);
  const n = (x: number) => new Intl.NumberFormat(language).format(x);
  const turn = async (feature: string, on: boolean) => {
    setBusy(true);
    setError(null);
    setTapped({ feature, on });
    const { saved, code } = await postSwitch(slug, feature, on);
    setBusy(false);
    if (saved !== null) {
      setTapped({ feature, on: saved });
      return router.refresh();
    }
    setTapped(null);
    if (code === SIGNED_OUT) return setError(SIGNED_OUT);
    setError(t[code === "rate_limited" ? "switches.rateLimited" : "switches.failed"]);
    // not_allowed: the owner changed it meanwhile; the refreshed page leaves it out.
    if (code === "not_allowed") router.refresh();
  };
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
      {view.groups.map(({ group, features }) => (
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
                checked={tapped?.feature === f.feature ? tapped.on : f.on}
                disabled={busy}
                onChange={(e) => void turn(f.feature, e.currentTarget.checked)}
              />
            ))}
          </div>
        </fieldset>
      ))}
      {error && <RefusalLine text={error} className="mt-2 font-semibold text-seal" />}
    </section>
  );
}
