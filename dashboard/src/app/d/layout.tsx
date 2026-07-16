import { DesktopHeader } from "@/components/DesktopHeader";
import { GemSmokeBackground } from "@/components/GemSmokeBackground";
import { Sidebar } from "@/components/Sidebar";
import { LocaleProvider } from "@/lib/i18n/LocaleProvider";

export default function DesktopLayout({ children }: { children: React.ReactNode }) {
  return (
    <LocaleProvider>
      <div className="desktop-shell">
        <GemSmokeBackground />
        <Sidebar />
        <div className="desktop-main">
          <DesktopHeader />
          <main className="desktop-content">{children}</main>
        </div>
      </div>
    </LocaleProvider>
  );
}
