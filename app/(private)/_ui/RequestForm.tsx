"use client";

// "Request an Officers' Desk" (D130, issue 453): the alliance, the in-game name, and "I'm the alliance leader
// (R5) or an R4" with the rank. Without the tick the form says a Desk is requested by the leadership and
// sends nothing. Sent: `ws_access_requested` with the rank claimed and the roster match, never the name.
import { useRouter } from "next/navigation";
import { useState, useSyncExternalStore } from "react";

import { track } from "@/lib/analytics/events";
import { buttonClass } from "@/lib/brand/components/Button";
import { CheckField } from "@/lib/brand/components/CheckField";
import { FIELD } from "@/lib/brand/components/controls";
import { RadioField } from "@/lib/brand/components/RadioField";
import type { WorkspaceDictionary } from "@/lib/private/dictionary";

const ERRORS = {
  has_desk: "request.err.has_desk",
  rate_limited: "request.err.rate_limited",
} as const;
const noSubscribe = () => () => {};

/** The status link, whole, with Copy: the way to the answer from another device. */
export function CopyLink({ path, t }: { path: string; t: WorkspaceDictionary }) {
  const [copied, setCopied] = useState(false);
  const origin = useSyncExternalStore(
    noSubscribe,
    () => window.location.origin,
    () => "",
  );
  const url = `${origin}${path}`;
  return (
    <div className="mt-2 grid gap-2">
      <p className="drawn-frame-soft px-3 py-2 text-body-sm break-all">{url}</p>
      <button
        type="button"
        className={buttonClass("secondary", "w-full")}
        onClick={() =>
          void navigator.clipboard.writeText(url).then(
            () => setCopied(true),
            () => setCopied(false),
          )
        }
      >
        {copied ? t["request.copied"] : t["request.copy"]}
      </button>
    </div>
  );
}

type Rank = "r5" | "r4";

/** Sends the request; on success counts it and shows the page's answer, else the refusal in words. */
function useSend(t: WorkspaceDictionary) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const send = async (body: { union_id: number; name: string; role: Rank }) => {
    setBusy(true);
    setError(null);
    const res = await fetch("/api/w/request", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    }).catch(() => null);
    const json = ((await res?.json().catch(() => ({}))) ?? {}) as Record<string, unknown>;
    if (!res?.ok) {
      setBusy(false);
      const code = String(json.code ?? "") as keyof typeof ERRORS;
      return setError(t[ERRORS[code] ?? "request.err.failed"]);
    }
    track("ws_access_requested", {
      claimed_role: body.role,
      roster_match: json.match === "found" ? "found" : "not_found",
    });
    router.refresh();
  };
  return { busy, error, send };
}

/** The tick and, once ticked, R5 or R4; without it, why the form waits. */
function Leadership(props: {
  t: WorkspaceDictionary;
  leader: boolean;
  setLeader: (on: boolean) => void;
  role: Rank | null;
  setRole: (r: Rank) => void;
}) {
  const { t } = props;
  return (
    <>
      <CheckField
        label={t["request.leader"]}
        checked={props.leader}
        onChange={(e) => props.setLeader(e.target.checked)}
      />
      {props.leader ? (
        <fieldset className="grid gap-2">
          <legend className="font-semibold">{t["request.rank"]}</legend>
          {(["r5", "r4"] as const).map((r) => (
            <RadioField
              key={r}
              label={t[`request.${r}`]}
              name="rank"
              checked={props.role === r}
              onChange={() => props.setRole(r)}
            />
          ))}
        </fieldset>
      ) : (
        <p className="text-body-sm font-semibold">{t["request.onlyLeaders"]}</p>
      )}
    </>
  );
}

export function RequestForm(props: {
  t: WorkspaceDictionary;
  alliances: { unionId: number; label: string }[];
}) {
  const { t } = props;
  const [unionId, setUnionId] = useState(props.alliances[0]?.unionId ?? 0);
  const [name, setName] = useState("");
  const [leader, setLeader] = useState(false);
  const [role, setRole] = useState<Rank | null>(null);
  const { busy, error, send } = useSend(t);
  const ready = leader && role !== null && name.trim() !== "" && !busy;
  return (
    <form
      className="mt-4 grid gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        if (ready && role) void send({ union_id: unionId, name: name.trim(), role });
      }}
    >
      <label className="grid gap-1">
        <span className="font-semibold">{t["request.alliance"]}</span>
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
      </label>
      <label className="grid gap-1">
        <span className="font-semibold">{t["request.name"]}</span>
        <input
          value={name}
          maxLength={40}
          autoComplete="off"
          onChange={(e) => setName(e.target.value)}
          className={FIELD}
        />
        <span className="text-body-sm text-ink/75">{t["request.nameHelp"]}</span>
      </label>
      <Leadership t={t} leader={leader} setLeader={setLeader} role={role} setRole={setRole} />
      <button
        type="submit"
        disabled={!ready}
        className={buttonClass("primary", "w-full font-semibold")}
      >
        {busy ? t["request.sending"] : t["request.send"]}
      </button>
      {error && (
        <p role="alert" className="font-semibold text-seal">
          {error}
        </p>
      )}
      <p className="text-body-sm text-ink/75">{t["request.keep"]}</p>
    </form>
  );
}
