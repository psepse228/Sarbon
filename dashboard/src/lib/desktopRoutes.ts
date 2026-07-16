/** Every desktop destination, for the header's quick-nav search. Sidebar.tsx
 * doesn't import this (its own route lists carry the sidebar-specific
 * grouping/icons) — this is a flat list for filtering, not for rendering
 * the sidebar itself. */
export const DESKTOP_ROUTES = [
  { href: "/d", label: "Обзор" },
  { href: "/d/conversations", label: "Диалоги" },
  { href: "/d/leads", label: "Лиды" },
  { href: "/d/broadcasts", label: "Рассылки" },
  { href: "/d/reviews", label: "Отзывы" },
  { href: "/d/catalog", label: "Каталог" },
  { href: "/d/calendar", label: "Календарь" },
  { href: "/d/connectors", label: "Коннекторы" },
  { href: "/d/configuration", label: "Настройки" },
  { href: "/d/test-console", label: "Тест-консоль" },
  { href: "/d/assistant", label: "Ассистент" },
] as const;
