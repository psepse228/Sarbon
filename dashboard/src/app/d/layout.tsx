import { GemSmokeBackground } from "@/components/GemSmokeBackground";
import { Sidebar } from "@/components/Sidebar";

export default function DesktopLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="desktop-shell">
      <GemSmokeBackground />
      <Sidebar />
      <main className="desktop-content">{children}</main>
    </div>
  );
}
