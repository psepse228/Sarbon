import type { Metadata } from "next";
import { DM_Sans, Syne } from "next/font/google";

import { Nav } from "@/components/Nav";
import { TelegramInit } from "@/components/TelegramInit";

import "./globals.css";

// NOTE: neither Syne nor DM Sans ship a `cyrillic` subset on Google Fonts
// (only latin/latin-ext, +greek for Syne). Since the UI text is Russian,
// Cyrillic glyphs will render in the browser's fallback font while Latin
// characters (numbers, punctuation, any Latin brand names) use these fonts.
// This is a known design-system gap — see dashboard/README.md.
const syne = Syne({ subsets: ["latin"], variable: "--font-syne", weight: ["700", "800"] });
const dmSans = DM_Sans({ subsets: ["latin"], variable: "--font-dm-sans", weight: ["400", "500", "700"] });

export const metadata: Metadata = {
  title: "Sarbon — панель владельца",
  description: "Управление пакетами, вопросами и партнёрами ресторана «Сарбон»",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ru" className={`${syne.variable} ${dmSans.variable}`}>
      <body>
        <TelegramInit />
        <Nav />
        <main className="container">{children}</main>
      </body>
    </html>
  );
}
