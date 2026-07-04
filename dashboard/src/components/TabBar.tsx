"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { BellIcon, CalendarIcon, GridIcon, HomeIcon, SparkleIcon } from "@/components/icons";

const TABS = [
  { href: "/", label: "Обзор", Icon: HomeIcon },
  { href: "/assistant", label: "Ассистент", Icon: SparkleIcon },
  { href: "/escalations", label: "Эскалации", Icon: BellIcon },
  { href: "/availability", label: "Календарь", Icon: CalendarIcon },
  { href: "/more", label: "Ещё", Icon: GridIcon },
];

export function TabBar() {
  const pathname = usePathname();

  return (
    <nav className="tab-bar">
      {TABS.map(({ href, label, Icon }) => {
        const active = pathname === href;
        return (
          <Link key={href} href={href} className="tab-bar-item" data-active={active}>
            <span className="tab-bar-icon">
              <Icon />
            </span>
            <span className="tab-bar-label">{label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
