import { TabBar } from "@/components/TabBar";
import { TopHeader } from "@/components/TopHeader";

export default function MobileLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <TopHeader />
      <main className="container">{children}</main>
      <TabBar />
    </>
  );
}
