import Link from "next/link";
import type { Metadata } from "next";
import { getEmployerFacets, runtimeListTalent } from "@/lib/runtime";
import {
  BRAND_NAME,
  BRAND_X_HANDLE,
  DEFAULT_OG_IMAGE_ALT,
  DEFAULT_OG_IMAGE_HEIGHT,
  DEFAULT_OG_IMAGE_PATH,
  DEFAULT_OG_IMAGE_WIDTH,
} from "@/lib/site";

export const metadata: Metadata = {
  title: `${BRAND_NAME} | Talent Marketplace`,
  description:
    "Search AI-native candidates by verified skills, tools, and project evidence from public proof profiles.",
  alternates: {
    canonical: "/employers/talent",
  },
  openGraph: {
    title: `${BRAND_NAME} | Talent Marketplace`,
    description:
      "Search AI-native candidates by verified skills, tools, and project evidence from public proof profiles.",
    url: "/employers/talent",
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
    title: `${BRAND_NAME} | Talent Marketplace`,
    description:
      "Search AI-native candidates by verified skills, tools, and project evidence from public proof profiles.",
    images: [DEFAULT_OG_IMAGE_PATH],
  },
};

function readParam(value: string | string[] | undefined) {
  if (Array.isArray(value)) return value[0] ?? "";
  return value ?? "";
}

function statusLabel(value: string) {
  switch (value) {
    case "verified":
      return "Verified";
    case "built":
      return "Built";
    case "in_progress":
      return "In Progress";
    case "not_started":
      return "Not Started";
    default:
      return value;
  }
}

function statusTone(value: string) {
  switch (value) {
    case "verified":
      return "border-emerald-400/30 bg-emerald-400/10 text-emerald-200";
    case "built":
      return "border-sky-400/30 bg-sky-400/10 text-sky-200";
    case "in_progress":
      return "border-amber-400/30 bg-amber-400/10 text-amber-200";
    default:
      return "border-white/10 bg-white/5 text-slate-300";
  }
}

function scoreTone(score: number) {
  if (score >= 80) return "from-emerald-500 to-cyan-500";
  if (score >= 60) return "from-sky-500 to-indigo-500";
  return "from-amber-500 to-orange-500";
}

