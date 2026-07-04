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

/**
 * True when running inside an actual Telegram client (webview). Outside of
 * it — e.g. a plain desktop browser during local development —
 * `WebApp.initData` is always an empty string, which is how we detect it.
 */
export async function isRunningInTelegram(): Promise<boolean> {
  const webApp = await loadWebApp();
  return !!webApp && webApp.initData.length > 0;
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
 * `fetch` wrapper that attaches the Telegram `Authorization: tma <initData>`
 * header expected by every /api/* route handler (see
 * src/lib/telegram/auth.ts). Falls through to a plain fetch with no header
 * when not running inside Telegram — the server's DEV_BYPASS_INIT_DATA
 * escape hatch is what makes that usable in local dev.
 */
export async function tmaFetch(input: string, init: RequestInit = {}): Promise<Response> {
  const headers = new Headers(init.headers);
  const webApp = await loadWebApp();
  if (webApp && webApp.initData.length > 0) {
    headers.set("Authorization", `tma ${webApp.initData}`);
  }
  if (init.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  return fetch(input, { ...init, headers });
}
