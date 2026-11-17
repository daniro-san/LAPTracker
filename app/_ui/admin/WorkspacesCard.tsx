"use client";

// /admin's Workspaces card (D71, D73, D105): each workspace with its allowlist and one "Sign out users"
// button (a sheet picks everyone, officers, members or one person, then asks), a form that adds or edits a workspace, and one that adds an allowlist entry. Each press sends the PIN as
// x-edit-pin, like the run buttons, and shows the outcome in words.
import { useRouter } from "next/navigation";
import { useState, type ReactNode } from "react";

import { ALLIANCES } from "@/config/alliances";
import { buttonClass } from "@/lib/brand/components/Button";
import { copy, fill } from "@/lib/copy";

import { Result } from "./outcome";
import { forgetPin, PinSheet, savedPin } from "./PinSheet";
import { SignOutUsersSheet, type SignOutChoice, type SignOutPerson } from "./SignOutUsersSheet";

const t = copy.admin.workspaces;
const FIELD = "drawn-field min-h-11 w-full px-3";
const LABEL_TEXT = "text-body-sm font-semibold";

export interface WorkspaceView {
  id: number;
  slug: string;
  alliance: string;
  guild: string;
  roles: string;
  sessions: number;
  allowlist: string[];
  /** Who has an open session, for "Sign out users". */
  people: SignOutPerson[];
}

type Call = { url: string; body: unknown; ok: (answer: Record<string, unknown>) => string };

function Field({ label, help, children }: { label: string; help?: string; children: ReactNode }) {
  return (
    <label className="grid gap-1">
      <span className={LABEL_TEXT}>{label}</span>
      {children}
      {help && <span className="text-body-sm text-ink/70">{help}</span>}
    </label>
  );
}

