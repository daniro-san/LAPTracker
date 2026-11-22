"use client";

// /admin's New alliances card (D130, issue 453): "Create the invite link" for a tracked alliance with no
// workspace, the links made with their state and Cancel, and the requests with Approve (the same link) and
// Decline (an optional reason). Each press sends the PIN as x-edit-pin, like the Workspaces card. A link is
// shown once, with Copy; the server keeps only its hash. Approving or inviting counts as
// `admin_workspace_approved` (issue 486).
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { track } from "@/lib/analytics/events";
import { buttonClass } from "@/lib/brand/components/Button";
import { copy } from "@/lib/copy";
import { fill } from "@/lib/words";

import { ConfirmSheet } from "./ConfirmSheet";
import { Result } from "./outcome";
import { forgetPin, PinSheet, savedPin } from "./PinSheet";
import { Field, FIELD } from "./WorkspaceForm";

const t = copy.admin.invites;

export interface InviteRowView {
  id: number;
  alliance: string;
  line: string;
  open: boolean;
}
export interface RequestRowView {
  id: number;
  alliance: string;
  line: string;
  roster: string;
  /** A claimed R5 that the roster lists as R4, highlighted; null otherwise. */
  warning: string | null;
  /** "Approved 20 Nov" once answered; null while waiting. */
  decided: string | null;
}

type Answer = Record<string, unknown>;
type Call = { body: unknown; alliance: string; done?: (a: Answer) => void };

const dateText = (iso: string) =>
  new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", timeZone: "UTC" }).format(
    new Date(iso),
  );

function usePinPost() {
  const router = useRouter();
  const [message, setMessage] = useState<string | null>(null);
  const [link, setLink] = useState<{ head: string; url: string; help: string } | null>(null);
  const [pending, setPending] = useState<Call | null>(null);
  const [busy, refresh] = useTransition();
  async function send(call: Call, pin: string) {
    const res = await fetch("/api/admin/invites", {
      method: "POST",
      headers: { "x-edit-pin": pin, "content-type": "application/json" },
      body: JSON.stringify(call.body),
    }).catch(() => null);
    const answer = ((await res?.json().catch(() => ({}))) ?? {}) as Answer;
    if (res?.status === 401) forgetPin();
    if (!res?.ok) {
      const code = String(answer.code ?? "failed") as keyof typeof t.errors;
      return setMessage(`✗ ${t.errors[code] ?? t.errors.failed}`);
    }
    if (typeof answer.link === "string") {
      track("admin_workspace_approved");
      const date = dateText(String(answer.expires_at));
      const head = fill(t.link.head, { alliance: call.alliance });
      setLink({ head, url: answer.link, help: fill(t.link.help, { date }) });
    }
    refresh(() => router.refresh());
  }
  const run = (call: Call) => {
    setMessage(null);
    setLink(null);
    const pin = savedPin();
    if (pin) void send(call, pin);
    else setPending(call);
  };
  const sheet = pending && (
    <PinSheet
      onCancel={() => setPending(null)}
      onUnlocked={(pin) => {
        setPending(null);
        void send(pending, pin);
      }}
    />
  );
  return { run, message, link, sheet, busy };
}

/** The link, shown once, with Copy. */
function LinkBox({ link }: { link: { head: string; url: string; help: string } }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="drawn-card mt-4 grid gap-2 px-4 py-3" role="status">
      <h4 className="font-subhead text-body-lg font-semibold">{link.head}</h4>
      <p className="text-body-sm break-all" data-invite-link>
        {link.url}
      </p>
      <p className="text-body-sm text-ink/75">{link.help}</p>
      <button
        type="button"
        className={buttonClass("primary", "font-semibold")}
        onClick={() =>
          void navigator.clipboard.writeText(link.url).then(
            () => setCopied(true),
            () => setCopied(false),
          )
        }
      >
        {copied ? t.link.copied : t.link.copy}
      </button>
    </div>
  );
}

