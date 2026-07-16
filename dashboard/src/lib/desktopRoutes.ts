/** Every desktop destination, for the header's quick-nav search. Sidebar.tsx
 * doesn't import this (its own route lists carry the sidebar-specific
 * grouping/icons) — this is a flat list for filtering, not for rendering
 * the sidebar itself. `labelKey` points into the shared i18n dictionary
 * (dashboard/src/lib/i18n/translations.ts) rather than a literal string, so
 * search matches translate along with the rest of the header. */
export const DESKTOP_ROUTES = [
  { href: "/d", labelKey: "sidebar.overview" },
  { href: "/d/conversations", labelKey: "sidebar.conversations" },
  { href: "/d/leads", labelKey: "sidebar.leads" },
  { href: "/d/broadcasts", labelKey: "sidebar.broadcasts" },
  { href: "/d/reviews", labelKey: "sidebar.reviews" },
  { href: "/d/catalog", labelKey: "sidebar.catalog" },
  { href: "/d/calendar", labelKey: "sidebar.calendar" },
  { href: "/d/connectors", labelKey: "sidebar.connectors" },
  { href: "/d/configuration", labelKey: "sidebar.configuration" },
  { href: "/d/test-console", labelKey: "sidebar.testConsole" },
  { href: "/d/assistant", labelKey: "sidebar.assistant" },
] as const;
