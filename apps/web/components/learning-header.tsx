import Link from "next/link";
import { BRAND_NAME } from "@/lib/site";

type LearningHeaderProps = {
  active?: "learning" | "proof" | "employers";
  secondaryAction?: {
    href: string;
    label: string;
  };
};

function navLinkClass(active: boolean) {
  return active ? "nav-link text-emerald-400" : "nav-link text-gray-300";
}

export function LearningHeader({ active = "learning", secondaryAction }: LearningHeaderProps) {
  return (
    <header className="glass fixed top-0 z-50 w-full rounded-none border-x-0 border-t-0 bg-opacity-80 backdrop-blur-xl">
      <div className="container nav py-4">
        <Link href="/" className="flex items-center gap-3">
          <img src="/assets/branding/brand_brain_icon.svg" alt={BRAND_NAME} className="h-11 w-11 object-contain" />
          <span className="font-[Outfit] text-[1.85rem] font-bold leading-none tracking-tight text-white">
            {BRAND_NAME}
          </span>
        </Link>

        <nav className="nav-links hidden md:flex">
          <Link href="/learn" className={navLinkClass(active === "learning")}>Learning</Link>
          <Link href="/u/alex-chen-ai" className={navLinkClass(active === "proof")}>Public Proof</Link>
          <Link href="/employers" className={navLinkClass(active === "employers")}>For Employers</Link>
        </nav>

        <div className="flex items-center gap-3">
          {secondaryAction ? (
            <a href={secondaryAction.href} className="btn btn-secondary hidden sm:inline-flex">
              {secondaryAction.label}
            </a>
          ) : null}
          <a href="/sign-up?redirect_url=/onboarding/" className="btn btn-primary">
            Start Assessment
          </a>
        </div>
      </div>
    </header>
  );
}
