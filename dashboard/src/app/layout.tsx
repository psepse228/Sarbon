import type { Metadata, Viewport } from "next";
import { Golos_Text, Unbounded } from "next/font/google";

import { AuthGate } from "@/components/AuthGate";
import { TelegramInit } from "@/components/TelegramInit";

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
  robots: { index: false, follow: false },
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
        <TelegramInit />
        <AuthGate>{children}</AuthGate>
      </body>
    </html>
  );
}
