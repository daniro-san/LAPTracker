"use client";

// The header's "Signed in as …" (issue 334) opens the officer's own settings: the name the desk shows,
// "This is me" (their player in the alliance, suggested by the name matcher, D74) and the theme (the public
// site's `theme` cookie, so one choice applies everywhere) and which time comes first (issue 337: server
// time or the officer's own, this browser only). The profile is read when the sheet opens.
// Nothing in it is logged or tracked; /w is masked in session replay (D77).
import { useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";

import { buttonClass } from "@/lib/brand/components/Button";
import { Gear } from "@/lib/brand/components/Gear";
import { RadioField } from "@/lib/brand/components/RadioField";
import { Sheet } from "@/lib/brand/components/Sheet";
import { Moon, setTheme, Sun, useThemeChoice } from "@/lib/brand/components/ThemeSwitch";
import { fill } from "@/lib/copy";
import { clockIn } from "@/lib/private/calendar-time";
import type { WorkspaceDictionary, WorkspaceLanguage } from "@/lib/private/dictionary";
import type { Profile } from "@/lib/private/profile";

import { sheetWords } from "./sheet-words";
import { RefusalLine, SIGNED_OUT, SignedOutNote } from "./SignedOut";
import { Me } from "./ThisIsMe";
import { setClockChoice, useClockChoice, useMinute, useViewerZone } from "./YourTime";

type Words = WorkspaceDictionary;

/** The profile route: the profile as it now stands, or an error code ("failed" for anything unexpected). */
async function call(slug: string, body?: object): Promise<Profile | string> {
  try {
    const res = await fetch(
      `/api/w/${slug}/profile`,
      body === undefined
        ? { cache: "no-store" }
        : {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify(body),
          },
    );
    const data = (await res.json()) as Profile | { code?: string };
    return res.ok ? (data as Profile) : ((data as { code?: string }).code ?? "failed");
  } catch {
    return "failed";
  }
}

function NameForm(props: {
  t: Words;
  name: string;
  busy: boolean;
  note: string;
  onSave: (name: string) => void;
}) {
  const { t, busy, note, onSave } = props;
  const [draft, setDraft] = useState(props.name);
  useEffect(() => setDraft(props.name), [props.name]);
  const submit = (e: FormEvent) => {
    e.preventDefault();
    onSave(draft);
  };
  return (
    <form onSubmit={submit} className="mt-4">
      <label htmlFor="profile-name" className="font-semibold">
        {t["profile.name"]}
      </label>
      <p id="profile-name-help" className="text-body-sm text-ink/70">
        {t["profile.nameHelp"]}
      </p>
      <div className="mt-2 flex gap-2">
        <input
          id="profile-name"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          autoComplete="nickname"
          aria-describedby="profile-name-help profile-name-note"
          className="drawn-field min-h-11 min-w-0 flex-1 px-3"
        />
        <button type="submit" disabled={busy} className={buttonClass("secondary")}>
          {t["profile.save"]}
        </button>
      </div>
      {note === SIGNED_OUT ? (
        <SignedOutNote className="mt-1" />
      ) : (
        <p id="profile-name-note" role="status" className="mt-1 min-h-6 text-body-sm">
          {note}
        </p>
      )}
    </form>
  );
}

/** Light, dark, or the device's own setting (no cookie). */
function ThemeChoice({ t }: { t: Words }) {
  const choice = useThemeChoice();
  const options = [
    { mode: null, label: t["profile.theme.system"], wide: true },
    { mode: "light", label: t["profile.theme.light"], icon: <Sun /> },
    { mode: "dark", label: t["profile.theme.dark"], icon: <Moon /> },
  ] as const;
  return (
    <div className="mt-4 border-t border-rule pt-4">
      <fieldset className="grid grid-cols-2 gap-1.5">
        <legend className="mb-1 font-semibold">{t["profile.theme"]}</legend>
        {options.map((o) => (
          <div key={o.mode ?? "system"} className={"wide" in o ? "col-span-2" : undefined}>
            <RadioField
              name="ws-theme"
              checked={choice === o.mode}
              onChange={() => setTheme(o.mode)}
              label={
                <span className="inline-flex items-center gap-1.5">
                  {"icon" in o && o.icon}
                  {o.label}
                </span>
              }
            />
          </div>
        ))}
      </fieldset>
    </div>
  );
}

/** Which time the desk shows first: server time (default) or the officer's own (this browser only). */
function ClockChoiceField({ t }: { t: Words }) {
  const choice = useClockChoice();
  const zone = useViewerZone();
  const minute = useMinute();
  // "My time first (this phone: America/Sao Paulo, 22:33 now)", once the browser has said both.
  const mine =
    zone && minute !== null
      ? fill(t["clock.mineHere"], {
          zone: zone.replaceAll("_", " "),
          time: clockIn(minute * 60_000, zone, "").time,
        })
      : t["clock.mine"];
  const label = { server: t["clock.server"], mine };
  return (
    <div className="mt-4 border-t border-rule pt-4">
      <fieldset className="grid gap-1.5" aria-describedby="profile-clock-help">
        <legend className="mb-1 font-semibold">{t["clock.head"]}</legend>
        {(["server", "mine"] as const).map((c) => (
          <RadioField
            key={c}
            name="ws-clock"
            checked={choice === c}
            onChange={() => setClockChoice(c)}
            label={label[c]}
          />
        ))}
      </fieldset>
      <p id="profile-clock-help" className="mt-1 text-body-sm text-ink/70">
        {t["clock.help"]}
      </p>
    </div>
  );
}

type Write =
  { action: "rename"; name: string } | { action: "link"; uid: number } | { action: "unlink" };

function Settings(props: {
  slug: string;
  t: Words;
  language: WorkspaceLanguage;
  name: string;
  onClose: () => void;
}) {
  const { slug, t, language, onClose } = props;
  const router = useRouter();
  const [me, setMe] = useState<Profile | "loading" | "failed" | typeof SIGNED_OUT>("loading");
  const [busy, setBusy] = useState(false);
  /** The last write's outcome, shown under the part it came from. */
  const [note, setNote] = useState<{ at: "name" | "me"; text: string } | null>(null);
  useEffect(() => {
    void call(slug).then((r) =>
      setMe(r === SIGNED_OUT ? SIGNED_OUT : typeof r === "string" ? "failed" : r),
    );
  }, [slug]);
  const write = async (body: Write) => {
    const at = body.action === "rename" ? "name" : "me";
    setBusy(true);
    const r = await call(slug, body);
    setBusy(false);
    if (r === SIGNED_OUT) return setNote({ at, text: SIGNED_OUT });
    if (typeof r === "string") {
      setNote({ at, text: t[r === "invalid_name" ? "profile.invalid" : "profile.failed"] });
      return;
    }
    setMe(r);
    setNote(at === "name" ? { at, text: t["profile.saved"] } : null);
    // The header shows the new name once the server renders the page again.
    if (at === "name") router.refresh();
  };
  return (
    // Focus starts on the title (the frame's default): on a phone, a focused field would raise the keyboard.
    <Sheet
      labelledBy="profile-title"
      onCancel={onClose}
      title={t["profile.title"]}
      words={sheetWords(t)}
    >
      <NameForm
        t={t}
        name={typeof me === "string" ? props.name : me.name}
        busy={busy}
        note={note?.at === "name" ? note.text : ""}
        onSave={(name) => void write({ action: "rename", name })}
      />
      <section aria-labelledby="profile-me" className="mt-3 border-t border-rule pt-4">
        <h3 id="profile-me" className="font-semibold">
          {t["profile.me"]}
        </h3>
        <p className="text-body-sm text-ink/70">{t["profile.me.lead"]}</p>
        <Me
          t={t}
          language={language}
          me={me}
          busy={busy}
          onLink={(uid) =>
            void write(uid === null ? { action: "unlink" } : { action: "link", uid })
          }
        />
        {note?.at === "me" && <RefusalLine text={note.text} className="mt-1 text-body-sm" />}
      </section>
      <ThemeChoice t={t} />
      <ClockChoiceField t={t} />
    </Sheet>
  );
}

export function ProfileSheet(props: {
  slug: string;
  t: Words;
  language: WorkspaceLanguage;
  /** The name the header shows. */
  name: string;
  /** "Signed in as …", made on the server. */
  label: string;
}) {
  const { slug, t, language, name, label } = props;
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        aria-haspopup="dialog"
        aria-label={`${label} · ${t["profile.title"]}`}
        onClick={() => setOpen(true)}
        className="flex min-h-11 min-w-0 items-center gap-2 text-left"
      >
        <span className="min-w-0 truncate underline decoration-dotted underline-offset-4">
          {label}
        </span>
        {/* The tap cue: the settings gear after the name. */}
        <span className="shrink-0">
          <Gear />
        </span>
      </button>
      {open && (
        <Settings
          slug={slug}
          t={t}
          language={language}
          name={name}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  );
}
