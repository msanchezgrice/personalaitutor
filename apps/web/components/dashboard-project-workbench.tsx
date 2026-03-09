"use client";

import { useState } from "react";
import { captureAnalyticsEvent } from "@/lib/analytics";
import type { OAuthConnection, ProjectModuleStep, RecommendedModuleGuide } from "@aitutor/shared";

type DashboardProjectWorkbenchProps = {
  guide: RecommendedModuleGuide;
  projectId: string | null;
  projectTitle: string;
  projectState: string;
  artifactCount: number;
  recentArtifacts: Array<{ kind: string; url: string; createdAt: string }>;
  initialSteps: ProjectModuleStep[];
  oauthConnections: OAuthConnection[];
  publicProfileUrl: string | null;
};

type QueueState = "website" | "pdf" | "pptx" | "progress_note" | "proof_link" | "proof_upload" | "step_update" | null;

function artifactLabel(kind: string) {
  switch (kind) {
    case "website":
      return "Website proof";
    case "pdf":
      return "PDF proof";
    case "pptx":
      return "Deck proof";
    case "proof_link":
      return "Proof link";
    case "proof_upload":
      return "Uploaded proof";
    default:
      return "Proof artifact";
  }
}

function stepStatusLabel(status: ProjectModuleStep["status"]) {
  switch (status) {
    case "completed":
      return "Done";
    case "in_progress":
      return "In progress";
    default:
      return "Not started";
  }
}

function stepStatusClasses(status: ProjectModuleStep["status"]) {
  switch (status) {
    case "completed":
      return "border-emerald-500/30 bg-emerald-500/10 text-emerald-300";
    case "in_progress":
      return "border-amber-500/30 bg-amber-500/10 text-amber-300";
    default:
      return "border-white/10 bg-white/5 text-gray-300";
  }
}

function oauthConnectHref(platform: OAuthConnection["platform"]) {
  if (platform === "x") {
    return "/api/auth/x/start?redirect=1";
  }
  return "/api/auth/linkedin/start?redirect=1&redirectPath=/dashboard/projects/";
}

