"use client";

import { useState } from "react";
import type { RecommendedModuleGuide } from "@aitutor/shared";

type DashboardProjectWorkbenchProps = {
  guide: RecommendedModuleGuide;
  projectId: string | null;
  projectTitle: string;
  projectState: string;
  artifactCount: number;
  publicProfileUrl: string | null;
};

type QueueState = "website" | "pdf" | "pptx" | "note" | null;

export function DashboardProjectWorkbench({
  guide,
  projectId,
  projectTitle,
  projectState,
  artifactCount,
  publicProfileUrl,
}: DashboardProjectWorkbenchProps) {
  const [busy, setBusy] = useState<QueueState>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [proofNote, setProofNote] = useState("");

  async function queueArtifact(kind: "website" | "pdf" | "pptx") {
    if (!projectId) return;
    setBusy(kind);
    setError(null);
    setStatus(null);
    try {
      const response = await fetch(
        kind === "website"
          ? `/api/projects/${projectId}/generate-website`
          : `/api/projects/${projectId}/generate-artifact`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: kind === "website" ? JSON.stringify({}) : JSON.stringify({ kind }),
        },
      );
      const payload = (await response.json().catch(() => ({}))) as {
        ok?: boolean;
        error?: { message?: string };
      };
      if (!response.ok || !payload.ok) {
        throw new Error(payload.error?.message ?? "Unable to queue artifact generation");
      }
      setStatus(
        kind === "website"
          ? "Website generation queued. The published proof card will update after the worker finishes."
          : `${kind.toUpperCase()} generation queued. Check back here after the worker finishes.`,
      );
    } catch (workbenchError) {
      setError(workbenchError instanceof Error ? workbenchError.message : "Unable to queue artifact generation.");
    } finally {
      setBusy(null);
    }
  }

  async function saveProofNote() {
    if (!projectId || !proofNote.trim()) return;
    setBusy("note");
    setError(null);
    setStatus(null);
    try {
      const response = await fetch(`/api/projects/${projectId}/chat`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          message: `Proof update for ${guide.moduleTitle}: ${proofNote.trim()}`,
        }),
      });
      const payload = (await response.json().catch(() => ({}))) as {
        ok?: boolean;
        error?: { message?: string };
      };
      if (!response.ok || !payload.ok) {
        throw new Error(payload.error?.message ?? "Unable to save progress note");
      }
      setProofNote("");
      setStatus("Progress note saved. Chat Tutor now has the latest proof context for this pack.");
    } catch (workbenchError) {
      setError(workbenchError instanceof Error ? workbenchError.message : "Unable to save progress note.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <section id="pack-workbench" className="grid xl:grid-cols-[1.2fr_0.95fr] gap-6">
      <div className="glass p-6 rounded-2xl border border-white/10 space-y-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-emerald-300/80">Module workbench</p>
            <h2 className="text-2xl font-[Outfit] text-white mt-2">{guide.moduleTitle}</h2>
            <p className="text-sm text-gray-400 mt-2">{projectTitle}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-[11px] font-semibold text-emerald-300">
              {guide.careerPathName}
            </span>
            <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] font-semibold text-gray-300">
              {projectState}
            </span>
          </div>
        </div>

        <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-5">
          <div className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-300/80">Why this module</div>
          <p className="mt-3 text-sm leading-6 text-gray-200">{guide.whyThisModule}</p>
        </div>

        <div className="grid md:grid-cols-2 gap-4">
          <div className="rounded-2xl border border-white/10 bg-black/20 p-5">
            <div className="text-xs font-semibold uppercase tracking-[0.2em] text-amber-300/80">Expected output</div>
            <p className="mt-3 text-sm leading-6 text-gray-300">{guide.expectedOutput}</p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-black/20 p-5">
            <div className="text-xs font-semibold uppercase tracking-[0.2em] text-sky-300/80">Recommended tools</div>
            <div className="mt-3 flex flex-wrap gap-2">
              {guide.toolFocus.length ? guide.toolFocus.map((tool) => (
                <span
                  key={tool}
                  className="rounded-full border border-sky-500/20 bg-sky-500/10 px-3 py-1 text-[11px] text-sky-200"
                >
                  {tool}
                </span>
              )) : (
                <span className="text-sm text-gray-400">Use Chat Tutor to choose the lightest-weight tool stack for this build.</span>
              )}
            </div>
          </div>
        </div>

        <div className="grid md:grid-cols-2 gap-4">
          <div className="rounded-2xl border border-white/10 bg-black/20 p-5">
            <div className="text-xs font-semibold uppercase tracking-[0.2em] text-gray-400">Build steps</div>
            <ol className="mt-4 space-y-3">
              {guide.steps.map((step, index) => (
                <li key={step} className="flex gap-3">
                  <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-emerald-500/30 bg-emerald-500/10 text-[11px] font-semibold text-emerald-300">
                    {index + 1}
                  </span>
                  <span className="text-sm leading-6 text-gray-300">{step}</span>
                </li>
              ))}
            </ol>
          </div>
          <div className="rounded-2xl border border-white/10 bg-black/20 p-5">
            <div className="text-xs font-semibold uppercase tracking-[0.2em] text-gray-400">Done when</div>
            <ul className="mt-4 space-y-3">
              {guide.proofChecklist.map((item) => (
                <li key={item} className="flex gap-3">
                  <span className="mt-1 text-emerald-300">
                    <i className="fa-solid fa-check"></i>
                  </span>
                  <span className="text-sm leading-6 text-gray-300">{item}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>

      <div className="space-y-6">
        <div className="glass p-6 rounded-2xl border border-amber-500/20 bg-amber-500/5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="text-xs font-semibold uppercase tracking-[0.2em] text-amber-300/80">Build actions</div>
              <h3 className="mt-2 text-lg font-medium text-white">Turn this pack into visible proof</h3>
            </div>
            <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] font-semibold text-gray-300">
              {artifactCount} artifacts
            </span>
          </div>

          <div className="mt-5 grid gap-3">
            <button
              type="button"
              className="btn btn-primary w-full justify-center text-sm"
              onClick={() => queueArtifact("website")}
              disabled={!projectId || busy !== null}
            >
              <i className="fa-solid fa-globe mr-2"></i>
              {busy === "website" ? "Queueing Website..." : "Generate Website Proof"}
            </button>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                className="btn btn-secondary w-full justify-center text-sm"
                onClick={() => queueArtifact("pdf")}
                disabled={!projectId || busy !== null}
              >
                {busy === "pdf" ? "Queueing..." : "Generate PDF"}
              </button>
              <button
                type="button"
                className="btn btn-secondary w-full justify-center text-sm"
                onClick={() => queueArtifact("pptx")}
                disabled={!projectId || busy !== null}
              >
                {busy === "pptx" ? "Queueing..." : "Generate Deck"}
              </button>
            </div>
            <a
              href="/dashboard/chat/"
              className="btn btn-secondary w-full justify-center text-sm"
              data-analytics-event="projects_cta_clicked"
              data-analytics-cta="ask_chat_tutor_for_module_help"
              data-analytics-location="workbench"
              data-analytics-destination="/dashboard/chat/"
            >
              <i className="fa-solid fa-comments mr-2"></i> Ask Chat Tutor For Help
            </a>
          </div>

          {status ? (
            <div className="mt-4 rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200">
              {status}
            </div>
          ) : null}
          {error ? (
            <div className="mt-4 rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-200">
              {error}
            </div>
          ) : null}
        </div>

        <div className="glass p-6 rounded-2xl border border-white/10">
          <div className="text-xs font-semibold uppercase tracking-[0.2em] text-sky-300/80">Log progress</div>
          <p className="mt-2 text-sm text-gray-400">
            Save one concrete build note so your project log and Chat Tutor context stay current.
          </p>
          <textarea
            value={proofNote}
            onChange={(event) => setProofNote(event.target.value)}
            rows={5}
            placeholder="Example: I used the scoring workflow on 25 accounts, tightened the rules, and now have a first-pass proof artifact."
            className="mt-4 w-full rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-sm text-white outline-none transition focus:border-emerald-500/40"
          />
          <button
            type="button"
            className="btn btn-primary mt-4 w-full justify-center text-sm"
            onClick={saveProofNote}
            disabled={!projectId || !proofNote.trim() || busy !== null}
          >
            <i className="fa-solid fa-pen-to-square mr-2"></i>
            {busy === "note" ? "Saving..." : "Save Progress Note"}
          </button>
        </div>

        <div className="glass p-6 rounded-2xl border border-white/10">
          <div className="text-xs font-semibold uppercase tracking-[0.2em] text-gray-400">Proof destination</div>
          <p className="mt-2 text-sm text-gray-300">
            {publicProfileUrl
              ? "Your public profile is live. Once the artifact is ready, link it from your proof page."
              : "Your public profile is still private. Publish it from the Profile tab when you are ready to show this work publicly."}
          </p>
          <div className="mt-4">
            {publicProfileUrl ? (
              <a
                href={publicProfileUrl}
                className="btn btn-secondary w-full justify-center text-sm"
                data-analytics-event="public_profile_clicked"
                data-analytics-location="projects_workbench"
                data-analytics-destination={publicProfileUrl}
              >
                <i className="fa-solid fa-globe mr-2"></i> Open Live Profile
              </a>
            ) : (
              <a
                href="/dashboard/profile/"
                className="btn btn-secondary w-full justify-center text-sm"
                data-analytics-event="dashboard_nav_clicked"
                data-analytics-location="projects_workbench"
                data-analytics-tab="profile"
                data-analytics-destination="/dashboard/profile/"
              >
                <i className="fa-solid fa-user mr-2"></i> Open Profile Settings
              </a>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
