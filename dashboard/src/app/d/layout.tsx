import { DesktopHeader } from "@/components/DesktopHeader";
import { GemSmokeBackground } from "@/components/GemSmokeBackground";
import { Sidebar } from "@/components/Sidebar";

export default function DesktopLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="desktop-shell">
      <GemSmokeBackground />
      <Sidebar />
      <div className="desktop-main">
        <DesktopHeader />
        <main className="desktop-content">{children}</main>
      </div>
    </div>
  );
}
