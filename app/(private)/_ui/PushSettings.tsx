"use client";

// Alliance settings → Notifications (D148): this officer's own device. One switch per use the workspace offers;
// "Enable on this device" asks the browser's permission only on that tap, then saves the subscription. Once
// on, a switch saves at once; "Turn off on this device" ends it here and on the server. The card says how
// iPhone and Android take notifications, and that they hold counts only. Shown only when the site has push keys.
import { useEffect, useState } from "react";

import { track } from "@/lib/analytics/events";
import { Button } from "@/lib/brand/components/Button";
import { CheckField } from "@/lib/brand/components/CheckField";
import type { WorkspaceDictionary, WorkspaceLanguage } from "@/lib/private/dictionary";
import type { PushView } from "@/lib/private/push-settings";
import type { PushUse } from "@/lib/schema-push";

import {
  canPush,
  currentSubscription,
  endpointHash,
  subscribe,
  subscriptionBody,
} from "./push-client";
import { RefusalLine, SIGNED_OUT } from "./SignedOut";

type Phase = "checking" | "unsupported" | "blocked" | "off" | "on";

/** This device's state: on (the server has its row), off, blocked by the browser, or unable. */
async function deviceState(slug: string, view: PushView) {
  if (!canPush()) return { phase: "unsupported" as const, uses: null };
  if (Notification.permission === "denied") return { phase: "blocked" as const, uses: null };
  const sub = await currentSubscription(slug);
  const hash = sub ? await endpointHash(sub.endpoint) : null;
  const row = view.devices.find((d) => d.hash === hash);
  return row ? { phase: "on" as const, uses: row.uses } : { phase: "off" as const, uses: null };
}

type Props = {
  slug: string;
  view: PushView;
  language: WorkspaceLanguage;
  t: WorkspaceDictionary;
};

/** The device's state and the card's three actions: enable, turn off, flip one use. */
function usePushDevice(props: Props) {
  const { slug, view, t } = props;
  const [phase, setPhase] = useState<Phase>("checking");
  const [uses, setUses] = useState<PushUse[]>(view.offered);
  const [note, setNote] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    void deviceState(slug, view).then((s) => {
      setPhase(s.phase);
      if (s.uses) setUses(s.uses);
    });
  }, [slug, view]);

  const post = async (body: unknown) => {
    const res = await fetch(`/api/w/${slug}/push`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    }).catch(() => null);
    if (!res?.ok) setNote(res?.status === 401 ? SIGNED_OUT : t["push.failed"]);
    return res;
  };

  const enable = async () => {
    setBusy(true);
    setNote(null);
    try {
      // The permission prompt comes only from this tap (iPhone requires it inside the tap).
      const permission = await Notification.requestPermission();
      if (permission !== "granted") return setPhase(permission === "denied" ? "blocked" : "off");
      const sub = await subscribe(slug, view.publicKey);
      const body = { subscription: subscriptionBody(sub), uses, language: props.language };
      const res = await post({ action: "subscribe", ...body });
      if (!res?.ok) return;
      setPhase("on");
      for (const use of uses) track("ws_push_enabled", { use });
    } catch {
      setNote(t["push.failed"]);
    } finally {
      setBusy(false);
    }
  };

  const disable = async () => {
    setBusy(true);
    setNote(null);
    const sub = await currentSubscription(slug).catch(() => null);
    const res = sub ? await post({ action: "unsubscribe", endpoint: sub.endpoint }) : null;
    if (!sub || res?.ok) {
      await sub?.unsubscribe().catch(() => false);
      setPhase("off");
      for (const use of uses) track("ws_push_disabled", { use });
    }
    setBusy(false);
  };

  const flip = async (use: PushUse, on: boolean) => {
    const next = view.offered.filter((u) => (u === use ? on : uses.includes(u)));
    setUses(next);
    if (phase !== "on") return;
    setNote(null);
    const sub = await currentSubscription(slug).catch(() => null);
    if (!sub) return setPhase("off");
    const res = await post({
      action: "uses",
      endpoint: sub.endpoint,
      uses: next,
      language: props.language,
    });
    if (res?.status === 404) return setPhase("off");
    if (!res?.ok) return setUses(uses);
    setNote(t["push.saved"]);
    track(on ? "ws_push_enabled" : "ws_push_disabled", { use });
  };
  return { phase, uses, note, busy, enable, disable, flip };
}

export function PushSettings(props: Props) {
  const { view, t } = props;
  const { phase, uses, note, busy, enable, disable, flip } = usePushDevice(props);
  return (
    <section aria-labelledby="push" className="drawn-card mt-4 max-w-2xl px-4 py-3">
      <h2 id="push" className="font-subhead text-display-sm">
        {t["push.head"]}
      </h2>
      <p className="mt-1">{t["push.lead"]}</p>
      <p className="mt-1 text-body-sm text-ink/70">{t["push.private"]}</p>
      {phase !== "unsupported" && phase !== "blocked" && (
        <fieldset className="mt-3 flex flex-col gap-1" disabled={busy || phase === "checking"}>
          <legend className="sr-only">{t["push.head"]}</legend>
          {view.offered.map((use) => (
            <CheckField
              key={use}
              label={t[`push.use.${use}`]}
              help={t[`push.use.${use}.help`]}
              checked={uses.includes(use)}
              onChange={(e) => void flip(use, e.target.checked)}
            />
          ))}
        </fieldset>
      )}
      <PushActions phase={phase} busy={busy} onEnable={enable} onDisable={disable} t={t} />
      {note && note !== t["push.saved"] && <RefusalLine text={note} className="mt-2 text-seal" />}
      {note === t["push.saved"] && (
        <p role="status" className="mt-2 text-body-sm font-semibold text-plum">
          {note}
        </p>
      )}
      <ul className="mt-3 flex list-disc flex-col gap-1 pl-5 text-body-sm">
        <li>{t["push.ios"]}</li>
        <li>{t["push.android"]}</li>
        <li>{t["push.session"]}</li>
      </ul>
    </section>
  );
}

/** The device's state in words and its one button. */
function PushActions(props: {
  phase: Phase;
  busy: boolean;
  onEnable: () => Promise<unknown>;
  onDisable: () => Promise<unknown>;
  t: WorkspaceDictionary;
}) {
  const { phase, t } = props;
  if (phase === "checking") return null;
  if (phase === "unsupported" || phase === "blocked") {
    return (
      <p role="status" className="mt-3 font-medium">
        {t[phase === "blocked" ? "push.blocked" : "push.unsupported"]}
      </p>
    );
  }
  const on = phase === "on";
  return (
    <div className="mt-3 flex flex-wrap items-center gap-3">
      <p className="font-medium">{t[on ? "push.on" : "push.off"]}</p>
      <Button
        variant={on ? "secondary" : "primary"}
        disabled={props.busy}
        onClick={() => void (on ? props.onDisable() : props.onEnable())}
      >
        {t[on ? "push.disable" : "push.enable"]}
      </Button>
    </div>
  );
}
