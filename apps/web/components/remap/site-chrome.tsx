import type { ReactNode } from "react";
import { BRAND_NAME } from "@/lib/site";

/**
 * Header and footer for every public "remap" page (landing, /map, /remapped,
 * public proof pages). Server components, no client JS.
 *
 * Plain <a> tags on purpose: several targets are hash links or routes owned by
 * other workstreams, and typedRoutes would reject them on <Link>.
 */

export type RemapNavKey = "how" | "proof" | "remapped" | "pricing" | "guides" | null;

type RemapSiteHeaderProps = {
  active?: RemapNavKey;
  /** When true the secondary action becomes "Dashboard" instead of "Log in". */
  signedIn?: boolean;
  /** Replace the primary call to action (default: "Find your new title" -> /map). */
  primaryAction?: { href: string; label: string; testId?: string };
  /** Hide the primary action, e.g. on /map itself. */
  hidePrimaryAction?: boolean;
};

const NAV: Array<{ key: Exclude<RemapNavKey, null>; href: string; label: string }> = [
  { key: "how", href: "/#how", label: "How it works" },
  { key: "proof", href: "/#proof", label: "Proof" },
  { key: "remapped", href: "/remapped", label: "Remapped" },
  { key: "pricing", href: "/#pricing", label: "Pricing" },
  { key: "guides", href: "/learn", label: "Guides" },
];

export function RemapBrand({ href = "/" }: { href?: string }) {
  return (
    <a href={href} className="rm-brand" data-testid="remap-brand">
      <img src="/assets/branding/brand_brain_icon.svg" alt="" width={38} height={38} />
      <span>{BRAND_NAME}</span>
    </a>
  );
}

export function RemapSiteHeader({ active = null, signedIn = false, primaryAction, hidePrimaryAction = false }: RemapSiteHeaderProps) {
  const primary = primaryAction ?? { href: "/map", label: "Find your new title", testId: "cta-map-career-nav" };
  return (
    <header className="rm-header">
      <div className="rm-container rm-header__inner">
        <RemapBrand />
        <nav className="rm-nav" aria-label="Main">
          {NAV.map((item) => (
            <a key={item.key} href={item.href} aria-current={active === item.key ? "page" : undefined}>
              {item.label}
            </a>
          ))}
        </nav>
        <div className="rm-header__actions">
          {signedIn ? (
            <a href="/dashboard/?welcome=1" className="rm-btn rm-btn--secondary rm-btn--sm" data-testid="nav-dashboard">
              Dashboard
            </a>
          ) : (
            <a href="/sign-in?redirect_url=/dashboard/" className="rm-btn rm-btn--secondary rm-btn--sm" data-testid="nav-log-in">
              Log in
            </a>
          )}
          {hidePrimaryAction ? null : (
            <a
              href={primary.href}
              className="rm-btn rm-btn--primary rm-btn--sm"
              data-testid={primary.testId ?? "cta-map-career-nav"}
              data-agent-action="start-career-map"
            >
              {primary.label}
            </a>
          )}
        </div>
      </div>
    </header>
  );
}

export function RemapSiteFooter({ children }: { children?: ReactNode }) {
  return (
    <footer className="rm-footer">
      <div className="rm-container rm-footer__inner">
        <span style={{ flex: "1 1 240px", display: "inline-flex", alignItems: "center", gap: 10, color: "var(--rm-ink)", fontFamily: "var(--rm-display)", fontWeight: 600 }}>
          <img src="/assets/branding/brand_brain_icon.svg" alt="" width={28} height={28} />
          {BRAND_NAME}
        </span>
        <a href="/map">Career map</a>
        <a href="/remapped">Remapped</a>
        <a href="/learn">Guides</a>
        <a href="/employers">For employers</a>
        <a href="/assessment">AI skills assessment</a>
        {children}
      </div>
    </footer>
  );
}
