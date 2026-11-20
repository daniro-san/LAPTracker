"use client";

// /admin's Workspaces card (D71, D73, D105): each workspace with its member roles (or "Members' board is
// off"), its allowlist and one "Sign out users"
// button (a sheet picks everyone, officers, members or one person, then asks), the add-or-edit form
// (WorkspaceForm.tsx), and a form that adds an allowlist entry. Each press sends the PIN as
// x-edit-pin, like the run buttons, and shows the outcome in words.
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { buttonClass } from "@/lib/brand/components/Button";
import { copy, fill } from "@/lib/copy";
import type { Allowance } from "@/lib/workspace-features";

import { ConfirmSheet } from "./ConfirmSheet";
import { Result } from "./outcome";
import { forgetPin, PinSheet, savedPin } from "./PinSheet";
import { SignOutUsersSheet, type SignOutChoice, type SignOutPerson } from "./SignOutUsersSheet";
import { PausedSwitches, WorkspaceFeatures, type FeaturesView } from "./WorkspaceFeatures";
import {
  Field,
  FIELD,
  type AllianceChoice,
  WorkspaceForm,
  type Call,
  type Run,
  type WorkspaceSettings,
} from "./WorkspaceForm";

const t = copy.admin.workspaces;

export interface WorkspaceView extends WorkspaceSettings {
  alliance: string;
  sessions: number;
  allowlist: string[];
  /** "Tracker key: set · invalid (2 hours ago)" or "Tracker key: not set" (D124). */
  trackerKey: string;
  /** "Discord: bot in server · commands: … · leaders' webhook: set · …" (D129). */
  discord: string;
  /** "Deletion asked by … · deleted after …" (D125), or null when none is asked. */
  deletion: string | null;
  /** Who has an open session, for "Sign out users". */
  people: SignOutPerson[];
  /** D126: its feature switches, daily caps and today's use. */
  features: FeaturesView;
}

function usePinCall() {
  const router = useRouter();
  const [message, setMessage] = useState<string | null>(null);
  const [pending, setPending] = useState<Call | null>(null);
  // D126: a press is busy until its answer came and the page shows it again, so a quick second tap on a
  // switch never sends what the page showed before the first one.
  const [sending, setSending] = useState(false);
  const [refreshing, refresh] = useTransition();
  async function send(call: Call, pin: string) {
    setSending(true);
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
      if (res.ok) refresh(() => router.refresh());
    } catch {
      setMessage(`✗ ${t.errors.failed}`);
    } finally {
      setSending(false);
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
  return { run, message, sheet, busy: sending || refreshing };
}

const saved = () => t.saved;

/** The form's fields by name, the default submit stopped. */
function fields(e: React.FormEvent<HTMLFormElement>): Record<string, string> {
  e.preventDefault();
  return Object.fromEntries(new FormData(e.currentTarget)) as Record<string, string>;
}

type Deletion = { w: WorkspaceView; action: "ask" | "cancel" };

function WorkspaceList({
  workspaces,
  onSignOut,
  onDeletion,
  paused,
  run,
  busy,
}: {
  workspaces: WorkspaceView[];
  onSignOut: (w: WorkspaceView) => void;
  onDeletion: (d: Deletion) => void;
  paused: Allowance[];
  run: Run;
  busy: boolean;
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
          {w.memberRoles === "" ? (
            <p className="text-body-sm font-semibold">{t.boardOff}</p>
          ) : (
            <p className="text-body-sm break-words text-ink/80">
              {t.memberRoles}: {w.memberRoles}
            </p>
          )}
          <p className="text-body-sm break-words text-ink/80">
            {t.allowlist}: {w.allowlist.length === 0 ? t.allowlistNone : w.allowlist.join(", ")}
          </p>
          <p className="text-body-sm break-words text-ink/80">{w.trackerKey}</p>
          <p className="text-body-sm break-words text-ink/80">{w.discord}</p>
          {w.deletion && <p className="text-body-sm font-semibold text-seal">{w.deletion}</p>}
          <p className="mt-2 flex flex-wrap gap-2">
            <button type="button" onClick={() => onSignOut(w)} className={buttonClass("secondary")}>
              {t.signOutUsers.button}
            </button>
            <button
              type="button"
              onClick={() => onDeletion({ w, action: w.deletion ? "cancel" : "ask" })}
              className={buttonClass("secondary", w.deletion ? "" : "text-seal")}
            >
              {w.deletion ? t.deletion.cancel : t.deletion.ask}
            </button>
          </p>
          <WorkspaceFeatures
            w={w}
            others={workspaces.filter((o) => o.id !== w.id)}
            paused={paused}
            run={run}
            busy={busy}
          />
        </li>
      ))}
    </ul>
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

export function WorkspacesCard({
  workspaces,
  alliances,
  paused,
}: {
  workspaces: WorkspaceView[];
  alliances: AllianceChoice[];
  /** D126: the paid allowances the owner paused for every workspace. */
  paused: Allowance[];
}) {
  const { run, message, sheet, busy } = usePinCall();
  const [signingOut, setSigningOut] = useState<WorkspaceView | null>(null);
  const [deleting, setDeleting] = useState<Deletion | null>(null);
  const deletion = ({ w, action }: Deletion) => {
    setDeleting(null);
    run({
      url: "/api/admin/workspaces/deletion",
      body: { workspace_id: w.id, action },
      ok: (a) =>
        action === "cancel"
          ? t.deletion.cancelled
          : fill(t.deletion.asked, { date: String(a.purge_after ?? "").slice(0, 10) }),
    });
  };
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
      <PausedSwitches paused={paused} run={run} busy={busy} />
      <WorkspaceList
        workspaces={workspaces}
        onSignOut={setSigningOut}
        onDeletion={setDeleting}
        paused={paused}
        run={run}
        busy={busy}
      />
      <WorkspaceForm workspaces={workspaces} alliances={alliances} run={run} />
      {workspaces.length > 0 && <AllowForm workspaces={workspaces} run={run} />}
      {signingOut && (
        <SignOutUsersSheet
          slug={signingOut.slug}
          people={signingOut.people}
          onCancel={() => setSigningOut(null)}
          onConfirm={(choice) => signOut(signingOut, choice)}
        />
      )}
      {deleting && (
        <ConfirmSheet
          text={fill(deleting.action === "ask" ? t.deletion.askConfirm : t.deletion.cancelConfirm, {
            slug: deleting.w.slug,
          })}
          onAnswer={(yes) => (yes ? deletion(deleting) : setDeleting(null))}
        />
      )}
      {sheet}
    </div>
  );
}