function usePinCall() {
  const router = useRouter();
  const [message, setMessage] = useState<string | null>(null);
  const [pending, setPending] = useState<Call | null>(null);
  async function send(call: Call, pin: string) {
    try {
      const res = await fetch(call.url, {
        method: "POST",
        headers: { "x-edit-pin": pin, "content-type": "application/json" },
        body: JSON.stringify(call.body),
      });
      const answer = (await res.json().catch(() => ({}))) as Record<string, unknown>;
      if (res.status === 401) forgetPin();
      const code = String(answer.code ?? "failed") as keyof typeof t.errors;
      setMessage(res.ok ? `✓ ${call.ok(answer)}` : `✗ ${t.errors[code] ?? t.errors.failed}`);
      if (res.ok) router.refresh();
    } catch {
      setMessage(`✗ ${t.errors.failed}`);
    }
  }
  const run = (call: Call) => {
    setMessage(null);
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
  return { run, message, sheet };
}

const saved = () => t.saved;
const ids = (text: string) => text.split(/[\s,]+/).filter((s) => s !== "");
type Run = (call: Call) => void;

/** The form's fields by name, the default submit stopped. */
function fields(e: React.FormEvent<HTMLFormElement>): Record<string, string> {
  e.preventDefault();
  return Object.fromEntries(new FormData(e.currentTarget)) as Record<string, string>;
}

function WorkspaceList({
  workspaces,
  onSignOut,
}: {
  workspaces: WorkspaceView[];
  onSignOut: (w: WorkspaceView) => void;
}) {
  if (workspaces.length === 0) return <p className="text-ink/70">{t.none}</p>;
  return (
    <ul className="grid gap-4">
      {workspaces.map((w) => (
        <li key={w.id} className="border-b border-rule pb-4 last:border-0">
          <p className="font-semibold">
            /w/{w.slug} · <bdi>{w.alliance}</bdi>
          </p>
          <p className="text-body-sm break-words text-ink/80">
            {t.guild}: {w.guild} · {t.roles}: {w.roles} · {fill(t.sessions, { n: w.sessions })}
          </p>
          <p className="text-body-sm break-words text-ink/80">
            {t.allowlist}: {w.allowlist.length === 0 ? t.allowlistNone : w.allowlist.join(", ")}
          </p>
          <p className="mt-2">
            <button type="button" onClick={() => onSignOut(w)} className={buttonClass("secondary")}>
              {t.signOutUsers.button}
            </button>
          </p>
        </li>
      ))}
    </ul>
  );
}

function WorkspaceForm({ run }: { run: Run }) {
  const save = (e: React.FormEvent<HTMLFormElement>) => {
    const f = fields(e);
    run({
      url: "/api/admin/workspaces",
      ok: saved,
      body: {
        union_id: Number(f.union_id),
        slug: (f.slug ?? "").trim(),
        discord_guild_id: (f.guild ?? "").trim(),
        leader_role_ids: ids(f.roles ?? ""),
      },
    });
  };
  return (
    <form onSubmit={save} className="mt-6 grid gap-3 sm:max-w-xl">
      <h3 className="font-subhead text-display-sm">{t.edit}</h3>
      <p className="text-body-sm text-ink/70">{t.editHelp}</p>
      <Field label={t.alliance}>
        <select name="union_id" required className={FIELD}>
          {ALLIANCES.map((a) => (
            <option key={a.unionId} value={a.unionId}>
              {a.tag} · {a.name}
            </option>
          ))}
        </select>
      </Field>
      <Field label={t.guild}>
        <input name="guild" required inputMode="numeric" autoComplete="off" className={FIELD} />
      </Field>
      <Field label={t.roles} help={t.rolesHelp}>
        <input name="roles" required autoComplete="off" className={FIELD} />
      </Field>
      <Field label={t.slug} help={t.slugHelp}>
        <input name="slug" required autoCapitalize="none" autoComplete="off" className={FIELD} />
      </Field>
      <button type="submit" className={buttonClass("primary", "font-semibold")}>
        {t.save}
      </button>
    </form>
  );
}

function AllowForm({ workspaces, run }: { workspaces: WorkspaceView[]; run: Run }) {
  const allow = (e: React.FormEvent<HTMLFormElement>) => {
    const f = fields(e);
    run({
      url: "/api/admin/workspaces/allowlist",
      ok: saved,
      body: {
        workspace_id: Number(f.workspace_id),
        discord_user_id: (f.user ?? "").trim(),
        expires_on: f.until,
      },
    });
  };
  return (
    <form onSubmit={allow} className="mt-6 grid gap-3 sm:max-w-xl">
      <h3 className="font-subhead text-display-sm">{t.allow}</h3>
      <p className="text-body-sm text-ink/70">{t.allowHelp}</p>
      <Field label={t.allowWorkspace}>
        <select name="workspace_id" required className={FIELD}>
          {workspaces.map((w) => (
            <option key={w.id} value={w.id}>
              /w/{w.slug}
            </option>
          ))}
        </select>
      </Field>
      <Field label={t.allowUser}>
        <input name="user" required inputMode="numeric" autoComplete="off" className={FIELD} />
      </Field>
      <Field label={t.allowUntil}>
        <input name="until" type="date" required className={FIELD} />
      </Field>
      <button type="submit" className={buttonClass("primary", "font-semibold")}>
        {t.allowSave}
      </button>
    </form>
  );
}

export function WorkspacesCard({ workspaces }: { workspaces: WorkspaceView[] }) {
  const { run, message, sheet } = usePinCall();
  const [signingOut, setSigningOut] = useState<WorkspaceView | null>(null);
  const signOut = (w: WorkspaceView, choice: SignOutChoice) => {
    setSigningOut(null);
    run({
      url: "/api/admin/workspaces/sign-out",
      body:
        choice.scope === "user"
          ? { workspace_id: w.id, scope: "user", user_id: choice.userId }
          : { workspace_id: w.id, scope: choice.scope },
      ok: (a) => fill(t.ended, { n: Number(a.ended ?? 0) }),
    });
  };
  return (
    <div>
      {message && <Result message={message} />}
      <WorkspaceList workspaces={workspaces} onSignOut={setSigningOut} />
      <WorkspaceForm run={run} />
      {workspaces.length > 0 && <AllowForm workspaces={workspaces} run={run} />}
      {signingOut && (
        <SignOutUsersSheet
          slug={signingOut.slug}
          people={signingOut.people}
          onCancel={() => setSigningOut(null)}
          onConfirm={(choice) => signOut(signingOut, choice)}
        />
      )}
      {sheet}
    </div>
  );
}
