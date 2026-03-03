import type { Metadata } from "next";
import type { ReactNode } from "react";
import { BRAND_NAME } from "@/lib/site";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: `${BRAND_NAME} | Dashboard`,
  robots: {
    index: false,
    follow: false,
  },
};

export default function DashboardLayout({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
