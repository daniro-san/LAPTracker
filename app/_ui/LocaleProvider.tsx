"use client";

// Hands the request's locale (app/_ui/locale.ts) to the client components that format numbers.
import { createContext, use, type ReactNode } from "react";

const LocaleContext = createContext("en");

export function LocaleProvider({ locale, children }: { locale: string; children: ReactNode }) {
  return <LocaleContext value={locale}>{children}</LocaleContext>;
}

export const useLocale = (): string => use(LocaleContext);
