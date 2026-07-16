"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";

import { translations, type Locale } from "./translations";

const LOCALE_KEY = "cortege-dashboard-locale";

interface LocaleContextValue {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: (key: string) => string;
}

const LocaleContext = createContext<LocaleContextValue | null>(null);

export function LocaleProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>("ru");

  useEffect(() => {
    const stored = window.localStorage.getItem(LOCALE_KEY);
    if (stored === "ru" || stored === "en") setLocaleState(stored);
  }, []);

  const setLocale = useCallback((next: Locale) => {
    setLocaleState(next);
    window.localStorage.setItem(LOCALE_KEY, next);
  }, []);

  const t = useCallback((key: string) => translations[locale][key] ?? key, [locale]);

  return <LocaleContext.Provider value={{ locale, setLocale, t }}>{children}</LocaleContext.Provider>;
}

/** Safe outside a LocaleProvider (e.g. a shared component also rendered on
 * mobile, which has no provider) — falls back to Russian passthrough rather
 * than throwing, so shared components work on both trees. */
export function useT(): (key: string) => string {
  const ctx = useContext(LocaleContext);
  if (ctx) return ctx.t;
  return (key: string) => translations.ru[key] ?? key;
}

export function useLocale(): { locale: Locale; setLocale: (locale: Locale) => void } {
  const ctx = useContext(LocaleContext);
  if (!ctx) throw new Error("useLocale must be used within a LocaleProvider (desktop-only)");
  return { locale: ctx.locale, setLocale: ctx.setLocale };
}
