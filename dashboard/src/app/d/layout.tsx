import { Sidebar } from "@/components/Sidebar";

export default function DesktopLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="desktop-shell">
      <div className="desktop-ambient" aria-hidden="true">
        <div className="desktop-orb desktop-orb-mint" />
        <div className="desktop-orb desktop-orb-violet" />
        <div className="desktop-orb desktop-orb-gold" />
      </div>
      <Sidebar />
      <main className="desktop-content">{children}</main>
    </div>
  );
}
