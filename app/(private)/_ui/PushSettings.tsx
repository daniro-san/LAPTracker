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

type Phase = "checking" | "unsupported" | "iosTab" | "blocked" | "off" | "on";

/** Safari on an iPhone or iPad outside the Home Screen app: push exists only in the app. */
const iosTab = () => {
  const apple =
    /iPhone|iPad|iPod/.test(navigator.userAgent) ||
    (navigator.userAgent.includes("Macintosh") && navigator.maxTouchPoints > 1);
  return apple && !window.matchMedia("(display-mode: standalone)").matches;
};

/** This device's state: on (the server has its row), off, blocked by the browser, or unable. */
async function deviceState(slug: string, view: PushView) {
  if (!canPush())
    return { phase: iosTab() ? ("iosTab" as const) : ("unsupported" as const), uses: null };
  if (Notification.permission === "denied") return { phase: "blocked" as const, uses: null };
  const sub = await currentSubscription(slug);
  const hash = sub ? await endpointHash(sub.endpoint) : null;
  const row = view.devices.find((d) => d.hash === hash);
  return row ? { phase: "on" as const, uses: row.uses } : { phase: "off" as const, uses: null };
}

/** Worker registration plus subscribe: some browsers never answer (Brave with Google push off, or a worker that never activates). */
const SUBSCRIBE_TIMEOUT_MS = 20_000;

class TimedOut extends Error {}

function withTimeout<T>(work: Promise<T>, ms: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout>;
  const late = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new TimedOut()), ms);
  });
  return Promise.race([work, late]).finally(() => clearTimeout(timer));
}

/** The failure line for a save to the server that did not go through. */
const failureNote = (res: Response | null, t: WorkspaceDictionary) =>
  res?.status === 401 ? SIGNED_OUT : t["push.failed"];

/**
 * The browser's subscription, then the save. A refused subscription says so on its own: nothing reached the
 * server, and "Not saved" would send the officer to retry what the browser's push service will refuse again.
 */
export async function enableDevice(
  subscribe: () => Promise<PushSubscription>,
  save: (sub: PushSubscription) => Promise<Response | null>,
  t: WorkspaceDictionary,
): Promise<{ done: true } | { note: string }> {
  let sub: PushSubscription;
  try {
    sub = await withTimeout(subscribe(), SUBSCRIBE_TIMEOUT_MS);
  } catch (e) {
    return { note: t[e instanceof TimedOut ? "push.timedOut" : "push.serviceRefused"] };
  }
  const res = await save(sub).catch(() => null);
  return res?.ok ? { done: true } : { note: failureNote(res, t) };
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
  // The night read's failure asks nothing of an officer: off until someone wants it.
  const [uses, setUses] = useState<PushUse[]>(view.offered.filter((u) => u !== "night_read"));
  const [note, setNote] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    void deviceState(slug, view).then((s) => {
      setPhase(s.phase);
      if (s.uses) setUses(s.uses);
    });
  }, [slug, view]);

  const send = (body: unknown) =>
    fetch(`/api/w/${slug}/push`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    }).catch(() => null);
  const post = async (body: unknown) => {
    const res = await send(body);
    if (!res?.ok) setNote(failureNote(res, t));
    return res;
  };

  const enable = async () => {
    setBusy(true);
    setNote(null);
    try {
      // The permission prompt comes only from this tap (iPhone requires it inside the tap).
      const permission = await Notification.requestPermission();
      if (permission !== "granted") return setPhase(permission === "denied" ? "blocked" : "off");
      const result = await enableDevice(
        () => subscribe(slug, view.publicKey),
        (sub) =>
          send({
            action: "subscribe",
            subscription: subscriptionBody(sub),
            uses,
            language: props.language,
          }),
        t,
      );
      if ("note" in result) return setNote(result.note);
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
    // The switches wait for this save, so two quick flips never overlap.
    setBusy(true);
    const sub = await currentSubscription(slug).catch(() => null);
    const body = { action: "uses", endpoint: sub?.endpoint, uses: next, language: props.language };
    const res = sub ? await post(body) : null;
    setBusy(false);
    if (!sub || res?.status === 404) return setPhase("off");
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
      {/* The device's state and its button first, so ticked switches never read as "on" (QA). */}
      <PushActions phase={phase} busy={busy} onEnable={enable} onDisable={disable} t={t} />
      {(phase === "checking" || phase === "off" || phase === "on") && (
        <fieldset className="mt-3 flex flex-col gap-1" disabled={busy || phase === "checking"}>
          <legend className="mb-1 font-medium">{t["push.about"]}</legend>
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
      {note && note !== t["push.saved"] && <RefusalLine text={note} className="mt-2 text-seal" />}
      {note === t["push.saved"] && (
        <p role="status" className="mt-2 text-body-sm font-semibold text-plum">
          {note}
        </p>
      )}
      <ul className="mt-3 flex list-disc flex-col gap-1 pl-5 text-body-sm">
        <li>{t["push.ios"]}</li>
        <li>{t["push.iosSignIn"]}</li>
        <li>{t["push.android"]}</li>
        <li>{t["push.brave"]}</li>
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
  if (phase === "unsupported" || phase === "iosTab" || phase === "blocked") {
    const said = {
      unsupported: "push.unsupported",
      iosTab: "push.iosTab",
      blocked: "push.blocked",
    } as const;
    return (
      <p role="status" className="mt-3 font-medium">
        {t[said[phase]]}
      </p>
    );
  }
  const on = phase === "on";
  return (
    <div className="mt-3 flex flex-wrap items-center gap-3">
      <p role="status" className="font-medium">
        {t[on ? "push.on" : "push.off"]}
      </p>
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
