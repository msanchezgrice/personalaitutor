import Link from "next/link";
import type { Route } from "next";

type AdminSectionNavProps = {
  active: "signups" | "analytics" | "support";
};

function tabClassName(active: boolean) {
  return active
    ? "rounded-full border border-emerald-400/40 bg-emerald-500/15 px-4 py-2 text-sm font-medium text-emerald-200"
    : "rounded-full border border-white/10 bg-black/20 px-4 py-2 text-sm font-medium text-gray-300 transition hover:border-white/20 hover:text-white";
}

export function AdminSectionNav({ active }: AdminSectionNavProps) {
  return (
    <nav className="flex flex-wrap gap-3" aria-label="Admin sections">
      <Link href={"/dashboard/admin/signups" as Route} className={tabClassName(active === "signups")}>
        Operations
      </Link>
      <Link href={"/dashboard/admin/analytics" as Route} className={tabClassName(active === "analytics")}>
        Funnels
      </Link>
      <Link href={"/dashboard/admin/support" as Route} className={tabClassName(active === "support")}>
        Customer Service
      </Link>
    </nav>
  );
}
