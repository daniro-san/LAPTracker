// The viewer's locale, from the request's Accept-Language (DESIGN.md: numbers and dates through Intl),
// and the request's Clock in server time. Server only; client components read the locale through
// LocaleProvider.
import { headers } from "next/headers";
import { cache } from "react";

import { getEnv } from "@/lib/env";

import { makeClock } from "./format";

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

export const requestClock = cache(async () => makeClock(await requestLocale(), getEnv().SERVER_TZ));
