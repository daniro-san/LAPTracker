// The viewer's language and locale, from the `lang` cookie and the request's Accept-Language (D48;
// DESIGN.md: numbers and dates through Intl), and the request's Clock: in the viewer's own zone and date
// order when their cookies say so (D38), else in server time. Server only; client components read the
// locale and the dictionary through LocaleProvider.
import { cookies, headers } from "next/headers";
import { cache } from "react";

import {
  BLANK,
  blankDictionary,
  en,
  parseLanguage,
  withEnglish,
  type Dictionary,
  type Language,
} from "@/lib/copy";
import { getEnv, isTimeZone } from "@/lib/env";
import { TRANSLATIONS } from "@/lib/i18n";

import { DATE_COOKIE, LANG_COOKIE, makeClock, parseDateFormat, ZONE_COOKIE } from "./format";

/** Each language's words, missing keys filled from English once at start-up. */
const DICTIONARIES = {
  en,
  ...Object.fromEntries(Object.entries(TRANSLATIONS).map(([tag, t]) => [tag, withEnglish(t)])),
} as Record<Language, Dictionary>;

/** Accept-Language tags by q, highest first, without `*` and q=0. */
function tagsOf(header: string | null): string[] {
  return (header ?? "")
    .split(",")
    .map((part) => {
      const [tag = "", ...params] = part.trim().split(";");
      const q = Number(params.find((p) => p.trim().startsWith("q="))?.split("=")[1] ?? 1);
      return { tag: tag.trim(), q: Number.isFinite(q) ? q : 0 };
    })
    .filter((t) => t.tag !== "" && t.tag !== "*" && t.q > 0)
    .sort((a, b) => b.q - a.q)
    .map((t) => t.tag);
}

/** The tag as Intl knows it, or null when Intl does not support it or it is not well formed. */
function intlTag(tag: string): string | null {
  try {
    return Intl.NumberFormat.supportedLocalesOf(tag)[0] ?? null;
  } catch {
    return null;
  }
}

/** The first Accept-Language tag (by q) that Intl supports; "en" when none is usable. */
export const pickLocale = (header: string | null): string =>
  tagsOf(header)
    .map(intlTag)
    .find((t) => t !== null) ?? "en";

/** Base languages written in one regional form: any Portuguese reads pt-BR, any Chinese zh-CN. */
const REGIONAL: Record<string, Language> = { pt: "pt-BR", zh: "zh-CN" };

/** The dictionary a tag reads: its base language. */
function languageOf(tag: string): Language | null {
  const base = tag.split("-")[0]?.toLowerCase() ?? "";
  return REGIONAL[base] ?? parseLanguage(base);
}

/**
 * The page's language: the `lang` cookie, else the first Accept-Language tag in a language the pages
 * are written in, else English. Its Intl locale: the viewer's own tag in that language (en-GB keeps
 * `31 Oct`), else the chosen language; with neither cookie nor match, the first tag Intl supports.
 */
export function pickLanguage(
  cookie: string | undefined,
  header: string | null,
): { language: Language; locale: string } {
  const tags = tagsOf(header);
  const chosen = parseLanguage(cookie);
  const language = chosen ?? tags.map(languageOf).find((l) => l !== null) ?? "en";
  const own = tags
    .filter((t) => languageOf(t) === language)
    .map(intlTag)
    .find((t) => t !== null);
  return { language, locale: own ?? chosen ?? pickLocale(header) };
}

export const requestLanguage = cache(async () => {
  const [jar, head] = await Promise.all([cookies(), headers()]);
  return pickLanguage(jar.get(LANG_COOKIE)?.value, head.get("accept-language"));
});

export const requestLocale = cache(async () => (await requestLanguage()).locale);

/** The public pages' words for this request; blanked in the ten-second test (NEXT_PUBLIC_BLANK_COPY). */
export const requestCopy = cache(async (): Promise<Dictionary> => {
  const dictionary = DICTIONARIES[(await requestLanguage()).language];
  return BLANK ? blankDictionary(dictionary) : dictionary;
});

/** A `tz` cookie that names a real IANA zone, else null (server time). */
export const parseZone = (value: string | undefined): string | null =>
  value && value.length <= 64 && isTimeZone(value) ? value : null;

/** Public pages: the viewer's zone and date order when chosen, else server time and the locale's dates. */
export const requestClock = cache(async () => {
  const [locale, copy, jar] = await Promise.all([requestLocale(), requestCopy(), cookies()]);
  const zone = parseZone(jar.get(ZONE_COOKIE)?.value);
  return makeClock(
    locale,
    zone ?? getEnv().SERVER_TZ,
    { own: zone !== null, date: parseDateFormat(jar.get(DATE_COOKIE)?.value) },
    copy,
  );
});

/** /admin: always server time, the zone the schedule is set in, and English words. */
export const requestServerClock = cache(async () =>
  makeClock(await requestLocale(), getEnv().SERVER_TZ),
);
