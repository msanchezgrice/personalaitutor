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

const shellClass = "rounded-[30px] border border-slate-200 bg-white shadow-[0_24px_80px_rgba(15,23,42,0.08)]";
const secondaryButtonClass = "rounded-2xl border border-slate-200 bg-white px-5 py-3 text-sm font-medium text-slate-700 transition hover:bg-slate-50";

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
      return "border-emerald-200 bg-emerald-50 text-emerald-700";
    case "built":
      return "border-sky-200 bg-sky-50 text-sky-700";
    case "in_progress":
      return "border-amber-200 bg-amber-50 text-amber-700";
    default:
      return "border-slate-200 bg-slate-50 text-slate-600";
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
    <main className="min-h-screen bg-[#f4f8f5] text-slate-900">
      <div className="absolute inset-x-0 top-0 h-[360px] bg-[radial-gradient(circle_at_top,rgba(16,185,129,0.14),transparent_58%)] pointer-events-none" />
      <div className="relative mx-auto max-w-7xl px-6 py-8 md:px-10 md:py-10">
        <header className="mb-10 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <Link href="/employers" className="text-sm font-medium text-emerald-700 transition hover:text-emerald-800">← Employer Portal</Link>
            <h1 className="mt-3 mb-3 font-[Outfit] text-4xl font-semibold tracking-tight text-slate-900 md:text-5xl">Browse Talent Pool</h1>
            <p className="max-w-3xl text-lg leading-8 text-slate-600">
              Filter public proof profiles by role, toolset, and verified skill signals.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Link href="/dashboard" className={secondaryButtonClass}>
              Dashboard
            </Link>
            <Link href="/" className="rounded-2xl bg-gradient-to-r from-emerald-500 to-cyan-500 px-5 py-3 text-sm font-semibold text-white shadow-[0_18px_44px_rgba(16,185,129,0.24)]">
              Start Assessment
            </Link>
          </div>
        </header>

        <section className={`${shellClass} mb-8 p-6 md:p-8`}>
          <form className="grid items-end gap-4 lg:grid-cols-[1.4fr,repeat(4,minmax(0,1fr)),auto]" method="get">
            <label className="block">
              <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Search</span>
              <input
                type="text"
                name="q"
                defaultValue={q}
                placeholder="Role, skill, tool, or handle"
                className="w-full rounded-2xl border border-slate-200 bg-[#f8fbfa] px-4 py-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-emerald-400 focus:outline-none"
              />
            </label>
            <label className="block">
              <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Role</span>
              <select name="role" defaultValue={role} className="w-full rounded-2xl border border-slate-200 bg-[#f8fbfa] px-4 py-3 text-sm text-slate-900 focus:border-emerald-400 focus:outline-none">
                <option value="">All roles</option>
                {facets.roles.map((entry) => (
                  <option key={entry} value={entry}>{entry}</option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Skill</span>
              <select name="skill" defaultValue={skill} className="w-full rounded-2xl border border-slate-200 bg-[#f8fbfa] px-4 py-3 text-sm text-slate-900 focus:border-emerald-400 focus:outline-none">
                <option value="">All skills</option>
                {facets.modules.map((entry) => (
                  <option key={entry} value={entry}>{entry}</option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Tool</span>
              <select name="tool" defaultValue={tool} className="w-full rounded-2xl border border-slate-200 bg-[#f8fbfa] px-4 py-3 text-sm text-slate-900 focus:border-emerald-400 focus:outline-none">
                <option value="">All tools</option>
                {facets.tools.map((entry) => (
                  <option key={entry} value={entry}>{entry}</option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Status</span>
              <select name="status" defaultValue={status} className="w-full rounded-2xl border border-slate-200 bg-[#f8fbfa] px-4 py-3 text-sm text-slate-900 focus:border-emerald-400 focus:outline-none">
                <option value="">All status</option>
                <option value="verified">Verified</option>
                <option value="built">Built</option>
                <option value="in_progress">In Progress</option>
                <option value="not_started">Not Started</option>
              </select>
            </label>
            <div className="flex gap-3">
              <button type="submit" className="rounded-2xl bg-gradient-to-r from-emerald-500 to-cyan-500 px-5 py-3 text-sm font-semibold text-white shadow-[0_18px_44px_rgba(16,185,129,0.24)]">
                Apply
              </button>
              <Link href="/employers/talent" className={secondaryButtonClass}>
                Clear
              </Link>
            </div>
          </form>
        </section>

        <section className="mb-6 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div>
            <div className="mb-2 text-xs font-semibold uppercase tracking-[0.22em] text-emerald-700">Results</div>
            <h2 className="font-[Outfit] text-3xl font-semibold tracking-tight text-slate-900">{rows.length} candidate{rows.length === 1 ? "" : "s"} match your criteria</h2>
          </div>
          {(q || role || skill || tool || status) ? (
            <div className="flex flex-wrap gap-2 text-xs">
              {q ? <span className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-slate-600">Search: {q}</span> : null}
              {role ? <span className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-slate-600">Role: {role}</span> : null}
              {skill ? <span className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-slate-600">Skill: {skill}</span> : null}
              {tool ? <span className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-slate-600">Tool: {tool}</span> : null}
              {status ? <span className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-slate-600">Status: {statusLabel(status)}</span> : null}
            </div>
          ) : null}
        </section>

        {rows.length ? (
          <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {rows.map((candidate) => (
              <a
                key={candidate.handle}
                href={`/u/${candidate.handle}/`}
                className="rounded-[24px] border border-slate-200 bg-white p-6 shadow-[0_18px_54px_rgba(15,23,42,0.06)] transition hover:border-emerald-300 hover:shadow-[0_18px_54px_rgba(16,185,129,0.12)]"
              >
                <div className="mb-5 flex items-start justify-between gap-4">
                  <div className="flex min-w-0 items-center gap-3">
                    <img
                      src={candidate.avatarUrl || "/assets/avatar.png"}
                      alt={candidate.name}
                      className="h-14 w-14 rounded-2xl border border-slate-200 object-cover"
                    />
                    <div className="min-w-0">
                      <div className="truncate font-[Outfit] text-xl font-medium text-slate-900">{candidate.name}</div>
                      <div className="truncate text-sm text-emerald-700">{candidate.role}</div>
                      <div className="mt-1 text-xs text-slate-500">{candidate.careerType}</div>
                    </div>
                  </div>
                  <span className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold ${statusTone(candidate.status)}`}>
                    {statusLabel(candidate.status)}
                  </span>
                </div>

                <div className="mb-4 rounded-2xl border border-slate-200 bg-[#f8fbfa] p-4">
                  <div className="mb-2 flex items-center justify-between gap-3 text-xs text-slate-500">
                    <span>Evidence score</span>
                    <span>{candidate.evidenceScore}%</span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-slate-200">
                    <div className={`h-full rounded-full bg-gradient-to-r ${scoreTone(candidate.evidenceScore)}`} style={{ width: `${Math.max(8, candidate.evidenceScore)}%` }} />
                  </div>
                </div>

                <div className="mb-4">
                  <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">Top skills</div>
                  <div className="flex flex-wrap gap-2">
                    {candidate.topSkills.slice(0, 3).map((entry) => (
                      <span key={entry} className="rounded-full border border-slate-200 bg-[#f8fbfa] px-2.5 py-1 text-[11px] text-slate-700">
                        {entry}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="mb-5">
                  <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">Tools</div>
                  <div className="text-sm text-slate-600">{candidate.topTools.slice(0, 3).join(" • ")}</div>
                </div>

                <div className="inline-flex items-center gap-2 text-sm font-medium text-emerald-700">
                  View public proof profile <span aria-hidden>→</span>
                </div>
              </a>
            ))}
          </section>
        ) : (
          <section className={`${shellClass} p-10 text-center text-slate-600`}>
            <h3 className="mb-3 font-[Outfit] text-2xl font-semibold text-slate-900">No candidates matched those filters</h3>
            <p className="mb-6">Broaden the search or clear the filters to see the full talent pool.</p>
            <Link href="/employers/talent" className="rounded-2xl bg-gradient-to-r from-emerald-500 to-cyan-500 px-5 py-3 text-sm font-semibold text-white shadow-[0_18px_44px_rgba(16,185,129,0.24)]">
              Reset filters
            </Link>
          </section>
        )}
      </div>
    </main>
  );
}
