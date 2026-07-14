"use client";

// `@twa-dev/sdk` reads `window` at module top-level, which crashes if it's
// ever statically imported into code that Next.js executes during
// server-side rendering / prerendering (it does this even for "use client"
// components, to produce the initial HTML). We defer loading it to a
// dynamic import that only ever runs in the browser, after this module has
// already confirmed `window` exists.
type TwaWebApp = typeof import("@twa-dev/sdk").default;

let cachedWebApp: TwaWebApp | null = null;

async function loadWebApp(): Promise<TwaWebApp | null> {
  if (typeof window === "undefined") return null;
  if (cachedWebApp) return cachedWebApp;
  const mod = await import("@twa-dev/sdk");
  cachedWebApp = mod.default;
  return cachedWebApp;
}

/** Call once on app mount (see src/components/TelegramInit.tsx) so Telegram sizes the webview correctly. */
export async function initTelegramWebApp(): Promise<void> {
  const webApp = await loadWebApp();
  if (!webApp) return;
  try {
    webApp.ready();
    webApp.expand();
  } catch {
    // no-op outside Telegram (e.g. local dev in a plain browser)
  }
}

/**
 * `fetch` wrapper used by every dashboard API call. The dashboard now
 * authenticates purely via the `cortege_session` cookie (Google login, see
 * src/lib/telegram/auth.ts) — this wrapper no longer attaches any Telegram
 * initData header, but keeps its name/call signature since ~20 call sites
 * across the dashboard already depend on it.
 */
export async function tmaFetch(input: string, init: RequestInit = {}): Promise<Response> {
  const headers = new Headers(init.headers);
  if (init.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  return fetch(input, { ...init, headers });
}
