"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/", label: "Обзор" },
  { href: "/packages", label: "Пакеты" },
  { href: "/faq", label: "Вопросы" },
  { href: "/partners", label: "Партнёры" },
  { href: "/policies", label: "Политики" },
];

export function Nav() {
  const pathname = usePathname();
  return (
    <nav className="nav">
      {LINKS.map((link) => (
        <Link key={link.href} href={link.href} data-active={pathname === link.href}>
          {link.label}
        </Link>
      ))}
    </nav>
  );
}
