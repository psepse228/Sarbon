import { DesktopSuggestBanner } from "@/components/DesktopSuggestBanner";
import { GemSmokeBackground } from "@/components/GemSmokeBackground";
import { TabBar } from "@/components/TabBar";
import { TopHeader } from "@/components/TopHeader";

export default function MobileLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="mobile-shell">
      <GemSmokeBackground />
      <DesktopSuggestBanner />
      <TopHeader />
      <main className="container">{children}</main>
      <TabBar />
    </div>
  );
}
