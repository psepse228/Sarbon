"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import {
  CalendarIcon,
  ChatIcon,
  FlaskIcon,
  GearIcon,
  HomeIcon,
  PlugIcon,
  SendIcon,
  SparkleIcon,
  StarIcon,
  TagIcon,
  UsersIcon,
} from "@/components/icons";
import { useT } from "@/lib/i18n/LocaleProvider";

const OVERVIEW = { href: "/d", labelKey: "sidebar.overview", Icon: HomeIcon } as const;

const CRM_GROUP = [
  { href: "/d/conversations", labelKey: "sidebar.conversations", Icon: ChatIcon },
  { href: "/d/leads", labelKey: "sidebar.leads", Icon: UsersIcon },
  { href: "/d/broadcasts", labelKey: "sidebar.broadcasts", Icon: SendIcon },
  { href: "/d/reviews", labelKey: "sidebar.reviews", Icon: StarIcon },
] as const;

const REST = [
  { href: "/d/catalog", labelKey: "sidebar.catalog", Icon: TagIcon },
  { href: "/d/calendar", labelKey: "sidebar.calendar", Icon: CalendarIcon },
  { href: "/d/connectors", labelKey: "sidebar.connectors", Icon: PlugIcon },
  { href: "/d/configuration", labelKey: "sidebar.configuration", Icon: GearIcon },
  { href: "/d/test-console", labelKey: "sidebar.testConsole", Icon: FlaskIcon },
  { href: "/d/assistant", labelKey: "sidebar.assistant", Icon: SparkleIcon },
] as const;

/** All top-level desktop spaces in indicator order -- also the source of
 * truth HudPageTransition reads to work out slide direction between routes. */
export const HUD_SPACE_ORDER = [OVERVIEW, ...CRM_GROUP, ...REST].map((s) => s.href);

/** Replaces the docked Sidebar -- since Обзор/CRM/the rest are now real
 * routes reached by a floating bottom icon-strip instead of a fixed left
 * column (see /d/layout.tsx), the only thing left to show is *where you
 * are*, macOS-Spaces-style. DesktopHeader already covers what a HudToolbar
 * would (search/language/account), so this is the one new piece needed. */
export function SpaceIndicator() {
  const pathname = usePathname();
  const t = useT();

  function isActive(href: string) {
    return href === "/d" ? pathname === "/d" : pathname.startsWith(href);
  }

  function renderItem({ href, labelKey, Icon }: { href: string; labelKey: string; Icon: typeof HomeIcon }) {
    const active = isActive(href);
    return (
      <Link key={href} href={href} className="space-indicator-item" data-active={active} title={t(labelKey)}>
        <Icon />
      </Link>
    );
  }

  return (
    <nav className="space-indicator" aria-label={t("sidebar.crm")}>
      {renderItem(OVERVIEW)}
      <span className="space-indicator-divider" aria-hidden="true" />
      {CRM_GROUP.map(renderItem)}
      <span className="space-indicator-divider" aria-hidden="true" />
      {REST.map(renderItem)}
    </nav>
  );
}
