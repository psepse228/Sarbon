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
    try {
      await tmaFetch("/api/auth/logout", { method: "POST" });
    } finally {
      window.location.href = "/login";
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
          <button type="button" className="account-menu-dropdown-logout" onClick={logout} disabled={loggingOut}>
            {loggingOut ? "Выход…" : "Выйти"}
          </button>
        </div>
      )}
    </div>
  );
}
