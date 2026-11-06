"use client";

// The header's settings menu (DESIGN.md `viewer-settings`, D38): a gear whose panel holds the theme and,
// on public pages, the times (server time or the viewer's own zone) and the date order. Each choice is a
// one-year cookie, like `theme`; the times and dates ones re-render the page on the server
// (router.refresh()), where requestClock reads them. The panel is drawn only once it is opened, so the
// browser-only values in it (its zone, the cookies) are never server-rendered and cannot mismatch.
import { useRouter } from "next/navigation";
import { useState, type ReactNode } from "react";

import { Gear } from "@/lib/brand/components/Gear";
import { RadioField } from "@/lib/brand/components/RadioField";
import { Moon, setTheme, Sun, useTheme } from "@/lib/brand/components/ThemeSwitch";
import { copy } from "@/lib/copy";

import { Disclosure } from "./Disclosure";
import {
  DATE_COOKIE,
  DATE_FORMATS,
  makeClock,
  parseDateFormat,
  ZONE_COOKIE,
  type DateFormat,
} from "./format";
import { useLocale } from "./LocaleProvider";
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

const t = copy.settings;

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

function Panel({ times }: { times: boolean }) {
  const router = useRouter();
  const locale = useLocale();
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
      {times && (
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

export function ViewerSettings({ times = true }: { times?: boolean }) {
  const [open, setOpen] = useState(false);
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
      {open && <Panel times={times} />}
    </Disclosure>
  );
}
