"use client";

// The header's settings menu (DESIGN.md `viewer-settings`, D38, D39): a gear whose panel holds the theme
// and, on public pages, the language, the times (server time or the viewer's own zone) and the date
// order. Each choice is a one-year cookie, like `theme`; the language, times and dates ones re-render the
// page on the server (router.refresh()), where requestCopy and requestClock read them. The panel is drawn
// only once it is opened, so the browser-only values in it (its zone, the cookies, the root's lang) are
// never server-rendered and cannot mismatch.
import { useRouter } from "next/navigation";
import { useState, type ReactNode } from "react";

import { Gear } from "@/lib/brand/components/Gear";
import { RadioField } from "@/lib/brand/components/RadioField";
import { Moon, setTheme, Sun, useTheme } from "@/lib/brand/components/ThemeSwitch";
import { en, LANGUAGES, type Language } from "@/lib/copy";

import { Disclosure } from "./Disclosure";
import {
  DATE_COOKIE,
  DATE_FORMATS,
  LANG_COOKIE,
  makeClock,
  parseDateFormat,
  ZONE_COOKIE,
  type DateFormat,
} from "./format";
import { useCopy, useLocale } from "./LocaleProvider";
import { LABEL } from "./StatTable";

const YEAR = 31_536_000;
/** A day after the 12th, so every sample shows which of day and month comes first. */
const SAMPLE = new Date("2026-10-31T12:00:00Z");

function readCookie(name: string): string | undefined {
  const raw = document.cookie
    .split("; ")
    .find((c) => c.startsWith(`${name}=`))
    ?.slice(name.length + 1);
  return raw === undefined ? undefined : decodeURIComponent(raw);
}

/** `null` removes the cookie: back to server time or the locale's own dates. */
function writeCookie(name: string, value: string | null) {
  document.cookie =
    value === null
      ? `${name}=; path=/; max-age=0; samesite=lax`
      : `${name}=${encodeURIComponent(value)}; path=/; max-age=${YEAR}; samesite=lax`;
}

/** "America/Sao_Paulo" → "Sao Paulo": the zone's own city name, enough to confirm it. */
const city = (zone: string) => (zone.split("/").pop() ?? zone).replaceAll("_", " ");

function Group({
  legend,
  columns,
  children,
}: {
  legend: string;
  columns?: 2;
  children: ReactNode;
}) {
  return (
    <fieldset className={`grid gap-1.5 ${columns === 2 ? "grid-cols-2" : ""}`}>
      <legend className={`mb-1 ${LABEL}`}>{legend}</legend>
      {children}
    </fieldset>
  );
}

/** A native list, each language named in its own language (D39), so a viewer finds theirs without
 * reading English; with 18 languages, radios would push Theme, Times and Dates out of the panel. */
function LanguagePicker({ legend }: { legend: string }) {
  const router = useRouter();
  // The page's language as the server chose it (cookie or Accept-Language): the root's lang attribute.
  const [language, setLanguage] = useState(() => document.documentElement.lang);
  const pick = (next: string) => {
    setLanguage(next);
    writeCookie(LANG_COOKIE, next);
    router.refresh();
  };
  return (
    <label className="grid gap-1">
      <span className={LABEL}>{legend}</span>
      <select
        value={language}
        onChange={(e) => pick(e.target.value)}
        className="drawn-field min-h-11 w-full px-3"
      >
        {(Object.keys(LANGUAGES) as Language[]).map((id) => (
          <option key={id} value={id} lang={id}>
            {LANGUAGES[id]}
          </option>
        ))}
      </select>
    </label>
  );
}

function Panel({ publicPage }: { publicPage: boolean }) {
  const router = useRouter();
  const locale = useLocale();
  const requestCopy = useCopy();
  const t = (publicPage ? requestCopy : en).settings;
  const theme = useTheme();
  const [zone, setZone] = useState(() => readCookie(ZONE_COOKIE) ?? null);
  const [date, setDate] = useState(() => parseDateFormat(readCookie(DATE_COOKIE)));
  const browserZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const pickZone = (next: string | null) => {
    setZone(next);
    writeCookie(ZONE_COOKIE, next);
    router.refresh();
  };
  const pickDate = (next: DateFormat | null) => {
    setDate(next);
    writeCookie(DATE_COOKIE, next);
    router.refresh();
  };
  return (
    <div className="absolute right-0 z-40 mt-1 grid max-h-[75vh] w-[min(20rem,calc(100vw-2rem))] gap-3 overflow-y-auto bg-paper p-3 text-ink drawn-frame before:inset-0">
      {publicPage && <LanguagePicker legend={t.language} />}
      <Group legend={t.theme} columns={2}>
        {(["light", "dark"] as const).map((mode) => (
          <RadioField
            key={mode}
            name="theme"
            checked={theme === mode}
            onChange={() => setTheme(mode)}
            label={
              <span className="inline-flex items-center gap-1.5">
                {mode === "light" ? <Sun /> : <Moon />}
                {t[mode]}
              </span>
            }
          />
        ))}
      </Group>
      {publicPage && (
        <>
          <Group legend={t.times}>
            <RadioField
              name="tz"
              label={t.serverTime}
              checked={zone === null}
              onChange={() => pickZone(null)}
            />
            <RadioField
              name="tz"
              label={t.yourTime}
              help={city(zone ?? browserZone)}
              checked={zone !== null}
              onChange={() => pickZone(browserZone)}
            />
          </Group>
          <Group legend={t.dates} columns={2}>
            <RadioField
              name="date"
              label={t.auto}
              help={makeClock(locale, "UTC").day(SAMPLE)}
              checked={date === null}
              onChange={() => pickDate(null)}
            />
            {DATE_FORMATS.map((id) => (
              <RadioField
                key={id}
                name="date"
                label={makeClock(locale, "UTC", { own: false, date: id }).day(SAMPLE)}
                checked={date === id}
                onChange={() => pickDate(id)}
              />
            ))}
          </Group>
        </>
      )}
    </div>
  );
}

export function ViewerSettings({ publicPage = true }: { publicPage?: boolean }) {
  const [open, setOpen] = useState(false);
  const requestCopy = useCopy();
  const copy = publicPage ? requestCopy : en;
  return (
    <Disclosure
      label={copy.site.settings}
      className="group relative"
      onToggle={(e) => setOpen(e.currentTarget.open)}
    >
      <summary className="drawn-frame-soft grid size-11 cursor-pointer place-items-center rounded-xs transition-colors duration-150 group-open:bg-paper/20 hover:bg-paper/15 active:bg-paper/25 motion-reduce:transition-none [&::-webkit-details-marker]:hidden">
        <Gear />
        <span className="sr-only">{copy.site.settings}</span>
      </summary>
      {open && <Panel publicPage={publicPage} />}
    </Disclosure>
  );
}
