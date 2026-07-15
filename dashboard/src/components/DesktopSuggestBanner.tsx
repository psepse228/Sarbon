"use client";

import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

const DISMISS_KEY = "cortege-desktop-suggest-dismissed";
const DESKTOP_QUERY = "(min-width: 1024px) and (hover: hover) and (pointer: fine)";

/**
 * Suggests (never forces) switching to the desktop shell when the mobile
 * view is opened from a real mouse-driven computer — hover:hover + pointer:fine
 * specifically excludes wide-viewport tablets/phones-in-landscape, which
 * shouldn't see this. Dismissal is remembered for the current tab/session
 * only (sessionStorage), so it reappears on a fresh visit rather than being
 * permanently gone — same pattern as a typical "install this app" prompt.
 */
export function DesktopSuggestBanner() {
  const pathname = usePathname();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (pathname === "/login") return;
    if (sessionStorage.getItem(DISMISS_KEY)) return;

    const query = window.matchMedia(DESKTOP_QUERY);
    setVisible(query.matches);

    const listener = (event: MediaQueryListEvent) => {
      if (!sessionStorage.getItem(DISMISS_KEY)) setVisible(event.matches);
    };
    query.addEventListener("change", listener);
    return () => query.removeEventListener("change", listener);
  }, [pathname]);

  function dismiss() {
    sessionStorage.setItem(DISMISS_KEY, "true");
    setVisible(false);
  }

  if (pathname === "/login" || !visible) return null;

  return (
    <div className="desktop-suggest-banner">
      <span className="desktop-suggest-banner-text">
        Вы открыли Cortège с компьютера — desktop-версия даёт больше возможностей.
      </span>
      <div className="desktop-suggest-banner-actions">
        <a href="/d" className="desktop-suggest-banner-cta">
          Открыть десктоп
        </a>
        <button type="button" onClick={dismiss} aria-label="Закрыть" className="desktop-suggest-banner-close">
          ×
        </button>
      </div>
    </div>
  );
}
