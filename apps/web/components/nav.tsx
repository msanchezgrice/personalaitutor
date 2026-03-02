import Link from "next/link";
import { ThemeToggle } from "./theme-toggle";

export function TopNav() {
  return (
    <header className="topbar">
      <div className="container topbar-inner">
        <Link className="brand" href="/">
          AI Tutor
        </Link>
        <nav className="nav">
          <Link href="/">Home</Link>
          <Link href="/assessment">Assessment</Link>
          <Link href="/onboarding">Onboarding</Link>
          <Link href="/dashboard">Dashboard</Link>
          <Link href="/employers/talent">Talent</Link>
          <Link href="/employers">Employers</Link>
        </nav>
        <ThemeToggle />
      </div>
    </header>
  );
}
