import type { Metadata, Viewport } from "next";
import { Golos_Text, Unbounded } from "next/font/google";

import { AuthGate } from "@/components/AuthGate";
import { BackgroundVideo } from "@/components/BackgroundVideo";
import { TabBar } from "@/components/TabBar";
import { TelegramInit } from "@/components/TelegramInit";
import { TopHeader } from "@/components/TopHeader";

import "./globals.css";

// Both fonts ship a `cyrillic` subset on Google Fonts, so Russian UI copy
// renders in-brand instead of falling back to the system font.
const unbounded = Unbounded({
  subsets: ["latin", "cyrillic"],
  variable: "--font-unbounded",
  weight: ["500", "700", "800"],
});
const golosText = Golos_Text({
  subsets: ["latin", "cyrillic"],
  variable: "--font-golos",
  weight: ["400", "500", "700", "900"],
});

export const metadata: Metadata = {
  title: "Cortège — панель владельца",
  description: "Управление пакетами, вопросами и партнёрами заведения",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Cortège",
  },
};

export const viewport: Viewport = {
  themeColor: "#0b0d12",
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ru" className={`${unbounded.variable} ${golosText.variable}`}>
      <body>
        <BackgroundVideo />
        <span className="app-background-overlay" aria-hidden="true" />
        <TelegramInit />
        <AuthGate>
          <TopHeader />
          <main className="container">{children}</main>
          <TabBar />
        </AuthGate>
      </body>
    </html>
  );
}
