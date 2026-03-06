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
      return "border-emerald-500/30 bg-emerald-500/10 text-emerald-400";
    case "built":
      return "border-cyan-500/30 bg-cyan-500/10 text-cyan-400";
    case "in_progress":
      return "border-amber-500/30 bg-amber-500/10 text-amber-400";
    default:
      return "border-white/10 bg-white/5 text-gray-400";
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
    <main data-gemini-shell="1" className="gemini-light-shell talent-pool-shell relative min-h-screen flex flex-col">
      <div className="bg-glow top-[-200px] left-[-100px] opacity-45"></div>
      <div
        className="bg-glow top-[22%] right-[-200px] opacity-35"
        style={{ background: "radial-gradient(circle, var(--secondary-glow) 0%, rgba(0,0,0,0) 70%)" }}
      ></div>

      <header className="glass sticky top-0 z-50 rounded-none border-x-0 border-t-0 bg-opacity-80 backdrop-blur-xl">
        <div className="container nav py-4">
          <Link href="/" className="flex items-center gap-3">
            <img src="/assets/branding/brand_brain_icon.svg" alt={BRAND_NAME} className="h-11 w-11 object-contain" />
            <span className="font-[Outfit] text-[1.85rem] font-bold leading-none tracking-tight text-slate-900">
              {BRAND_NAME}
            </span>
          </Link>
          <div className="flex gap-4">
            <Link href="/dashboard" className="btn btn-secondary">Dashboard</Link>
            <Link href="/" className="btn btn-primary">Start Assessment</Link>
          </div>
        </div>
      </header>

      <div className="container relative w-full max-w-7xl flex-grow pb-24 pt-14">
        <div className="mb-10 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <Link href="/employers" className="mb-4 inline-flex items-center gap-2 text-sm font-medium text-emerald-400 transition hover:text-emerald-300">
              <i className="fa-solid fa-arrow-left"></i> Employer Portal
            </Link>
            <h1 className="mb-3 text-5xl font-[Outfit] text-white">Browse Talent Pool</h1>
            <p className="max-w-3xl text-lg text-gray-400">Filter public proof profiles by role, toolset, and verified skill signals.</p>
          </div>
          <div className="flex gap-3">
            <Link href="/dashboard" className="btn btn-secondary">Dashboard</Link>
            <Link href="/" className="btn btn-primary">Start Assessment</Link>
          </div>
        </div>

        <section className="glass mb-8 rounded-2xl p-6 md:p-8">
          <form className="grid items-end gap-4 lg:grid-cols-[1.4fr,repeat(4,minmax(0,1fr)),auto]" method="get">
            <label className="block">
              <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.18em] text-gray-500">Search</span>
              <input
                type="text"
                name="q"
                defaultValue={q}
                placeholder="Role, skill, tool, or handle"
                className="w-full rounded-full border border-white/10 bg-black/40 px-4 py-3 text-sm text-white placeholder:text-gray-500 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
              />
            </label>
            <label className="block">
              <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.18em] text-gray-500">Role</span>
              <select name="role" defaultValue={role} className="w-full rounded-full border border-white/10 bg-black/40 px-4 py-3 text-sm text-white focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500">
                <option value="">All roles</option>
                {facets.roles.map((entry) => (
                  <option key={entry} value={entry}>{entry}</option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.18em] text-gray-500">Skill</span>
              <select name="skill" defaultValue={skill} className="w-full rounded-full border border-white/10 bg-black/40 px-4 py-3 text-sm text-white focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500">
                <option value="">All skills</option>
                {facets.modules.map((entry) => (
                  <option key={entry} value={entry}>{entry}</option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.18em] text-gray-500">Tool</span>
              <select name="tool" defaultValue={tool} className="w-full rounded-full border border-white/10 bg-black/40 px-4 py-3 text-sm text-white focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500">
                <option value="">All tools</option>
                {facets.tools.map((entry) => (
                  <option key={entry} value={entry}>{entry}</option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.18em] text-gray-500">Status</span>
              <select name="status" defaultValue={status} className="w-full rounded-full border border-white/10 bg-black/40 px-4 py-3 text-sm text-white focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500">
                <option value="">All status</option>
                <option value="verified">Verified</option>
                <option value="built">Built</option>
                <option value="in_progress">In Progress</option>
                <option value="not_started">Not Started</option>
              </select>
            </label>
            <div className="flex gap-3">
              <button type="submit" className="btn btn-primary px-6 py-3">Apply</button>
              <Link href="/employers/talent" className="btn btn-secondary px-6 py-3">Clear</Link>
            </div>
          </form>
        </section>

        <section className="mb-6 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div>
            <div className="mb-2 text-xs font-semibold uppercase tracking-[0.22em] text-emerald-400">Results</div>
            <h2 className="text-3xl font-[Outfit] text-white">{rows.length} candidate{rows.length === 1 ? "" : "s"} match your criteria</h2>
          </div>
          {(q || role || skill || tool || status) ? (
            <div className="flex flex-wrap gap-2 text-xs">
              {q ? <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-gray-300">Search: {q}</span> : null}
              {role ? <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-gray-300">Role: {role}</span> : null}
              {skill ? <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-gray-300">Skill: {skill}</span> : null}
              {tool ? <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-gray-300">Tool: {tool}</span> : null}
              {status ? <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-gray-300">Status: {statusLabel(status)}</span> : null}
            </div>
          ) : null}
        </section>

        {rows.length ? (
          <section className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
            {rows.map((candidate) => (
              <a
                key={candidate.handle}
                href={`/u/${candidate.handle}/`}
                className="glass group rounded-2xl border border-white/10 p-6 transition hover:bg-white/5 hover:border-emerald-500/40"
              >
                <div className="mb-5 flex items-start justify-between gap-4">
                  <div className="flex min-w-0 items-center gap-3">
                    <img src={candidate.avatarUrl || "/assets/avatar.png"} alt={candidate.name} className="h-16 w-16 rounded-full border border-white/20 object-cover" />
                    <div className="min-w-0">
                      <div className="truncate text-xl font-medium text-white transition group-hover:text-emerald-400">{candidate.name}</div>
                      <div className="truncate text-sm text-emerald-400">{candidate.role}</div>
                      <div className="mt-1 text-xs text-gray-500">{candidate.careerType}</div>
                    </div>
                  </div>
                  <span className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold ${statusTone(candidate.status)}`}>
                    {statusLabel(candidate.status)}
                  </span>
                </div>

                <div className="mb-4 rounded-2xl border border-white/10 bg-black/30 p-4">
                  <div className="mb-2 flex items-center justify-between gap-3 text-xs text-gray-500">
                    <span>Evidence score</span>
                    <span>{candidate.evidenceScore}%</span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-white/10">
                    <div className={`h-full rounded-full bg-gradient-to-r ${scoreTone(candidate.evidenceScore)}`} style={{ width: `${Math.max(8, candidate.evidenceScore)}%` }}></div>
                  </div>
                </div>

                <div className="mb-4">
                  <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-gray-500">Top skills</div>
                  <div className="flex flex-wrap gap-2">
                    {candidate.topSkills.slice(0, 3).map((entry) => (
                      <span key={entry} className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[11px] text-gray-300">{entry}</span>
                    ))}
                  </div>
                </div>

                <div className="mb-5">
                  <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-gray-500">Tools</div>
                  <div className="text-sm text-gray-400">{candidate.topTools.slice(0, 3).join(" • ")}</div>
                </div>

                <div className="inline-flex items-center gap-2 text-sm font-medium text-emerald-400">
                  View public proof profile <span aria-hidden>→</span>
                </div>
              </a>
            ))}
          </section>
        ) : (
          <section className="glass rounded-2xl p-10 text-center text-gray-400">
            <h3 className="mb-3 text-2xl font-[Outfit] text-white">No candidates matched those filters</h3>
            <p className="mb-6">Broaden the search or clear the filters to see the full talent pool.</p>
            <Link href="/employers/talent" className="btn btn-primary px-5 py-3">Reset filters</Link>
          </section>
        )}
      </div>
    </main>
  );
}
