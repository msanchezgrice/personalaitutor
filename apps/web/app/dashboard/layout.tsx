import type { Metadata } from "next";
import type { ReactNode } from "react";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getDashboardBillingGateState } from "@/app/dashboard/_lib";
import { buildBillingGateRedirect, shouldRedirectBlockedDashboardPath } from "@/lib/billing";
import { BRAND_NAME } from "@/lib/site";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

export const metadata: Metadata = {
  title: `${BRAND_NAME} | Dashboard`,
  robots: {
    index: false,
    follow: false,
  },
};

export default async function DashboardLayout({ children }: { children: ReactNode }) {
  const headerStore = await headers();
  const pathname = headerStore.get("x-pathname") || "/dashboard";
  const billing = await getDashboardBillingGateState();

  if (!pathname.startsWith("/dashboard/admin") && shouldRedirectBlockedDashboardPath(pathname, billing.status)) {
    redirect(buildBillingGateRedirect(pathname) as Parameters<typeof redirect>[0]);
  }

  return <>{children}</>;
}
