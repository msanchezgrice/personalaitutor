import Link from "next/link";
import { BRAND_NAME } from "@/lib/site";
import { ThemeToggle } from "./theme-toggle";

export function TopNav() {
  return (
    <header className="topbar">
      <div className="container topbar-inner">
        <Link className="brand" href="/">
          <span className="brand-mark">AI</span>
          <span>{BRAND_NAME}</span>
        </Link>

        <nav className="nav">
          <Link href="/">How it works</Link>
          <Link href="/assessment">Assessment</Link>
          <Link href="/onboarding">Onboarding</Link>
          <Link href="/employers">For Employers</Link>
        </nav>

        <div className="top-actions">
          <Link className="btn secondary" href="/onboarding">
            Log In
          </Link>
          <Link className="btn primary" href="/assessment">
            Start Assessment
          </Link>
          <ThemeToggle />
        </div>
      </div>
    </header>
  );
}
