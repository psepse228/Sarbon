"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

import {
  CalendarIcon,
  ChatIcon,
  ChevronDownIcon,
  FlaskIcon,
  GearIcon,
  GridIcon,
  HomeIcon,
  PlugIcon,
  SendIcon,
  SparkleIcon,
  StarIcon,
  TagIcon,
  UsersIcon,
} from "@/components/icons";
import { useT } from "@/lib/i18n/LocaleProvider";

const TOP_ITEMS_BEFORE_GROUP = [{ href: "/d", labelKey: "sidebar.overview", Icon: HomeIcon }] as const;

const CRM_GROUP_ITEMS = [
  { href: "/d/conversations", labelKey: "sidebar.conversations", Icon: ChatIcon },
  { href: "/d/leads", labelKey: "sidebar.leads", Icon: UsersIcon },
  { href: "/d/broadcasts", labelKey: "sidebar.broadcasts", Icon: SendIcon },
  { href: "/d/reviews", labelKey: "sidebar.reviews", Icon: StarIcon },
] as const;

const TOP_ITEMS_AFTER_GROUP = [
  { href: "/d/catalog", labelKey: "sidebar.catalog", Icon: TagIcon },
  { href: "/d/calendar", labelKey: "sidebar.calendar", Icon: CalendarIcon },
  { href: "/d/connectors", labelKey: "sidebar.connectors", Icon: PlugIcon },
  { href: "/d/configuration", labelKey: "sidebar.configuration", Icon: GearIcon },
  { href: "/d/test-console", labelKey: "sidebar.testConsole", Icon: FlaskIcon },
  { href: "/d/assistant", labelKey: "sidebar.assistant", Icon: SparkleIcon },
] as const;

const CRM_EXPANDED_KEY = "cortege-sidebar-crm-expanded";

export function Sidebar() {
  const pathname = usePathname();
  const t = useT();
  const isOnCrmRoute = CRM_GROUP_ITEMS.some((item) => pathname.startsWith(item.href));
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    const stored = window.localStorage.getItem(CRM_EXPANDED_KEY);
    if (stored !== null) {
      setExpanded(stored === "true");
    } else if (isOnCrmRoute) {
      setExpanded(true);
    }
    // Only run on mount — the route-based default above only applies before
    // a stored preference exists; toggling by hand always wins after that.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function toggleExpanded() {
    const next = !expanded;
    setExpanded(next);
    window.localStorage.setItem(CRM_EXPANDED_KEY, String(next));
  }

  function renderLink({ href, labelKey, Icon }: { href: string; labelKey: string; Icon: typeof HomeIcon }) {
    const active = href === "/d" ? pathname === "/d" : pathname.startsWith(href);
    return (
      <Link key={href} href={href} className="desktop-sidebar-item" data-active={active}>
        <Icon />
        <span>{t(labelKey)}</span>
      </Link>
    );
  }

  return (
    <nav className="desktop-sidebar">
      <div className="desktop-sidebar-brand">Cortège</div>
      <div className="desktop-sidebar-nav">
        {TOP_ITEMS_BEFORE_GROUP.map(renderLink)}

        <button
          type="button"
          className="desktop-sidebar-group-toggle"
          onClick={toggleExpanded}
          aria-expanded={expanded}
          aria-controls="crm-group-children"
        >
          <GridIcon />
          <span>{t("sidebar.crm")}</span>
          <span className="desktop-sidebar-group-chevron" data-expanded={expanded}>
            <ChevronDownIcon />
          </span>
        </button>
        {expanded && (
          <div id="crm-group-children" className="desktop-sidebar-group-children">
            {CRM_GROUP_ITEMS.map(renderLink)}
          </div>
        )}

        {TOP_ITEMS_AFTER_GROUP.map(renderLink)}
      </div>
    </nav>
  );
}
