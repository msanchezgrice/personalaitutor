import type { ReactNode } from "react";
import { DashboardSidebar } from "@/components/dashboard-sidebar";

export default function DashboardLayout({ children }: { children: ReactNode }) {
  return (
    <div className="dash-app">
      <DashboardSidebar />
      <main className="dash-main">{children}</main>
    </div>
  );
}