export function DashboardProjectWorkbench({
  guide,
  projectId,
  projectTitle,
  projectState,
  artifactCount,
  recentArtifacts,
  initialSteps,
  oauthConnections,
  publicProfileUrl,
}: DashboardProjectWorkbenchProps) {
  const [busy, setBusy] = useState<QueueState>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [proofNote, setProofNote] = useState("");
  const [proofLink, setProofLink] = useState("");
  const [proofLinkLabel, setProofLinkLabel] = useState("");
  const [proofLinkNote, setProofLinkNote] = useState("");
  const [proofUploadNote, setProofUploadNote] = useState("");
  const [proofFile, setProofFile] = useState<File | null>(null);
  const [proofFileInputKey, setProofFileInputKey] = useState(0);
  const [artifactCountValue, setArtifactCountValue] = useState(artifactCount);
  const [moduleSteps, setModuleSteps] = useState<ProjectModuleStep[]>(initialSteps);
  const [stepBusyKey, setStepBusyKey] = useState<string | null>(null);
  const [recentArtifactItems, setRecentArtifactItems] = useState(
    [...recentArtifacts].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 3),
  );
  const oauthByPlatform = new Map(oauthConnections.map((connection) => [connection.platform, connection]));
  const completedStepCount = moduleSteps.filter((step) => step.status === "completed").length;
  const totalStepCount = moduleSteps.length;

  async function updateStep(stepKey: string, nextStatus: ProjectModuleStep["status"]) {
    if (!projectId) return;
    setBusy("step_update");
    setStepBusyKey(stepKey);
    setError(null);
    setStatus(null);
    try {
      const response = await fetch(`/api/projects/${projectId}/module-steps`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          stepKey,
          status: nextStatus,
        }),
      });
      const payload = (await response.json().catch(() => ({}))) as {
        ok?: boolean;
        error?: { message?: string };
        moduleSteps?: ProjectModuleStep[];
      };
      if (!response.ok || !payload.ok || !Array.isArray(payload.moduleSteps)) {
        throw new Error(payload.error?.message ?? "Unable to update module step");
      }
      setModuleSteps(payload.moduleSteps);
      captureAnalyticsEvent("project_module_step_updated", {
        project_id: projectId,
        module_title: guide.moduleTitle,
        career_path_id: guide.careerPathId,
        step_key: stepKey,
        step_status: nextStatus,
        completed_step_count_after: payload.moduleSteps.filter((step) => step.status === "completed").length,
      });
      setStatus(
        nextStatus === "completed"
          ? "Step completed. The module checklist is saved to your project."
          : nextStatus === "in_progress"
            ? "Step marked in progress."
            : "Step reopened.",
      );
    } catch (stepError) {
      captureAnalyticsEvent("project_module_step_update_failed", {
        project_id: projectId,
        module_title: guide.moduleTitle,
        career_path_id: guide.careerPathId,
        step_key: stepKey,
        step_status: nextStatus,
      });
      setError(stepError instanceof Error ? stepError.message : "Unable to update module step.");
    } finally {
      setBusy(null);
      setStepBusyKey(null);
    }
  }

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
      captureAnalyticsEvent("project_artifact_generation_requested", {
        project_id: projectId,
        module_title: guide.moduleTitle,
        career_path_id: guide.careerPathId,
        artifact_kind: kind,
      });
      setStatus(
        kind === "website"
          ? "Website generation queued. The published proof card will update after the worker finishes."
          : `${kind.toUpperCase()} generation queued. Check back here after the worker finishes.`,
      );
    } catch (workbenchError) {
      captureAnalyticsEvent("project_artifact_generation_failed", {
        project_id: projectId,
        module_title: guide.moduleTitle,
        career_path_id: guide.careerPathId,
        artifact_kind: kind,
      });
      setError(workbenchError instanceof Error ? workbenchError.message : "Unable to queue artifact generation.");
    } finally {
      setBusy(null);
    }
  }

  async function saveProofNote() {
    if (!projectId || !proofNote.trim()) return;
    setBusy("progress_note");
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
      captureAnalyticsEvent("project_progress_note_saved", {
        project_id: projectId,
        module_title: guide.moduleTitle,
        career_path_id: guide.careerPathId,
      });
      setStatus("Progress note saved. Chat Tutor now has the latest proof context for this pack.");
    } catch (workbenchError) {
      captureAnalyticsEvent("project_progress_note_failed", {
        project_id: projectId,
        module_title: guide.moduleTitle,
        career_path_id: guide.careerPathId,
      });
      setError(workbenchError instanceof Error ? workbenchError.message : "Unable to save progress note.");
    } finally {
      setBusy(null);
    }
  }

  async function submitProofLink() {
    if (!projectId || !proofLink.trim()) return;
    setBusy("proof_link");
    setError(null);
    setStatus(null);
    try {
      const response = await fetch(`/api/projects/${projectId}/proof-link`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          url: proofLink.trim(),
          label: proofLinkLabel.trim() || null,
          note: proofLinkNote.trim() || null,
        }),
      });
      const payload = (await response.json().catch(() => ({}))) as {
        ok?: boolean;
        error?: { message?: string };
        artifact?: { kind?: string; url?: string };
      };
      if (!response.ok || !payload.ok) {
        throw new Error(payload.error?.message ?? "Unable to save proof link");
      }
      setArtifactCountValue((current) => current + 1);
      setRecentArtifactItems((current) => [
        {
          kind: payload.artifact?.kind ?? "proof_link",
          url: payload.artifact?.url ?? proofLink.trim(),
          createdAt: new Date().toISOString(),
        },
        ...current,
      ].slice(0, 3));
      setProofLink("");
      setProofLinkLabel("");
      setProofLinkNote("");
      captureAnalyticsEvent("project_proof_link_saved", {
        project_id: projectId,
        module_title: guide.moduleTitle,
        career_path_id: guide.careerPathId,
        artifact_count_after: artifactCountValue + 1,
        has_public_profile: Boolean(publicProfileUrl),
      });
      setStatus("Proof link saved. This module now has a visible artifact attached to it.");
    } catch (workbenchError) {
      captureAnalyticsEvent("project_proof_link_failed", {
        project_id: projectId,
        module_title: guide.moduleTitle,
        career_path_id: guide.careerPathId,
      });
      setError(workbenchError instanceof Error ? workbenchError.message : "Unable to save proof link.");
    } finally {
      setBusy(null);
    }
  }

  async function uploadProofFile() {
    if (!projectId || !proofFile) return;
    setBusy("proof_upload");
    setError(null);
    setStatus(null);
    try {
      const form = new FormData();
      form.append("file", proofFile);
      form.append("note", proofUploadNote.trim());

      const response = await fetch(`/api/projects/${projectId}/proof-upload`, {
        method: "POST",
        body: form,
      });
      const payload = (await response.json().catch(() => ({}))) as {
        ok?: boolean;
        error?: { message?: string };
        artifact?: { kind?: string; url?: string };
      };
      if (!response.ok || !payload.ok) {
        throw new Error(payload.error?.message ?? "Unable to upload proof file");
      }
      setArtifactCountValue((current) => current + 1);
      setRecentArtifactItems((current) => [
        {
          kind: payload.artifact?.kind ?? "proof_upload",
          url: payload.artifact?.url ?? "#",
          createdAt: new Date().toISOString(),
        },
        ...current,
      ].slice(0, 3));
      setProofFile(null);
      setProofFileInputKey((current) => current + 1);
      setProofUploadNote("");
      captureAnalyticsEvent("project_proof_file_uploaded", {
        project_id: projectId,
        module_title: guide.moduleTitle,
        career_path_id: guide.careerPathId,
        artifact_count_after: artifactCountValue + 1,
        has_public_profile: Boolean(publicProfileUrl),
      });
      setStatus("Proof file uploaded. The workbench now has a saved artifact for this pack.");
    } catch (workbenchError) {
      captureAnalyticsEvent("project_proof_file_upload_failed", {
        project_id: projectId,
        module_title: guide.moduleTitle,
        career_path_id: guide.careerPathId,
      });
      setError(workbenchError instanceof Error ? workbenchError.message : "Unable to upload proof file.");
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
            <div className="mt-4 flex items-center justify-between gap-4 text-xs text-gray-400">
              <span>{completedStepCount} of {totalStepCount} complete</span>
              <span>{totalStepCount ? Math.round((completedStepCount / totalStepCount) * 100) : 0}%</span>
            </div>
            <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-white/5">
              <div
                className="h-full rounded-full bg-gradient-to-r from-emerald-400 to-emerald-500"
                style={{ width: `${totalStepCount ? Math.round((completedStepCount / totalStepCount) * 100) : 0}%` }}
              ></div>
            </div>
            <ol className="mt-4 space-y-3">
              {moduleSteps.map((step) => (
                <li key={step.stepKey} className="rounded-2xl border border-white/10 bg-white/5 p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-3">
                        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-emerald-500/30 bg-emerald-500/10 text-[11px] font-semibold text-emerald-300">
                          {step.orderIndex}
                        </span>
                        <span className="text-sm leading-6 text-gray-200">{step.title}</span>
                      </div>
                      {step.completedAt ? (
                        <div className="mt-2 text-[11px] text-gray-500">
                          Completed {new Date(step.completedAt).toLocaleString()}
                        </div>
                      ) : null}
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={`rounded-full border px-3 py-1 text-[11px] font-semibold ${stepStatusClasses(step.status)}`}>
                        {stepStatusLabel(step.status)}
                      </span>
                      {step.status === "not_started" ? (
                        <button
                          type="button"
                          className="btn btn-secondary px-3 py-1.5 text-xs"
                          onClick={() => updateStep(step.stepKey, "in_progress")}
                          disabled={!projectId || busy !== null}
                        >
                          {busy === "step_update" && stepBusyKey === step.stepKey ? "Saving..." : "Start"}
                        </button>
                      ) : null}
                      {step.status === "in_progress" ? (
                        <>
                          <button
                            type="button"
                            className="btn btn-primary px-3 py-1.5 text-xs"
                            onClick={() => updateStep(step.stepKey, "completed")}
                            disabled={!projectId || busy !== null}
                          >
                            {busy === "step_update" && stepBusyKey === step.stepKey ? "Saving..." : "Mark Done"}
                          </button>
                          <button
                            type="button"
                            className="btn btn-secondary px-3 py-1.5 text-xs"
                            onClick={() => updateStep(step.stepKey, "not_started")}
                            disabled={!projectId || busy !== null}
                          >
                            Reset
                          </button>
                        </>
                      ) : null}
                      {step.status === "completed" ? (
                        <button
                          type="button"
                          className="btn btn-secondary px-3 py-1.5 text-xs"
                          onClick={() => updateStep(step.stepKey, "in_progress")}
                          disabled={!projectId || busy !== null}
                        >
                          {busy === "step_update" && stepBusyKey === step.stepKey ? "Saving..." : "Reopen"}
                        </button>
                      ) : null}
                    </div>
                  </div>
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

        <div className="rounded-2xl border border-white/10 bg-black/20 p-5">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="text-xs font-semibold uppercase tracking-[0.2em] text-sky-300/80">Tool launchers</div>
              <p className="mt-2 text-sm text-gray-400">
                Open the real tools that fit this pack. Connect first where we already support it, otherwise launch into the external workspace.
              </p>
            </div>
            <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] font-semibold text-gray-300">
              {guide.toolLaunches.length} launchers
            </span>
          </div>
          <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {guide.toolLaunches.map((tool) => {
              const connection = tool.platform ? oauthByPlatform.get(tool.platform) ?? null : null;
              const connected = Boolean(connection?.connected);
              const destination = tool.kind === "oauth" && !connected && tool.platform
                ? oauthConnectHref(tool.platform)
                : tool.href;
              const ctaLabel = tool.kind === "oauth" && !connected ? tool.ctaLabel : `Open ${tool.label}`;
              return (
                <a
                  key={tool.key}
                  href={destination}
                  target={tool.opensInNewTab ? "_blank" : undefined}
                  rel={tool.opensInNewTab ? "noreferrer" : undefined}
                  className="rounded-2xl border border-white/10 bg-white/5 p-4 hover:bg-white/10 transition"
                  data-analytics-event="project_tool_launcher_clicked"
                  data-analytics-location="projects_workbench"
                  data-analytics-tool_key={tool.key}
                  data-analytics-tool_kind={tool.kind}
                  data-analytics-connected={connected}
                  data-analytics-destination={destination}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="text-sm font-medium text-white">{tool.label}</div>
                      <div className="mt-2 text-sm leading-6 text-gray-400">{tool.description}</div>
                    </div>
                    <span className={`rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide ${
                      tool.kind === "oauth"
                        ? connected
                          ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
                          : "border-amber-500/30 bg-amber-500/10 text-amber-300"
                        : "border-sky-500/20 bg-sky-500/10 text-sky-200"
                    }`}>
                      {tool.kind === "oauth" ? (connected ? "Connected" : "Connect") : "Ready"}
                    </span>
                  </div>
                  <div className="mt-4 text-xs leading-5 text-gray-500">{tool.verificationHint}</div>
                  <div className="mt-4 flex items-center justify-between gap-3 text-sm font-medium text-white">
                    <span>{ctaLabel}</span>
                    <i className="fa-solid fa-arrow-up-right-from-square text-gray-500"></i>
                  </div>
                </a>
              );
            })}
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
              {artifactCountValue} artifacts
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
            {busy === "progress_note" ? "Saving..." : "Save Progress Note"}
          </button>
        </div>

        <div className="glass p-6 rounded-2xl border border-white/10 space-y-4">
          <div className="text-xs font-semibold uppercase tracking-[0.2em] text-violet-300/80">Submit proof</div>
          <p className="text-sm text-gray-400">
            Paste a live proof link or upload a screenshot, PDF, or text note from the workflow you just built.
          </p>

          <div className="rounded-2xl border border-white/10 bg-black/20 p-4 space-y-3">
            <div className="text-sm font-medium text-white">Proof link</div>
            <input
              value={proofLink}
              onChange={(event) => setProofLink(event.target.value)}
              placeholder="https://..."
              className="w-full rounded-xl border border-white/10 bg-black/30 px-4 py-3 text-sm text-white outline-none transition focus:border-emerald-500/40"
            />
            <input
              value={proofLinkLabel}
              onChange={(event) => setProofLinkLabel(event.target.value)}
              placeholder="Optional label, for example: Live workflow demo"
              className="w-full rounded-xl border border-white/10 bg-black/30 px-4 py-3 text-sm text-white outline-none transition focus:border-emerald-500/40"
            />
            <textarea
              value={proofLinkNote}
              onChange={(event) => setProofLinkNote(event.target.value)}
              rows={3}
              placeholder="Optional note explaining what this link proves."
              className="w-full rounded-xl border border-white/10 bg-black/30 px-4 py-3 text-sm text-white outline-none transition focus:border-emerald-500/40"
            />
            <button
              type="button"
              className="btn btn-secondary w-full justify-center text-sm"
              onClick={submitProofLink}
              disabled={!projectId || !proofLink.trim() || busy !== null}
            >
              <i className="fa-solid fa-link mr-2"></i>
              {busy === "proof_link" ? "Saving Link..." : "Save Proof Link"}
            </button>
          </div>

          <div className="rounded-2xl border border-white/10 bg-black/20 p-4 space-y-3">
            <div className="text-sm font-medium text-white">Proof file</div>
            <input
              key={proofFileInputKey}
              type="file"
              accept=".png,.jpg,.jpeg,.webp,.pdf,.txt"
              onChange={(event) => setProofFile(event.target.files?.[0] ?? null)}
              className="block w-full text-sm text-gray-300 file:mr-4 file:rounded-xl file:border-0 file:bg-emerald-500/20 file:px-4 file:py-2 file:text-sm file:font-medium file:text-emerald-200 hover:file:bg-emerald-500/30"
            />
            <textarea
              value={proofUploadNote}
              onChange={(event) => setProofUploadNote(event.target.value)}
              rows={3}
              placeholder="Optional note describing what this screenshot or file proves."
              className="w-full rounded-xl border border-white/10 bg-black/30 px-4 py-3 text-sm text-white outline-none transition focus:border-emerald-500/40"
            />
            <button
              type="button"
              className="btn btn-secondary w-full justify-center text-sm"
              onClick={uploadProofFile}
              disabled={!projectId || !proofFile || busy !== null}
            >
              <i className="fa-solid fa-upload mr-2"></i>
              {busy === "proof_upload" ? "Uploading Proof..." : "Upload Proof File"}
            </button>
            {proofFile ? (
              <div className="text-xs text-gray-400">
                Selected: {proofFile.name}
              </div>
            ) : null}
          </div>
        </div>

        <div className="glass p-6 rounded-2xl border border-white/10">
          <div className="flex items-center justify-between gap-4">
            <div className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-300/80">Recent proof</div>
            <span className="text-[11px] text-gray-400">{artifactCountValue} total</span>
          </div>
          {recentArtifactItems.length ? (
            <div className="mt-4 space-y-3">
              {recentArtifactItems.map((artifact) => (
                <a
                  key={`${artifact.kind}:${artifact.url}:${artifact.createdAt}`}
                  href={artifact.url}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center justify-between gap-4 rounded-2xl border border-white/10 bg-black/20 px-4 py-3 hover:bg-white/5 transition"
                  data-analytics-event="project_artifact_opened"
                  data-analytics-location="projects_workbench"
                  data-analytics-artifact-kind={artifact.kind}
                  data-analytics-destination={artifact.url}
                >
                  <div className="min-w-0">
                    <div className="text-sm font-medium text-white">{artifactLabel(artifact.kind)}</div>
                    <div className="mt-1 truncate text-xs text-gray-400">{artifact.url}</div>
                  </div>
                  <i className="fa-solid fa-arrow-up-right-from-square text-gray-500"></i>
                </a>
              ))}
            </div>
          ) : (
            <p className="mt-4 text-sm text-gray-400">
              No proof is attached yet. Save a link, upload a file, or generate a public artifact from this pack.
            </p>
          )}
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
