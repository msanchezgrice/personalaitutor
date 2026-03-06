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

const shellClass = "rounded-[30px] border border-slate-200 bg-white shadow-[0_24px_80px_rgba(15,23,42,0.08)]";
const secondaryButtonClass = "rounded-2xl border border-slate-200 bg-white px-5 py-3 text-sm font-medium text-slate-700 transition hover:bg-slate-50";

function scoreTone(score: number) {
  if (score >= 80) return "text-emerald-700 border-emerald-200 bg-emerald-50";
  if (score >= 60) return "text-sky-700 border-sky-200 bg-sky-50";
  return "text-amber-700 border-amber-200 bg-amber-50";
}

export default async function EmployersPage() {
  const featuredTalent = (await runtimeListTalent()).slice(0, 4);

  return (
    <main className="min-h-screen bg-[#f4f8f5] text-slate-900">
      <div className="absolute inset-x-0 top-0 h-[360px] bg-[radial-gradient(circle_at_top,rgba(16,185,129,0.14),transparent_58%)] pointer-events-none" />
      <div className="relative mx-auto max-w-7xl px-6 py-8 md:px-10 md:py-10">
        <header className="mb-12 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <Link href="/" className="flex items-center gap-3 text-slate-900">
            <img src="/assets/branding/brand_brain_icon.svg" alt={BRAND_NAME} className="h-11 w-11 object-contain" />
            <span className="font-[Outfit] text-[1.7rem] font-semibold tracking-tight">{BRAND_NAME}</span>
          </Link>
          <div className="flex flex-wrap items-center gap-3">
            <Link href="/dashboard" className={secondaryButtonClass}>
              Dashboard
            </Link>
            <Link href="/employers/talent" className="rounded-2xl bg-gradient-to-r from-emerald-500 to-cyan-500 px-5 py-3 text-sm font-semibold text-white shadow-[0_18px_44px_rgba(16,185,129,0.24)]">
              Browse Talent Pool
            </Link>
          </div>
        </header>

        <section className="mb-10 grid items-stretch gap-6 lg:grid-cols-[1.15fr,0.85fr]">
          <div className={`${shellClass} p-8`}>
            <div className="mb-5 inline-flex items-center rounded-full border border-emerald-200 bg-emerald-50 px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.22em] text-emerald-700">
              Proof-backed hiring
            </div>
            <h1 className="mb-4 font-[Outfit] text-4xl font-semibold leading-tight tracking-tight text-slate-900 md:text-5xl">
              Hire people who can show the work, not just describe it.
            </h1>
            <p className="mb-8 max-w-2xl text-lg leading-8 text-slate-600">
              Review verified skill signals, real project execution, and public proof pages before you spend time on interviews.
            </p>
            <div className="mb-8 flex flex-wrap gap-3">
              <Link href="/employers/talent" className="rounded-2xl bg-gradient-to-r from-emerald-500 to-cyan-500 px-6 py-3 text-sm font-semibold text-white shadow-[0_18px_44px_rgba(16,185,129,0.24)]">
                Explore candidates
              </Link>
              <Link href="/" className={secondaryButtonClass}>
                Learn how the platform works
              </Link>
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-2xl border border-slate-200 bg-[#f8fbfa] p-4">
                <div className="text-2xl font-[Outfit] font-semibold text-slate-900">{featuredTalent.length || 0}</div>
                <div className="text-sm text-slate-500">Featured candidates live now</div>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-[#f8fbfa] p-4">
                <div className="text-2xl font-[Outfit] font-semibold text-slate-900">Proof</div>
                <div className="text-sm text-slate-500">Projects, build logs, and skill evidence</div>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-[#f8fbfa] p-4">
                <div className="text-2xl font-[Outfit] font-semibold text-slate-900">Public URLs</div>
                <div className="text-sm text-slate-500">Profiles you can review without a login</div>
              </div>
            </div>
          </div>

          <div className={`${shellClass} bg-[#f8fbfa] p-8`}>
            <h2 className="mb-5 font-[Outfit] text-2xl font-semibold text-slate-900">What you get</h2>
            <div className="space-y-4 text-sm leading-7 text-slate-600">
              <div className="rounded-2xl border border-slate-200 bg-white p-4">
                <div className="mb-1 font-medium text-slate-900">Verified skill stack</div>
                <p>Candidates expose tracked skill progression instead of generic keyword resumes.</p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-white p-4">
                <div className="mb-1 font-medium text-slate-900">Project proof and public artifacts</div>
                <p>Review the actual project descriptions, proof pages, and build momentum before outreach.</p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-white p-4">
                <div className="mb-1 font-medium text-slate-900">Faster sourcing loops</div>
                <p>Filter by role, tools, and verified skills in one place instead of bouncing across profiles.</p>
              </div>
            </div>
          </div>
        </section>

        <section className={`${shellClass} p-8`}>
          <div className="mb-6 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
            <div>
              <div className="mb-2 text-xs font-semibold uppercase tracking-[0.22em] text-emerald-700">Featured talent</div>
              <h2 className="font-[Outfit] text-3xl font-semibold tracking-tight text-slate-900">Browse proof-backed AI builders</h2>
            </div>
            <Link href="/employers/talent" className="text-sm font-medium text-emerald-700 transition hover:text-emerald-800">
              Open full talent pool →
            </Link>
          </div>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {featuredTalent.map((candidate) => (
              <a
                key={candidate.handle}
                href={`/u/${candidate.handle}/`}
                className="rounded-2xl border border-slate-200 bg-[#f8fbfa] p-5 transition hover:border-emerald-300 hover:bg-white hover:shadow-[0_18px_54px_rgba(16,185,129,0.12)]"
              >
                <div className="mb-4 flex items-start justify-between gap-3">
                  <img
                    src={candidate.avatarUrl || "/assets/avatar.png"}
                    alt={candidate.name}
                    className="h-14 w-14 rounded-2xl border border-slate-200 object-cover"
                  />
                  <span className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold ${scoreTone(candidate.evidenceScore)}`}>
                    {candidate.evidenceScore}% proof
                  </span>
                </div>
                <h3 className="mb-1 font-[Outfit] text-xl font-medium text-slate-900">{candidate.name}</h3>
                <p className="mb-2 text-sm text-emerald-700">{candidate.role}</p>
                <p className="mb-4 text-xs text-slate-500">{candidate.careerType}</p>
                <div className="mb-4 flex flex-wrap gap-2">
                  {candidate.topSkills.slice(0, 2).map((skill) => (
                    <span key={skill} className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[11px] text-slate-700">
                      {skill}
                    </span>
                  ))}
                </div>
                <div className="text-sm text-slate-600">{candidate.topTools.slice(0, 3).join(" • ")}</div>
              </a>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}
