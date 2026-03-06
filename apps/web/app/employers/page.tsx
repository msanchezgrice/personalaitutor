import Link from "next/link";
import type { Metadata } from "next";
import { runtimeListTalent } from "@/lib/runtime";
import {
  BRAND_NAME,
  BRAND_X_HANDLE,
  DEFAULT_OG_IMAGE_ALT,
  DEFAULT_OG_IMAGE_HEIGHT,
  DEFAULT_OG_IMAGE_PATH,
  DEFAULT_OG_IMAGE_WIDTH,
} from "@/lib/site";

export const metadata: Metadata = {
  title: `${BRAND_NAME} | Employer Portal`,
  description:
    "Hire verified AI-native talent with proof-backed project history, build logs, and validated skill signals.",
  alternates: {
    canonical: "/employers",
  },
  openGraph: {
    title: `${BRAND_NAME} | Employer Portal`,
    description:
      "Browse and hire AI-native talent with proof-backed skills and project execution history.",
    url: "/employers",
    images: [{
      url: DEFAULT_OG_IMAGE_PATH,
      width: DEFAULT_OG_IMAGE_WIDTH,
      height: DEFAULT_OG_IMAGE_HEIGHT,
      alt: DEFAULT_OG_IMAGE_ALT,
      type: "image/png",
    }],
  },
  twitter: {
    card: "summary_large_image",
    site: BRAND_X_HANDLE,
    creator: BRAND_X_HANDLE,
    title: `${BRAND_NAME} | Employer Portal`,
    description:
      "Browse and hire AI-native talent with proof-backed skills and project execution history.",
    images: [DEFAULT_OG_IMAGE_PATH],
  },
};

function scoreTone(score: number) {
  if (score >= 80) return "text-emerald-300 border-emerald-400/30 bg-emerald-400/10";
  if (score >= 60) return "text-sky-300 border-sky-400/30 bg-sky-400/10";
  return "text-amber-300 border-amber-400/30 bg-amber-400/10";
}

