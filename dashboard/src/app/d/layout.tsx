import { DesktopHeader } from "@/components/DesktopHeader";
import { FloatingAssistant } from "@/components/FloatingAssistant";
import { GemSmokeBackground } from "@/components/GemSmokeBackground";
import { HudPageTransition } from "@/components/HudPageTransition";
import { SpaceIndicator } from "@/components/SpaceIndicator";
import { LocaleProvider } from "@/lib/i18n/LocaleProvider";

export default function DesktopLayout({ children }: { children: React.ReactNode }) {
  return (
    <LocaleProvider>
      <div className="desktop-shell">
        <GemSmokeBackground />
        <div className="desktop-main">
          <DesktopHeader />
          <main className="desktop-content">
            <HudPageTransition>{children}</HudPageTransition>
          </main>
        </div>
        <SpaceIndicator />
        <FloatingAssistant />
      </div>
    </LocaleProvider>
  );
}