export default async function TalentPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const q = readParam(params.q).trim();
  const role = readParam(params.role).trim();
  const skill = readParam(params.skill).trim();
  const tool = readParam(params.tool).trim();
  const status = readParam(params.status).trim();

  const [rows, facets] = await Promise.all([
    runtimeListTalent({
      q: q || undefined,
      role: role || undefined,
      skill: skill || undefined,
      tool: tool || undefined,
      status: (status as "not_started" | "in_progress" | "built" | "verified" | "") || undefined,
    }),
    Promise.resolve(getEmployerFacets()),
  ]);

  return (
    <main className="min-h-screen bg-[#07111f] text-white">
      <div className="absolute inset-x-0 top-0 h-[360px] bg-[radial-gradient(circle_at_top,rgba(16,185,129,0.18),transparent_55%)] pointer-events-none" />
      <div className="relative max-w-7xl mx-auto px-6 py-8 md:px-10 md:py-10">
        <header className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between mb-10">
          <div>
            <Link href="/employers" className="text-sm text-emerald-300 hover:text-emerald-200 transition">← Employer Portal</Link>
            <h1 className="font-[Outfit] text-4xl md:text-5xl font-semibold tracking-tight mt-3 mb-3">Browse Talent Pool</h1>
            <p className="max-w-3xl text-slate-300 text-lg leading-8">
              Filter public proof profiles by role, toolset, and verified skill signals.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Link href="/dashboard" className="rounded-2xl border border-white/10 px-5 py-3 text-sm font-medium text-slate-200 hover:bg-white/5 transition">
              Dashboard
            </Link>
            <Link href="/" className="rounded-2xl bg-gradient-to-r from-emerald-500 to-cyan-500 px-5 py-3 text-sm font-semibold text-white shadow-[0_18px_44px_rgba(16,185,129,0.28)]">
              Start Assessment
            </Link>
          </div>
        </header>

        <section className="rounded-[28px] border border-white/10 bg-white/5 p-6 md:p-8 shadow-[0_24px_80px_rgba(2,6,23,0.3)] mb-8">
          <form className="grid gap-4 lg:grid-cols-[1.4fr,repeat(4,minmax(0,1fr)),auto] items-end" method="get">
            <label className="block">
              <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Search</span>
              <input
                type="text"
                name="q"
                defaultValue={q}
                placeholder="Role, skill, tool, or handle"
                className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white placeholder:text-slate-500 focus:border-emerald-400 focus:outline-none"
              />
            </label>
            <label className="block">
              <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Role</span>
              <select name="role" defaultValue={role} className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white focus:border-emerald-400 focus:outline-none">
                <option value="">All roles</option>
                {facets.roles.map((entry) => (
                  <option key={entry} value={entry}>{entry}</option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Skill</span>
              <select name="skill" defaultValue={skill} className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white focus:border-emerald-400 focus:outline-none">
                <option value="">All skills</option>
                {facets.modules.map((entry) => (
                  <option key={entry} value={entry}>{entry}</option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Tool</span>
              <select name="tool" defaultValue={tool} className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white focus:border-emerald-400 focus:outline-none">
                <option value="">All tools</option>
                {facets.tools.map((entry) => (
                  <option key={entry} value={entry}>{entry}</option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Status</span>
              <select name="status" defaultValue={status} className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white focus:border-emerald-400 focus:outline-none">
                <option value="">All status</option>
                <option value="verified">Verified</option>
                <option value="built">Built</option>
                <option value="in_progress">In Progress</option>
                <option value="not_started">Not Started</option>
              </select>
            </label>
            <div className="flex gap-3">
              <button type="submit" className="rounded-2xl bg-gradient-to-r from-emerald-500 to-cyan-500 px-5 py-3 text-sm font-semibold text-white shadow-[0_18px_44px_rgba(16,185,129,0.28)]">
                Apply
              </button>
              <Link href="/employers/talent" className="rounded-2xl border border-white/10 px-5 py-3 text-sm font-medium text-slate-200 hover:bg-white/5 transition">
                Clear
              </Link>
            </div>
          </form>
        </section>

        <section className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between mb-6">
          <div>
            <div className="text-xs font-semibold uppercase tracking-[0.22em] text-emerald-200 mb-2">Results</div>
            <h2 className="font-[Outfit] text-3xl font-semibold tracking-tight">{rows.length} candidate{rows.length === 1 ? "" : "s"} match your criteria</h2>
          </div>
          {(q || role || skill || tool || status) ? (
            <div className="flex flex-wrap gap-2 text-xs">
              {q ? <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-slate-300">Search: {q}</span> : null}
              {role ? <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-slate-300">Role: {role}</span> : null}
              {skill ? <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-slate-300">Skill: {skill}</span> : null}
              {tool ? <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-slate-300">Tool: {tool}</span> : null}
              {status ? <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-slate-300">Status: {statusLabel(status)}</span> : null}
            </div>
          ) : null}
        </section>

        {rows.length ? (
          <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {rows.map((candidate) => (
              <a
                key={candidate.handle}
                href={`/u/${candidate.handle}/`}
                className="rounded-[24px] border border-white/10 bg-[#0b1728]/95 p-6 shadow-[0_18px_54px_rgba(2,6,23,0.22)] hover:border-emerald-400/35 hover:bg-[#0f1c31] transition"
              >
                <div className="flex items-start justify-between gap-4 mb-5">
                  <div className="flex items-center gap-3 min-w-0">
                    <img
                      src={candidate.avatarUrl || "/assets/avatar.png"}
                      alt={candidate.name}
                      className="h-14 w-14 rounded-2xl object-cover border border-white/10"
                    />
                    <div className="min-w-0">
                      <div className="font-[Outfit] text-xl font-medium text-white truncate">{candidate.name}</div>
                      <div className="text-sm text-emerald-200 truncate">{candidate.role}</div>
                      <div className="text-xs text-slate-400 mt-1">{candidate.careerType}</div>
                    </div>
                  </div>
                  <span className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold ${statusTone(candidate.status)}`}>
                    {statusLabel(candidate.status)}
                  </span>
                </div>

                <div className="rounded-2xl border border-white/10 bg-black/20 p-4 mb-4">
                  <div className="flex items-center justify-between gap-3 text-xs text-slate-400 mb-2">
                    <span>Evidence score</span>
                    <span>{candidate.evidenceScore}%</span>
                  </div>
                  <div className="h-2 rounded-full bg-white/10 overflow-hidden">
                    <div className={`h-full rounded-full bg-gradient-to-r ${scoreTone(candidate.evidenceScore)}`} style={{ width: `${Math.max(8, candidate.evidenceScore)}%` }} />
                  </div>
                </div>

                <div className="mb-4">
                  <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500 mb-2">Top skills</div>
                  <div className="flex flex-wrap gap-2">
                    {candidate.topSkills.slice(0, 3).map((entry) => (
                      <span key={entry} className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[11px] text-slate-200">
                        {entry}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="mb-5">
                  <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500 mb-2">Tools</div>
                  <div className="text-sm text-slate-300">{candidate.topTools.slice(0, 3).join(" • ")}</div>
                </div>

                <div className="inline-flex items-center gap-2 text-sm font-medium text-emerald-300">
                  View public proof profile <span aria-hidden>→</span>
                </div>
              </a>
            ))}
          </section>
        ) : (
          <section className="rounded-[24px] border border-white/10 bg-white/5 p-10 text-center text-slate-300">
            <h3 className="font-[Outfit] text-2xl font-semibold text-white mb-3">No candidates matched those filters</h3>
            <p className="mb-6">Broaden the search or clear the filters to see the full talent pool.</p>
            <Link href="/employers/talent" className="rounded-2xl bg-gradient-to-r from-emerald-500 to-cyan-500 px-5 py-3 text-sm font-semibold text-white shadow-[0_18px_44px_rgba(16,185,129,0.28)]">
              Reset filters
            </Link>
          </section>
        )}
      </div>
    </main>
  );
}
