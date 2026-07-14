"use client";

import { useEffect, useRef, useState } from "react";

import { GlobeIcon, SearchIcon } from "@/components/icons";

const LOCALE_KEY = "cortege-dashboard-locale";

export function DesktopHeader() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");
  const [locale, setLocale] = useState<"ru" | "en">("ru");

  useEffect(() => {
    const stored = window.localStorage.getItem(LOCALE_KEY);
    if (stored === "ru" || stored === "en") setLocale(stored);
  }, []);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        inputRef.current?.focus();
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  function setLocaleAndPersist(next: "ru" | "en") {
    setLocale(next);
    window.localStorage.setItem(LOCALE_KEY, next);
  }

  return (
    <div className="desktop-header">
      <label className="desktop-header-search">
        <SearchIcon />
        <input
          ref={inputRef}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Поиск по разделам, лидам, диалогам…"
          aria-label="Поиск"
        />
        <span className="desktop-header-search-kbd">
          <kbd>Ctrl</kbd>
          <kbd>K</kbd>
        </span>
      </label>

      <div className="desktop-header-lang" role="group" aria-label="Язык панели">
        <GlobeIcon />
        <button type="button" data-active={locale === "ru"} onClick={() => setLocaleAndPersist("ru")}>
          RU
        </button>
        <button type="button" data-active={locale === "en"} onClick={() => setLocaleAndPersist("en")}>
          EN
        </button>
      </div>
    </div>
  );
}