function CreateForm(props: {
  alliances: { unionId: number; label: string }[];
  run: (c: Call) => void;
}) {
  const [unionId, setUnionId] = useState(props.alliances[0]?.unionId ?? 0);
  if (props.alliances.length === 0) return <p className="mt-2">{t.create.none}</p>;
  const label = props.alliances.find((a) => a.unionId === unionId)?.label ?? "";
  return (
    <form
      className="mt-3 grid gap-3 sm:max-w-xl"
      onSubmit={(e) => {
        e.preventDefault();
        props.run({ body: { action: "create", union_id: unionId }, alliance: label });
      }}
    >
      <Field label={t.create.alliance}>
        <select
          value={unionId}
          onChange={(e) => setUnionId(Number(e.target.value))}
          className={FIELD}
        >
          {props.alliances.map((a) => (
            <option key={a.unionId} value={a.unionId}>
              {a.label}
            </option>
          ))}
        </select>
      </Field>
      <button type="submit" className={buttonClass("primary", "font-semibold")}>
        {t.create.button}
      </button>
    </form>
  );
}

function RequestRow({ r, run }: { r: RequestRowView; run: (c: Call) => void }) {
  const [declining, setDeclining] = useState(false);
  const [reason, setReason] = useState("");
  return (
    <li className="grid gap-2 border-t border-ink/15 py-3">
      <p className="break-words font-semibold">{r.line}</p>
      <p className="text-body-sm">{r.roster}</p>
      {r.warning && <p className="text-body-sm font-semibold text-plum">{r.warning}</p>}
      {r.decided ? (
        <p className="text-body-sm text-ink/75">{r.decided}</p>
      ) : (
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className={buttonClass("primary", "font-semibold")}
            onClick={() =>
              run({ body: { action: "approve", request_id: r.id }, alliance: r.alliance })
            }
          >
            {t.requests.approve}
          </button>
          <button
            type="button"
            className={buttonClass("secondary")}
            aria-expanded={declining}
            onClick={() => setDeclining(!declining)}
          >
            {t.requests.decline}
          </button>
        </div>
      )}
      {declining && !r.decided && (
        <form
          className="grid gap-2 sm:max-w-xl"
          onSubmit={(e) => {
            e.preventDefault();
            const body = { action: "decline", request_id: r.id, reason: reason.trim() || null };
            run({ body, alliance: r.alliance });
          }}
        >
          <Field label={t.requests.reason}>
            <input
              value={reason}
              maxLength={300}
              onChange={(e) => setReason(e.target.value)}
              className={FIELD}
            />
          </Field>
          <button type="submit" className={buttonClass("secondary", "font-semibold")}>
            {t.requests.declineYes}
          </button>
        </form>
      )}
    </li>
  );
}

export function InvitesCard(props: {
  alliances: { unionId: number; label: string }[];
  invites: InviteRowView[];
  requests: RequestRowView[];
  /** "Showing the newest 50…" when there are more requests; null otherwise. */
  more: string | null;
}) {
  const call = usePinPost();
  const [cancelling, setCancelling] = useState<InviteRowView | null>(null);
  return (
    <div aria-busy={call.busy}>
      <h3 className="font-subhead text-display-sm">{t.requests.head}</h3>
      {props.requests.length === 0 ? (
        <p className="mt-1 text-ink/75">{t.requests.none}</p>
      ) : (
        <ul className="mt-1">
          {props.requests.map((r) => (
            <RequestRow key={r.id} r={r} run={call.run} />
          ))}
        </ul>
      )}
      {props.more && <p className="text-body-sm text-ink/75">{props.more}</p>}
      <h3 className="mt-6 font-subhead text-display-sm">{t.create.head}</h3>
      <CreateForm alliances={props.alliances} run={call.run} />
      {call.link && <LinkBox link={call.link} />}
      {call.message && <Result message={call.message} />}
      <h3 className="mt-6 font-subhead text-display-sm">{t.invites.head}</h3>
      {props.invites.length === 0 ? (
        <p className="mt-1 text-ink/75">{t.invites.none}</p>
      ) : (
        <ul className="mt-1">
          {props.invites.map((i) => (
            <li
              key={i.id}
              className="flex flex-wrap items-center gap-2 border-t border-ink/15 py-2"
            >
              <span className="min-w-0 flex-1 break-words">{i.line}</span>
              {i.open && (
                <button
                  type="button"
                  className={buttonClass("secondary")}
                  onClick={() => setCancelling(i)}
                >
                  {t.invites.cancel}
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
      {cancelling && (
        <ConfirmSheet
          text={fill(t.invites.cancelAsk, { alliance: cancelling.alliance })}
          onAnswer={(yes) => {
            if (yes)
              call.run({
                body: { action: "cancel", invite_id: cancelling.id },
                alliance: cancelling.alliance,
              });
            setCancelling(null);
          }}
        />
      )}
      {call.sheet}
    </div>
  );
}
