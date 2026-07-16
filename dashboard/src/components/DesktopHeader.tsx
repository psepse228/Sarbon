"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";

import { AccountMenu } from "@/components/AccountMenu";
import { GlobeIcon, SearchIcon } from "@/components/icons";
import { DESKTOP_ROUTES } from "@/lib/desktopRoutes";

const LOCALE_KEY = "cortege-dashboard-locale";

export function DesktopHeader() {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
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
        setOpen(true);
      }
      if (event.key === "Escape") {
        setQuery("");
        setOpen(false);
        inputRef.current?.blur();
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  useEffect(() => {
    if (!open) return;
    function onClickOutside(event: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, [open]);

  const matches = useMemo(() => {
    const trimmed = query.trim().toLowerCase();
    if (!trimmed) return [];
    return DESKTOP_ROUTES.filter((route) => route.label.toLowerCase().includes(trimmed));
  }, [query]);

  function goTo(href: string) {
    router.push(href);
    setQuery("");
    setOpen(false);
    inputRef.current?.blur();
  }

  function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (matches.length > 0) goTo(matches[0]!.href);
  }

  function setLocaleAndPersist(next: "ru" | "en") {
    setLocale(next);
    window.localStorage.setItem(LOCALE_KEY, next);
  }

  return (
    <div className="desktop-header">
      <div className="desktop-header-search-wrap" ref={rootRef}>
        <form onSubmit={onSubmit}>
          <label className="desktop-header-search">
            <SearchIcon />
            <input
              ref={inputRef}
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setOpen(true);
              }}
              onFocus={() => setOpen(true)}
              placeholder="Поиск по разделам…"
              aria-label="Поиск по разделам"
            />
            <span className="desktop-header-search-kbd">
              <kbd>Ctrl</kbd>
              <kbd>K</kbd>
            </span>
          </label>
        </form>
        {open && matches.length > 0 && (
          <div className="desktop-header-search-results">
            {matches.map((route) => (
              <button
                key={route.href}
                type="button"
                className="desktop-header-search-result"
                onMouseDown={() => goTo(route.href)}
              >
                {route.label}
              </button>
            ))}
          </div>
        )}
        {open && query.trim() && matches.length === 0 && (
          <div className="desktop-header-search-results">
            <div className="desktop-header-search-empty">Ничего не найдено</div>
          </div>
        )}
      </div>

      <div className="desktop-header-lang" role="group" aria-label="Язык панели">
        <GlobeIcon />
        <button type="button" data-active={locale === "ru"} onClick={() => setLocaleAndPersist("ru")}>
          RU
        </button>
        <button type="button" data-active={locale === "en"} onClick={() => setLocaleAndPersist("en")}>
          EN
        </button>
      </div>

      <AccountMenu />
    </div>
  );
}
