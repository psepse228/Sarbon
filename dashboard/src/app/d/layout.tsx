import { Sidebar } from "@/components/Sidebar";

export default function DesktopLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="desktop-shell">
      <Sidebar />
      <main className="desktop-content">{children}</main>
    </div>
  );
}