export default async function EmployersPage() {
  const featuredTalent = (await runtimeListTalent()).slice(0, 4);

  return (
    <main className="min-h-screen bg-[#07111f] text-white">
      <div className="absolute inset-x-0 top-0 h-[360px] bg-[radial-gradient(circle_at_top,rgba(16,185,129,0.18),transparent_55%)] pointer-events-none" />
      <div className="relative max-w-7xl mx-auto px-6 py-8 md:px-10 md:py-10">
        <header className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between mb-12">
          <Link href="/" className="flex items-center gap-3">
            <img src="/assets/branding/brand_brain_icon.svg" alt={BRAND_NAME} className="h-11 w-11 object-contain" />
            <span className="font-[Outfit] text-[1.7rem] font-semibold tracking-tight">{BRAND_NAME}</span>
          </Link>
          <div className="flex flex-wrap items-center gap-3">
            <Link href="/dashboard" className="rounded-2xl border border-white/10 px-5 py-3 text-sm font-medium text-slate-200 hover:bg-white/5 transition">
              Dashboard
            </Link>
            <Link href="/employers/talent" className="rounded-2xl bg-gradient-to-r from-emerald-500 to-cyan-500 px-5 py-3 text-sm font-semibold text-white shadow-[0_18px_44px_rgba(16,185,129,0.28)]">
              Browse Talent Pool
            </Link>
          </div>
        </header>

        <section className="grid gap-6 lg:grid-cols-[1.15fr,0.85fr] items-stretch mb-10">
          <div className="rounded-[28px] border border-white/10 bg-white/5 p-8 shadow-[0_24px_80px_rgba(2,6,23,0.35)] backdrop-blur-xl">
            <div className="inline-flex items-center rounded-full border border-emerald-400/20 bg-emerald-400/10 px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.22em] text-emerald-200 mb-5">
              Proof-backed hiring
            </div>
            <h1 className="font-[Outfit] text-4xl md:text-5xl font-semibold tracking-tight leading-tight mb-4">
              Hire people who can show the work, not just describe it.
            </h1>
            <p className="max-w-2xl text-slate-300 text-lg leading-8 mb-8">
              Review verified skill signals, real project execution, and public proof pages before you spend time on interviews.
            </p>
            <div className="flex flex-wrap gap-3 mb-8">
              <Link href="/employers/talent" className="rounded-2xl bg-gradient-to-r from-emerald-500 to-cyan-500 px-6 py-3 text-sm font-semibold text-white shadow-[0_18px_44px_rgba(16,185,129,0.28)]">
                Explore candidates
              </Link>
              <Link href="/" className="rounded-2xl border border-white/10 px-6 py-3 text-sm font-medium text-slate-200 hover:bg-white/5 transition">
                Learn how the platform works
              </Link>
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                <div className="text-2xl font-[Outfit] font-semibold text-white">{featuredTalent.length || 0}</div>
                <div className="text-sm text-slate-400">Featured candidates live now</div>
              </div>
              <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                <div className="text-2xl font-[Outfit] font-semibold text-white">Proof</div>
                <div className="text-sm text-slate-400">Projects, build logs, and skill evidence</div>
              </div>
              <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                <div className="text-2xl font-[Outfit] font-semibold text-white">Public URLs</div>
                <div className="text-sm text-slate-400">Profiles you can review without a login</div>
              </div>
            </div>
          </div>

          <div className="rounded-[28px] border border-white/10 bg-[#0b1728] p-8 shadow-[0_24px_80px_rgba(2,6,23,0.35)]">
            <h2 className="font-[Outfit] text-2xl font-semibold mb-5">What you get</h2>
            <div className="space-y-4 text-sm text-slate-300 leading-7">
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <div className="text-white font-medium mb-1">Verified skill stack</div>
                <p>Candidates expose tracked skill progression instead of generic keyword resumes.</p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <div className="text-white font-medium mb-1">Project proof and public artifacts</div>
                <p>Review the actual project descriptions, proof pages, and build momentum before outreach.</p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <div className="text-white font-medium mb-1">Faster sourcing loops</div>
                <p>Filter by role, tools, and verified skills in one place instead of bouncing across profiles.</p>
              </div>
            </div>
          </div>
        </section>

        <section className="rounded-[28px] border border-white/10 bg-white/5 p-8 shadow-[0_20px_64px_rgba(2,6,23,0.28)]">
          <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between mb-6">
            <div>
              <div className="text-xs font-semibold uppercase tracking-[0.22em] text-emerald-200 mb-2">Featured talent</div>
              <h2 className="font-[Outfit] text-3xl font-semibold tracking-tight">Browse proof-backed AI builders</h2>
            </div>
            <Link href="/employers/talent" className="text-sm font-medium text-emerald-300 hover:text-emerald-200 transition">
              Open full talent pool →
            </Link>
          </div>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {featuredTalent.map((candidate) => (
              <a
                key={candidate.handle}
                href={`/u/${candidate.handle}/`}
                className="rounded-2xl border border-white/10 bg-[#0b1728]/90 p-5 hover:border-emerald-400/35 hover:bg-[#0f1c31] transition"
              >
                <div className="flex items-start justify-between gap-3 mb-4">
                  <img
                    src={candidate.avatarUrl || "/assets/avatar.png"}
                    alt={candidate.name}
                    className="h-14 w-14 rounded-2xl object-cover border border-white/10"
                  />
                  <span className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold ${scoreTone(candidate.evidenceScore)}`}>
                    {candidate.evidenceScore}% proof
                  </span>
                </div>
                <h3 className="font-[Outfit] text-xl font-medium text-white mb-1">{candidate.name}</h3>
                <p className="text-sm text-emerald-200 mb-2">{candidate.role}</p>
                <p className="text-xs text-slate-400 mb-4">{candidate.careerType}</p>
                <div className="flex flex-wrap gap-2 mb-4">
                  {candidate.topSkills.slice(0, 2).map((skill) => (
                    <span key={skill} className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[11px] text-slate-200">
                      {skill}
                    </span>
                  ))}
                </div>
                <div className="text-sm text-slate-300">{candidate.topTools.slice(0, 3).join(" • ")}</div>
              </a>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}
