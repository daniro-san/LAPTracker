// The viewer's locale, from the request's Accept-Language (DESIGN.md: numbers and dates through Intl),
// and the request's Clock: in the viewer's own zone and date order when their cookies say so (D38),
// else in server time. Server only; client components read the locale through LocaleProvider.
import { cookies, headers } from "next/headers";
import { cache } from "react";

import { getEnv, isTimeZone } from "@/lib/env";

import { DATE_COOKIE, makeClock, parseDateFormat, ZONE_COOKIE } from "./format";

/** The first Accept-Language tag (by q) that Intl supports; "en" when none is usable. */
export function pickLocale(header: string | null): string {
  const tags = (header ?? "")
    .split(",")
    .map((part) => {
      const [tag = "", ...params] = part.trim().split(";");
      const q = Number(params.find((p) => p.trim().startsWith("q="))?.split("=")[1] ?? 1);
      return { tag: tag.trim(), q: Number.isFinite(q) ? q : 0 };
    })
    .filter((t) => t.tag !== "" && t.tag !== "*" && t.q > 0)
    .sort((a, b) => b.q - a.q);
  for (const { tag } of tags) {
    try {
      const [supported] = Intl.NumberFormat.supportedLocalesOf(tag);
      if (supported) return supported;
    } catch {
      // Not a well-formed language tag: try the next one.
    }
  }
  return "en";
}

export const requestLocale = cache(async () =>
  pickLocale((await headers()).get("accept-language")),
);

/** A `tz` cookie that names a real IANA zone, else null (server time). */
export const parseZone = (value: string | undefined): string | null =>
  value && value.length <= 64 && isTimeZone(value) ? value : null;

/** Public pages: the viewer's zone and date order when chosen, else server time and the locale's dates. */
export const requestClock = cache(async () => {
  const [locale, jar] = await Promise.all([requestLocale(), cookies()]);
  const zone = parseZone(jar.get(ZONE_COOKIE)?.value);
  return makeClock(locale, zone ?? getEnv().SERVER_TZ, {
    own: zone !== null,
    date: parseDateFormat(jar.get(DATE_COOKIE)?.value),
  });
});

/** /admin: always server time, the zone the schedule is set in. */
export const requestServerClock = cache(async () =>
  makeClock(await requestLocale(), getEnv().SERVER_TZ),
);
