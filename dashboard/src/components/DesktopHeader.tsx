"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";

import { AccountMenu } from "@/components/AccountMenu";
import { GlobeIcon, SearchIcon } from "@/components/icons";
import { useLocale, useT } from "@/lib/i18n/LocaleProvider";
import { DESKTOP_ROUTES } from "@/lib/desktopRoutes";

export function DesktopHeader() {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const { locale, setLocale } = useLocale();
  const t = useT();

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
    return DESKTOP_ROUTES.filter((route) => t(route.labelKey).toLowerCase().includes(trimmed));
  }, [query, t]);

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
              placeholder={t("header.searchPlaceholder")}
              aria-label={t("header.searchPlaceholder")}
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
                {t(route.labelKey)}
              </button>
            ))}
          </div>
        )}
        {open && query.trim() && matches.length === 0 && (
          <div className="desktop-header-search-results">
            <div className="desktop-header-search-empty">{t("header.searchEmpty")}</div>
          </div>
        )}
      </div>

      <div className="desktop-header-lang" role="group" aria-label="Язык панели">
        <GlobeIcon />
        <button type="button" data-active={locale === "ru"} onClick={() => setLocale("ru")}>
          RU
        </button>
        <button type="button" data-active={locale === "en"} onClick={() => setLocale("en")}>
          EN
        </button>
      </div>

      <AccountMenu />
    </div>
  );
}
