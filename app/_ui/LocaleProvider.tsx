"use client";

// Hands the request's locale and public dictionary (app/_ui/locale.ts) to the client components.
import { createContext, use, type ReactNode } from "react";

import { en, type Dictionary } from "@/lib/copy";

const LocaleContext = createContext<{ locale: string; copy: Dictionary }>({
  locale: "en",
  copy: en,
});

export function LocaleProvider({
  locale,
  copy,
  children,
}: {
  locale: string;
  copy: Dictionary;
  children: ReactNode;
}) {
  return <LocaleContext value={{ locale, copy }}>{children}</LocaleContext>;
}

export const useLocale = (): string => use(LocaleContext).locale;

/** The request's words; English outside the provider (global-error replaces the root layout). */
export const useCopy = (): Dictionary => use(LocaleContext).copy;
