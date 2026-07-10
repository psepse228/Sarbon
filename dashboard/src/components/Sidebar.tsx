"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { ChatIcon, FlaskIcon, GearIcon, HomeIcon, SparkleIcon } from "@/components/icons";

const ITEMS = [
  { href: "/d", label: "Обзор", Icon: HomeIcon },
  { href: "/d/conversations", label: "Диалоги", Icon: ChatIcon },
  { href: "/d/configuration", label: "Настройки", Icon: GearIcon },
  { href: "/d/test-console", label: "Тест-консоль", Icon: FlaskIcon },
  { href: "/d/assistant", label: "Ассистент", Icon: SparkleIcon },
] as const;

export function Sidebar() {
  const pathname = usePathname();

  return (
    <nav className="desktop-sidebar">
      <div className="desktop-sidebar-brand">Cortège</div>
      <div className="desktop-sidebar-nav">
        {ITEMS.map(({ href, label, Icon }) => {
          const active = href === "/d" ? pathname === "/d" : pathname.startsWith(href);
          return (
            <Link key={href} href={href} className="desktop-sidebar-item" data-active={active}>
              <Icon />
              <span>{label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
