import Link from "next/link";
import { getLearnArticles } from "@/lib/learn-content";
import {
  getLearningCollections,
  type LearningCollectionId,
} from "@/lib/learning-taxonomy";
import { BRAND_NAME } from "@/lib/site";

type LearningHeaderProps = {
  active?: "learning" | "proof" | "employers";
  activeTab?: "start-here" | LearningCollectionId | null;
  secondaryAction?: {
    href: string;
    label: string;
  };
};

function navLinkClass(active: boolean) {
  return active ? "nav-link text-emerald-700" : "nav-link text-slate-600";
}

function tabClass(active: boolean) {
  return active
    ? "shrink-0 rounded-full border border-emerald-300 bg-emerald-50 px-3 py-1.5 text-sm font-medium text-emerald-700 shadow-sm"
    : "shrink-0 rounded-full border border-slate-300 bg-white/90 px-3 py-1.5 text-sm text-slate-700 transition hover:border-slate-400 hover:text-slate-900";
}

function mobileTabLabel(id: "start-here" | LearningCollectionId) {
  if (id === "start-here") return "Start";
  if (id === "role-playbooks") return "Roles";
  if (id === "workflow-guides") return "Flows";
  return "Proof";
}

export function LearningHeader({ active = "learning", activeTab = null, secondaryAction }: LearningHeaderProps) {
  const articles = getLearnArticles();
  const collections = getLearningCollections();

  return (
    <header className="learning-header glass fixed top-0 z-50 w-full rounded-none border-x-0 border-t-0 bg-opacity-80 backdrop-blur-xl">
      <div className="container">
        <div className="nav flex-row items-center justify-between gap-3 py-3 sm:py-4">
          <Link href="/" className="flex items-center gap-3">
            <img src="/assets/branding/brand_brain_icon.svg" alt={BRAND_NAME} className="h-9 w-9 object-contain sm:h-11 sm:w-11" />
            <div className="min-w-0">
              <div className="font-[Outfit] text-[1.45rem] font-bold leading-none tracking-tight text-slate-900 sm:text-[1.85rem]">
                {BRAND_NAME}
              </div>
              <div className="text-[10px] uppercase tracking-[0.16em] text-cyan-600 sm:text-xs sm:tracking-[0.18em]">
                Learning Journal
              </div>
            </div>
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
            <a href="/sign-up?redirect_url=/onboarding/" className="btn btn-primary px-4 py-2.5 text-sm sm:px-6 sm:py-3 sm:text-base">
              <span className="sm:hidden">Start</span>
              <span className="hidden sm:inline">Start Assessment</span>
            </a>
          </div>
        </div>

        <div className="border-t border-slate-200 py-3">
          <div className="flex flex-col gap-2 sm:gap-3 xl:flex-row xl:items-center xl:justify-between">
            <div className="hidden flex-col gap-1 sm:flex">
              <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                Practical AI skills, workflow systems, and public proof
              </div>
              <div className="text-sm text-slate-600">
                {articles.length} guides live across role playbooks, workflow systems, and career proof.
              </div>
            </div>

            <nav className="flex gap-2 overflow-x-auto pb-1 xl:justify-end xl:pb-0">
              <a href="/learn#latest" className={tabClass(activeTab === "start-here")}>
                <span className="sm:hidden">{mobileTabLabel("start-here")}</span>
                <span className="hidden sm:inline">Start Here</span>
              </a>
              {collections.map((collection) => (
                <a key={collection.id} href={collection.href} className={tabClass(activeTab === collection.id)}>
                  <span className="sm:hidden">{mobileTabLabel(collection.id)}</span>
                  <span className="hidden sm:inline">{collection.label}</span>
                </a>
              ))}
            </nav>
          </div>
        </div>
      </div>
    </header>
  );
}
