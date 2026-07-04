"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { ChevronLeftIcon } from "@/components/icons";

const MAIN_TABS = ["/", "/escalations", "/availability", "/more"];

function backTarget(pathname: string): { href: string; label: string } | null {
  if (MAIN_TABS.includes(pathname)) return null;
  if (pathname.startsWith("/conversations/")) return { href: "/conversations", label: "Диалоги" };
  return { href: "/more", label: "Ещё" };
}

export function TopHeader() {
  const pathname = usePathname();
  const back = backTarget(pathname);

  return (
    <header className="top-header">
      {back ? (
        <Link href={back.href} className="top-header-back">
          <ChevronLeftIcon />
          <span>{back.label}</span>
        </Link>
      ) : (
        <span className="top-header-brand">Cortège</span>
      )}
    </header>
  );
}
