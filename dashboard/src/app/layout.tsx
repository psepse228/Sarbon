import type { Metadata } from "next";
import { Golos_Text, Yeseva_One } from "next/font/google";

import { Nav } from "@/components/Nav";
import { TelegramInit } from "@/components/TelegramInit";

import "./globals.css";

// Both fonts ship a `cyrillic` subset on Google Fonts, unlike the previous
// Syne/DM Sans pair — Cyrillic body copy now renders in-brand instead of
// falling back to the system font.
const yesevaOne = Yeseva_One({
  subsets: ["latin", "cyrillic"],
  variable: "--font-yeseva",
  weight: "400",
});
const golosText = Golos_Text({
  subsets: ["latin", "cyrillic"],
  variable: "--font-golos",
  weight: ["400", "500", "700"],
});

export const metadata: Metadata = {
  title: "Sarbon — панель владельца",
  description: "Управление пакетами, вопросами и партнёрами ресторана «Сарбон»",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ru" className={`${yesevaOne.variable} ${golosText.variable}`}>
      <body>
        <TelegramInit />
        <Nav />
        <main className="container">{children}</main>
      </body>
    </html>
  );
}
