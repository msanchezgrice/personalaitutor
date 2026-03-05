"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { Route } from "next";
import { BRAND_NAME } from "@/lib/site";
import { ThemeToggle } from "./theme-toggle";

const links = [
  { href: "/dashboard", label: "Home", icon: "⌂" },
  { href: "/dashboard/chat", label: "Chat Tutor", icon: "✦" },
  { href: "/dashboard/projects", label: "Projects", icon: "▣" },
  { href: "/dashboard/social", label: "Social Media", icon: "in" },
  { href: "/dashboard/ai-news", label: "AI News", icon: "🗞" },
  { href: "/dashboard/updates", label: "Activity", icon: "◷", count: 2 },
  { href: "/dashboard/profile", label: "Profile", icon: "◉" },
] as const satisfies ReadonlyArray<{ href: Route; label: string; icon: string; count?: number }>;

export function DashboardSidebar() {
  const pathname = usePathname();

  return (
    <aside className="dash-sidebar">
      <Link href="/" className="dash-brand">
        <span className="dash-brand-mark">🧠</span>
        <span>{BRAND_NAME}</span>
      </Link>

      <div className="dash-user">
        <img className="dash-avatar" src="/assets/avatar.png" alt="Alex Chen" style={{ objectFit: "cover" }} />
        <div>
          <h4>Alex Chen</h4>
          <p>Product Manager</p>
        </div>
      </div>

      <nav className="dash-nav">
        {links.map((link) => {
          const active = pathname === link.href;
          return (
            <Link key={link.href} href={link.href} className={`dash-link${active ? " active" : ""}`}>
              <span className="dash-link-left">
                <span>{link.icon}</span>
                <span>{link.label}</span>
              </span>
              {"count" in link && link.count ? <span className="dash-pill-alert">{link.count}</span> : null}
            </Link>
          );
        })}
      </nav>

      <div className="dash-sidecard">
        <h3>Level 3</h3>
        <p>Intermediate Automator</p>
        <div className="dash-progress">
          <span />
        </div>
        <p style={{ marginTop: 8, fontSize: ".8rem" }}>400 XP to Level 4</p>
      </div>

      <div className="dash-public-link">
        <Link className="btn" href="/u/test-user-0001">
          Public Profile
        </Link>
      </div>

      <ThemeToggle />
    </aside>
  );
}
