"use client";

import { useEffect, useRef, useState } from "react";

import { ChevronDownIcon } from "@/components/icons";
import { tmaFetch } from "@/lib/telegram/client";

interface AccountMenuProps {
  /** Hides the email text next to the avatar — used in the mobile header,
   * where space is tight; the email is still shown inside the dropdown. */
  compact?: boolean;
}

export function AccountMenu({ compact = false }: AccountMenuProps) {
  const [email, setEmail] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const [logoutError, setLogoutError] = useState<string | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    tmaFetch("/api/auth/me")
      .then(async (res) => (res.ok ? ((await res.json()) as { email: string }) : null))
      .then((body) => setEmail(body?.email ?? null))
      .catch(() => setEmail(null));
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

  async function logout() {
    setLoggingOut(true);
    setLogoutError(null);
    try {
      const res = await tmaFetch("/api/auth/logout", { method: "POST" });
      if (!res.ok) throw new Error(`Не удалось выйти (${res.status})`);
      // Full navigation, not router.push — the session cookie changed
      // server-side and every already-fetched client cache should be dropped.
      window.location.href = "/login";
    } catch (err) {
      // Fail closed: if the request didn't succeed, the session cookie is
      // still valid server-side, so don't redirect as if logout happened —
      // that would look like a completed logout on a shared device while
      // the account is still signed in.
      setLoggingOut(false);
      setLogoutError(err instanceof Error ? err.message : "Не удалось выйти");
    }
  }

  if (!email) return null;

  const initial = email[0]?.toUpperCase() ?? "?";

  return (
    <div className="account-menu" ref={rootRef}>
      <button
        type="button"
        className="account-menu-trigger"
        onClick={() => setOpen((prev) => !prev)}
        aria-haspopup="true"
        aria-expanded={open}
      >
        <span className="account-menu-avatar">{initial}</span>
        {!compact && <span className="account-menu-email">{email}</span>}
        <ChevronDownIcon />
      </button>

      {open && (
        <div className="account-menu-dropdown">
          <div className="account-menu-dropdown-email">{email}</div>
          {logoutError && <div className="account-menu-dropdown-error">{logoutError}</div>}
          <button type="button" className="account-menu-dropdown-logout" onClick={logout} disabled={loggingOut}>
            {loggingOut ? "Выход…" : "Выйти"}
          </button>
        </div>
      )}
    </div>
  );
}
