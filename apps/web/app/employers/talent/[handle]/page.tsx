import Link from "next/link";
import { notFound } from "next/navigation";
import { runtimeGetTalentByHandle } from "@/lib/runtime";
import { BRAND_NAME } from "@/lib/site";

function statusLabel(value: string) {
  switch (value) {
    case "verified":
      return "Verified";
    case "built":
      return "Built";
    case "in_progress":
      return "In Progress";
    default:
      return "Not Started";
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

export default async function TalentDetailPage({ params }: { params: Promise<{ handle: string }> }) {
  const { handle } = await params;
  const candidate = await runtimeGetTalentByHandle(handle);

  if (!candidate) {
    notFound();
  }

  return (
    <main data-gemini-shell="1" className="gemini-light-shell relative min-h-screen flex flex-col">
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
        </div>
      </header>

      <div className="container relative w-full max-w-5xl flex-grow pb-24 pt-14">
        <Link href="/employers/talent" className="mb-4 inline-flex items-center gap-2 text-sm font-medium text-emerald-400 transition hover:text-emerald-300">
          <i className="fa-solid fa-arrow-left"></i> Back to Talent Pool
        </Link>

        <section className="glass rounded-2xl p-8 md:p-10">
          <div className="flex flex-col gap-6 md:flex-row md:items-start md:justify-between">
            <div className="flex min-w-0 items-center gap-4">
              <img src={candidate.avatarUrl || "/assets/avatar.png"} alt={candidate.name} className="h-24 w-24 rounded-full border border-white/20 object-cover" />
              <div className="min-w-0">
                <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-emerald-300">
                  Talent detail
                </div>
                <h1 className="text-4xl font-[Outfit] text-white">{candidate.name}</h1>
                <p className="mt-2 text-lg text-emerald-400">{candidate.role}</p>
                <p className="mt-1 text-sm text-gray-500">{candidate.careerType}</p>
              </div>
            </div>
            <span className={`rounded-full border px-3 py-1.5 text-xs font-semibold ${statusTone(candidate.status)}`}>
              {statusLabel(candidate.status)}
            </span>
          </div>

          <div className="mt-8 grid gap-4 md:grid-cols-3">
            <div className="rounded-2xl border border-white/10 bg-black/20 p-5">
              <div className="text-xs font-semibold uppercase tracking-[0.18em] text-gray-500">Evidence score</div>
              <div className="mt-3 text-3xl font-[Outfit] text-white">{candidate.evidenceScore}%</div>
            </div>
            <div className="rounded-2xl border border-white/10 bg-black/20 p-5">
              <div className="text-xs font-semibold uppercase tracking-[0.18em] text-gray-500">Top skills</div>
              <div className="mt-3 flex flex-wrap gap-2">
                {candidate.topSkills.map((entry) => (
                  <span key={entry} className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[11px] text-gray-300">{entry}</span>
                ))}
              </div>
            </div>
            <div className="rounded-2xl border border-white/10 bg-black/20 p-5">
              <div className="text-xs font-semibold uppercase tracking-[0.18em] text-gray-500">Top tools</div>
              <div className="mt-3 text-sm leading-6 text-gray-300">{candidate.topTools.join(" • ")}</div>
            </div>
          </div>

          <div className="mt-8 rounded-2xl border border-white/10 bg-black/20 p-6">
            <div className="text-xs font-semibold uppercase tracking-[0.18em] text-gray-500">Why this candidate stands out</div>
            <p className="mt-3 text-sm leading-6 text-gray-300">
              This profile shows visible AI work in {candidate.topSkills[0] || "applied AI"} and a working stack that includes {candidate.topTools[0] || BRAND_NAME}. Use the talent pool to compare proof signals, then reach out once the role and evidence line up.
            </p>
          </div>
        </section>
      </div>
    </main>
  );
}
