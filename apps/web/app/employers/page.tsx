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
  if (score >= 80) return "border-emerald-500/30 bg-emerald-500/10 text-emerald-400";
  if (score >= 60) return "border-cyan-500/30 bg-cyan-500/10 text-cyan-400";
  return "border-amber-500/30 bg-amber-500/10 text-amber-400";
}

export default async function EmployersPage() {
  const featuredTalent = (await runtimeListTalent()).slice(0, 4);

  return (
    <main data-gemini-shell="1" className="relative min-h-screen flex flex-col">
      <div className="bg-glow top-[-200px] left-[-100px]"></div>
      <div
        className="bg-glow top-[20%] right-[-200px]"
        style={{ background: "radial-gradient(circle, var(--secondary-glow) 0%, rgba(0,0,0,0) 70%)" }}
      ></div>

      <header className="glass sticky top-0 z-50 rounded-none border-x-0 border-t-0 bg-opacity-80 backdrop-blur-xl">
        <div className="container nav py-4">
          <Link href="/" className="flex items-center gap-2">
            <img src="/assets/branding/brand_wordmark_logo.png" alt={BRAND_NAME} className="h-8 w-auto object-contain" />
          </Link>
          <nav className="nav-links hidden md:flex">
            <a href="#how" className="nav-link">How it works</a>
            <a href="#talent" className="nav-link">Browse Talent</a>
            <Link href="/" className="nav-link text-emerald-400">For Learners</Link>
          </nav>
          <div className="flex gap-4">
            <Link href="/dashboard" className="btn btn-secondary">Dashboard</Link>
            <Link href="/employers/talent" className="btn btn-primary animate-pulse-glow">Browse Talent Pool</Link>
          </div>
        </div>
      </header>

      <div className="flex-grow">
        <section className="container relative grid items-center gap-12 pb-32 pt-20 lg:grid-cols-2">
          <div className="z-10">
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-emerald-500/40 bg-emerald-500/10 px-3 py-1 text-sm font-medium text-emerald-300">
              <span className="h-2 w-2 rounded-full bg-emerald-400 animate-ping"></span>
              Proof-backed hiring signals
            </div>
            <h1 className="mb-6 text-5xl lg:text-7xl">Hire talent that <br /><span className="text-gradient">can show the work.</span></h1>
            <p className="mb-8 max-w-lg text-xl leading-relaxed text-gray-400">
              Review verified skill progression, shipped AI projects, and public proof pages before you spend time on interviews.
            </p>
            <div className="mb-10 flex flex-col gap-4 sm:flex-row">
              <Link href="/employers/talent" className="btn btn-primary px-8 py-4 text-lg">Browse Talent Pool</Link>
              <a href="#how" className="btn btn-secondary px-8 py-4 text-lg">See How It Works</a>
            </div>
            <div className="flex items-center gap-4 text-sm text-gray-500">
              <div className="flex -space-x-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-full border-2 border-gray-900 bg-emerald-600 text-xs font-bold text-white">{featuredTalent.length}</div>
                <div className="flex h-8 w-8 items-center justify-center rounded-full border-2 border-gray-900 bg-cyan-600 text-xs font-bold text-white">24/7</div>
              </div>
              <p>Verified candidates live now · proof pages available instantly</p>
            </div>
          </div>

          <div className="perspective-1000 relative z-10 hidden lg:block">
            <div className="origin-center perspective-1000 relative aspect-[4/3] w-full overflow-hidden rounded-2xl border border-gray-200 bg-[#0f111a] shadow-2xl transform -rotate-y-5 rotate-x-5 dark:border-white/20">
              <img src="/assets/screenshot_profile.png" alt="Talent profile preview" className="h-full w-full object-contain p-2" />
            </div>
            <div className="glass-panel animate-float absolute bottom-[-20px] left-[-40px] flex items-center gap-4 p-4" style={{ animationDelay: "1s" }}>
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-emerald-500/20 text-xl text-emerald-400">
                <i className="fa-solid fa-shield-check"></i>
              </div>
              <div>
                <p className="text-sm font-bold text-white">System Verified</p>
                <p className="text-xs font-semibold text-emerald-400">Proof-backed skills</p>
              </div>
            </div>
          </div>
        </section>

        <section className="pb-20">
          <div className="container grid gap-8 md:grid-cols-3">
            <div className="glass p-8 transition duration-300 hover:bg-white/5">
              <div className="mb-6 flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-500/20 text-xl text-emerald-400">
                <i className="fa-solid fa-eye"></i>
              </div>
              <h3 className="mb-3 text-xl text-white">See the build log</h3>
              <p className="text-sm text-gray-400">Inspect the actual prompts, shipped artifacts, and technical choices a candidate made while building with the tutor.</p>
            </div>
            <div className="glass p-8 transition duration-300 hover:bg-white/5">
              <div className="mb-6 flex h-12 w-12 items-center justify-center rounded-xl bg-cyan-500/20 text-xl text-cyan-400">
                <i className="fa-solid fa-check-double"></i>
              </div>
              <h3 className="mb-3 text-xl text-white">Verified execution</h3>
              <p className="text-sm text-gray-400">Signals move from in-progress to verified only after real project milestones, not self-reported claims.</p>
            </div>
            <div className="glass p-8 transition duration-300 hover:bg-white/5">
              <div className="mb-6 flex h-12 w-12 items-center justify-center rounded-xl bg-amber-500/20 text-xl text-amber-400">
                <i className="fa-solid fa-bolt"></i>
              </div>
              <h3 className="mb-3 text-xl text-white">Faster screening</h3>
              <p className="text-sm text-gray-400">Shortlist builders who already use AI tools in production-like workflows instead of screening on theory alone.</p>
            </div>
          </div>
        </section>

        <section id="how" className="relative border-t border-white/5 bg-black/20 py-24">
          <div className="container">
            <div className="mx-auto mb-16 max-w-2xl text-center">
              <h2 className="mb-4 text-4xl text-white">How system verification works</h2>
              <p className="text-gray-400">Every candidate signal is grounded in execution data, artifacts, and build momentum.</p>
            </div>
            <div className="grid gap-8 md:grid-cols-3">
              <div className="glass p-8 transition duration-300 hover:bg-white/5">
                <div className="mb-6 flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-500/20 text-xl text-emerald-400">
                  <i className="fa-solid fa-code-branch"></i>
                </div>
                <h3 className="mb-3 text-xl text-white">1. Capture build signals</h3>
                <p className="text-sm text-gray-400">We track project milestones, tool usage, prompts, and shipped outputs as the learner builds with the AI tutor.</p>
              </div>
              <div className="glass p-8 transition duration-300 hover:bg-white/5">
                <div className="mb-6 flex h-12 w-12 items-center justify-center rounded-xl bg-cyan-500/20 text-xl text-cyan-400">
                  <i className="fa-solid fa-list-check"></i>
                </div>
                <h3 className="mb-3 text-xl text-white">2. Score against role rubrics</h3>
                <p className="text-sm text-gray-400">Signals are evaluated against role-specific competency criteria and promoted when standards are actually met.</p>
              </div>
              <div className="glass p-8 transition duration-300 hover:bg-white/5">
                <div className="mb-6 flex h-12 w-12 items-center justify-center rounded-xl bg-amber-500/20 text-xl text-amber-400">
                  <i className="fa-solid fa-file-signature"></i>
                </div>
                <h3 className="mb-3 text-xl text-white">3. Publish evidence package</h3>
                <p className="text-sm text-gray-400">Recruiters can inspect proof pages, project artifacts, and verification freshness before outreach.</p>
              </div>
            </div>
          </div>
        </section>

        <section id="talent" className="py-24">
          <div className="container">
            <div className="mb-10 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
              <div>
                <div className="mb-2 text-xs font-semibold uppercase tracking-[0.22em] text-emerald-400">Featured talent</div>
                <h2 className="text-4xl text-white">Browse proof-backed AI builders</h2>
              </div>
              <Link href="/employers/talent" className="text-sm font-medium text-emerald-400 hover:text-emerald-300">Open full talent pool →</Link>
            </div>
            <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-4">
              {featuredTalent.map((candidate) => (
                <a key={candidate.handle} href={`/u/${candidate.handle}/`} className="glass group rounded-2xl border border-white/10 p-5 transition hover:bg-white/5 hover:border-emerald-500/40">
                  <div className="mb-4 flex items-start justify-between gap-3">
                    <img src={candidate.avatarUrl || "/assets/avatar.png"} alt={candidate.name} className="h-14 w-14 rounded-full border border-white/20 object-cover" />
                    <span className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold ${scoreTone(candidate.evidenceScore)}`}>{candidate.evidenceScore}% proof</span>
                  </div>
                  <h3 className="mb-1 text-xl font-medium text-white transition group-hover:text-emerald-400">{candidate.name}</h3>
                  <p className="mb-2 text-sm text-emerald-400">{candidate.role}</p>
                  <p className="mb-4 text-xs text-gray-500">{candidate.careerType}</p>
                  <div className="mb-4 flex flex-wrap gap-2">
                    {candidate.topSkills.slice(0, 2).map((skill) => (
                      <span key={skill} className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[11px] text-gray-300">{skill}</span>
                    ))}
                  </div>
                  <div className="text-sm text-gray-400">{candidate.topTools.slice(0, 3).join(" • ")}</div>
                </a>
              ))}
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
