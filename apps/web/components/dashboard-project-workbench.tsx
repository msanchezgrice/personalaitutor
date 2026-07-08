"use client";

import { useState } from "react";
import { captureAnalyticsEvent } from "@/lib/analytics";
import type { OAuthConnection, ProjectArtifact, ProjectModuleStep, RecommendedModuleGuide } from "@aitutor/shared";

/**
 * Module workbench — single spine (UX audit F4, 2026-07-07).
 *
 * The tutor session IS the workbench: it walks the playbook step-by-step,
 * collects evidence notes and proof (link/file) on the current step, tracks
 * the proof checklist, and generates the artifact as the session finale.
 *
 * Deleted from the UI (endpoints all kept):
 * - Legacy per-step cards with their own Attach Proof / Start / Mark Done
 *   buttons — the session checklist subsumes them.
 * - Standalone "Generate Website/PDF/Deck" Build Actions — generation happens
 *   at session completion; one "Skip ahead" escape hatch remains inside the
 *   session panel and calls the same endpoints.
 * - The Log Progress card — progress notes are the session evidence notes.
 */

export type TutorSessionView = {
  id: string;
  status: "active" | "completed";
  moduleTitle: string;
  currentStepIndex: number;
  steps: Array<{
    index: number;
    title: string;
    whyThisStep: string;
    status: "pending" | "completed";
    completedAt: string | null;
    evidenceNote: string | null;
  }>;
  checklist: Array<{
    index: number;
    label: string;
    done: boolean;
    evidence: string | null;
    completedAt: string | null;
  }>;
  completedAt: string | null;
};

type TutorCompletionView = {
  generation: { ok: boolean; jobId: string | null; failureCode: string | null } | null;
  verified: { awarded: boolean; skill: string | null; reason?: string };
  nextAction: string | null;
};

type DashboardProjectWorkbenchProps = {
  guide: RecommendedModuleGuide;
  projectId: string | null;
  projectTitle: string;
  projectState: string;
  artifactCount: number;
  recentArtifacts: ProjectArtifact[];
  initialSteps: ProjectModuleStep[];
  oauthConnections: OAuthConnection[];
  publicProfileUrl: string | null;
  initialTutorSession?: TutorSessionView | null;
  /** Playbook changed after the active session snapshotted its steps (F5). */
  initialPlaybookDrifted?: boolean;
};

type QueueState =
  | "website"
  | "pdf"
  | "pptx"
  | "proof_link"
  | "proof_upload"
  | "tool_action"
  | "tutor_start"
  | "tutor_restart"
  | "tutor_step"
  | "tutor_checklist"
  | "tutor_complete"
  | "tutor_message"
  | null;

type ToolOutput = {
  toolKey: string;
  actionKey: string;
  title: string;
  content: string;
  copyLabel: string;
  format: "markdown" | "text";
  openUrl?: string | null;
  openLabel?: string | null;
};

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
  initialTutorSession = null,
  initialPlaybookDrifted = false,
}: DashboardProjectWorkbenchProps) {
  const [busy, setBusy] = useState<QueueState>(null);
  const [tutorSession, setTutorSession] = useState<TutorSessionView | null>(initialTutorSession);
  const [playbookDrifted, setPlaybookDrifted] = useState(initialPlaybookDrifted);
  const [tutorEvidenceNote, setTutorEvidenceNote] = useState("");
  const [tutorMessage, setTutorMessage] = useState("");
  const [tutorReply, setTutorReply] = useState<string | null>(null);
  const [tutorArtifactKind, setTutorArtifactKind] = useState<"website" | "pdf" | "pptx" | "resume_docx" | "">("");
  const [tutorCompletion, setTutorCompletion] = useState<TutorCompletionView | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [proofLink, setProofLink] = useState("");
  const [proofLinkNote, setProofLinkNote] = useState("");
  const [proofUploadNote, setProofUploadNote] = useState("");
  const [proofFile, setProofFile] = useState<File | null>(null);
  const [proofFileInputKey, setProofFileInputKey] = useState(0);
  const [attachProofOpen, setAttachProofOpen] = useState(false);
  const [skipAheadOpen, setSkipAheadOpen] = useState(false);
  const [artifactCountValue, setArtifactCountValue] = useState(artifactCount);
  const [artifactItems, setArtifactItems] = useState<ProjectArtifact[]>(
    [...recentArtifacts].sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
  );
  const [toolBusyKey, setToolBusyKey] = useState<string | null>(null);
  const [toolOutput, setToolOutput] = useState<ToolOutput | null>(null);
  const [toolCopyStatus, setToolCopyStatus] = useState<string | null>(null);

  const oauthByPlatform = new Map(oauthConnections.map((connection) => [connection.platform, connection]));
  const tutorCurrentStep = tutorSession
    ? tutorSession.steps.find((step) => step.index === tutorSession.currentStepIndex) ?? null
    : null;
  const tutorStepsDone = tutorSession?.steps.filter((step) => step.status === "completed").length ?? 0;
  const tutorChecklistDone = tutorSession?.checklist.filter((item) => item.done).length ?? 0;
  const tutorReadyToComplete = Boolean(
    tutorSession &&
      tutorSession.status === "active" &&
      tutorStepsDone === tutorSession.steps.length &&
      tutorChecklistDone === tutorSession.checklist.length,
  );
  // The module step that mirrors the session's current step (same playbook,
  // same order) — used so attached proof carries the right stepKey metadata.
  const sessionCurrentModuleStep =
    tutorSession && tutorSession.status === "active"
      ? initialSteps.find((step) => step.orderIndex === tutorSession.currentStepIndex + 1) ?? null
      : null;
  const recentArtifactItems = artifactItems.slice(0, 4);

  async function tutorApi<T>(path: string, body: Record<string, unknown> | null, busyKey: QueueState): Promise<T> {
    if (!projectId) throw new Error("No active project");
    setBusy(busyKey);
    setError(null);
    setStatus(null);
    try {
      const response = await fetch(`/api/projects/${projectId}/tutor-session${path}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body ?? {}),
      });
      const payload = (await response.json().catch(() => ({}))) as { ok?: boolean; error?: { message?: string; details?: Record<string, unknown> } } & T;
      if (!response.ok || !payload.ok) {
        throw new Error(payload.error?.message ?? "Tutor session request failed");
      }
      return payload;
    } finally {
      setBusy(null);
    }
  }

  async function startTutorSessionUi() {
    try {
      const payload = await tutorApi<{ session: TutorSessionView }>("", null, "tutor_start");
      setTutorSession(payload.session);
      setTutorCompletion(null);
      setTutorReply(null);
      setPlaybookDrifted(false);
      captureAnalyticsEvent("tutor_session_started", {
        project_id: projectId,
        module_title: guide.moduleTitle,
        career_path_id: guide.careerPathId,
      });
      setStatus("Tutor session started. Work the current step, then mark it complete with your evidence.");
    } catch (tutorError) {
      captureAnalyticsEvent("tutor_session_start_failed", { project_id: projectId, module_title: guide.moduleTitle });
      setError(tutorError instanceof Error ? tutorError.message : "Unable to start tutor session.");
    }
  }

  async function restartTutorSessionUi() {
    try {
      const payload = await tutorApi<{ session: TutorSessionView }>("", { restart: true }, "tutor_restart");
      setTutorSession(payload.session);
      setTutorCompletion(null);
      setTutorReply(null);
      setTutorEvidenceNote("");
      setPlaybookDrifted(false);
      captureAnalyticsEvent("tutor_session_restarted", {
        project_id: projectId,
        module_title: guide.moduleTitle,
        career_path_id: guide.careerPathId,
        reason: "playbook_updated",
      });
      setStatus("Fresh session started from the updated playbook. Your previous session is archived.");
    } catch (tutorError) {
      captureAnalyticsEvent("tutor_session_restart_failed", { project_id: projectId, module_title: guide.moduleTitle });
      setError(tutorError instanceof Error ? tutorError.message : "Unable to restart tutor session.");
    }
  }

  async function completeTutorStepUi(stepIndex: number) {
    try {
      const payload = await tutorApi<{ session: TutorSessionView }>(
        "/step",
        { stepIndex, evidenceNote: tutorEvidenceNote.trim() || null },
        "tutor_step",
      );
      setTutorSession(payload.session);
      setTutorEvidenceNote("");
      captureAnalyticsEvent("tutor_session_step_completed", {
        project_id: projectId,
        module_title: guide.moduleTitle,
        step_index: stepIndex,
        completed_steps_after: payload.session.steps.filter((step) => step.status === "completed").length,
      });
      setStatus("Step checkpoint saved. The tutor session is resumable any time.");
    } catch (tutorError) {
      setError(tutorError instanceof Error ? tutorError.message : "Unable to complete step.");
    }
  }

  async function toggleTutorChecklistUi(itemIndex: number, done: boolean) {
    try {
      const payload = await tutorApi<{ session: TutorSessionView }>(
        "/checklist",
        { itemIndex, done, evidence: tutorEvidenceNote.trim() || null },
        "tutor_checklist",
      );
      setTutorSession(payload.session);
      captureAnalyticsEvent("tutor_session_checklist_updated", {
        project_id: projectId,
        module_title: guide.moduleTitle,
        item_index: itemIndex,
        done,
        done_count_after: payload.session.checklist.filter((item) => item.done).length,
      });
    } catch (tutorError) {
      setError(tutorError instanceof Error ? tutorError.message : "Unable to update checklist.");
    }
  }

  async function completeTutorSessionUi() {
    try {
      const payload = await tutorApi<{ session: TutorSessionView } & TutorCompletionView>(
        "/complete",
        { artifactKind: tutorArtifactKind || null },
        "tutor_complete",
      );
      setTutorSession(payload.session);
      setTutorCompletion({ generation: payload.generation, verified: payload.verified, nextAction: payload.nextAction });
      captureAnalyticsEvent("tutor_session_completed", {
        project_id: projectId,
        module_title: guide.moduleTitle,
        artifact_kind: tutorArtifactKind || null,
        generation_ok: payload.generation?.ok ?? null,
        verified_awarded: payload.verified.awarded,
      });
      if (payload.generation && !payload.generation.ok) {
        setError(`Artifact generation failed (${payload.generation.failureCode}). No placeholder was created — retry or attach proof.`);
      } else if (payload.verified.awarded) {
        setStatus(`Session complete. ${payload.verified.skill} is now VERIFIED with real proof behind it.`);
      } else {
        setStatus("Session complete. Generate an artifact or attach proof to unlock the verified state.");
      }
    } catch (tutorError) {
      captureAnalyticsEvent("tutor_session_complete_failed", { project_id: projectId, module_title: guide.moduleTitle });
      setError(tutorError instanceof Error ? tutorError.message : "Unable to complete tutor session.");
    }
  }

  async function sendTutorMessageUi() {
    if (!tutorMessage.trim()) return;
    try {
      const payload = await tutorApi<{ reply: string }>("/message", { message: tutorMessage.trim() }, "tutor_message");
      setTutorReply(payload.reply);
      setTutorMessage("");
      captureAnalyticsEvent("tutor_session_message_sent", {
        project_id: projectId,
        module_title: guide.moduleTitle,
      });
    } catch (tutorError) {
      setError(tutorError instanceof Error ? tutorError.message : "Unable to reach the tutor.");
    }
  }

  /** Skip-ahead escape hatch — same generation endpoints as the session finale. */
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
          body: JSON.stringify({
            ...(kind === "website" ? {} : { kind }),
            stepKey: sessionCurrentModuleStep?.stepKey ?? null,
          }),
        },
      );
      const payload = (await response.json().catch(() => ({}))) as {
        ok?: boolean;
        error?: { message?: string };
        project?: { artifacts?: ProjectArtifact[] };
      };
      if (!response.ok || !payload.ok) {
        throw new Error(payload.error?.message ?? "Unable to queue artifact generation");
      }
      if (Array.isArray(payload.project?.artifacts)) {
        const nextArtifacts = [...payload.project.artifacts].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
        setArtifactItems(nextArtifacts);
        setArtifactCountValue(nextArtifacts.length);
      }
      captureAnalyticsEvent("project_artifact_generation_requested", {
        project_id: projectId,
        module_title: guide.moduleTitle,
        career_path_id: guide.careerPathId,
        artifact_kind: kind,
        step_key: sessionCurrentModuleStep?.stepKey ?? null,
        via: "skip_ahead",
      });
      setSkipAheadOpen(false);
      setStatus(
        kind === "website"
          ? "Website generated from what you have so far. Open it from the proof list."
          : `${kind.toUpperCase()} generated from what you have so far. Open it from the proof list.`,
      );
    } catch (workbenchError) {
      captureAnalyticsEvent("project_artifact_generation_failed", {
        project_id: projectId,
        module_title: guide.moduleTitle,
        career_path_id: guide.careerPathId,
        artifact_kind: kind,
        step_key: sessionCurrentModuleStep?.stepKey ?? null,
        via: "skip_ahead",
      });
      setError(workbenchError instanceof Error ? workbenchError.message : "Unable to queue artifact generation.");
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
          label: null,
          note: proofLinkNote.trim() || null,
          stepKey: sessionCurrentModuleStep?.stepKey ?? null,
        }),
      });
      const payload = (await response.json().catch(() => ({}))) as {
        ok?: boolean;
        error?: { message?: string };
        artifact?: { kind?: string; url?: string; stepKey?: string | null };
      };
      if (!response.ok || !payload.ok) {
        throw new Error(payload.error?.message ?? "Unable to save proof link");
      }
      const nextArtifact: ProjectArtifact = {
        kind: payload.artifact?.kind ?? "proof_link",
        url: payload.artifact?.url ?? proofLink.trim(),
        createdAt: new Date().toISOString(),
        metadata: {
          stepKey: payload.artifact?.stepKey ?? sessionCurrentModuleStep?.stepKey ?? null,
          stepTitle: tutorCurrentStep?.title ?? null,
        },
      };
      setArtifactItems((current) => [nextArtifact, ...current]);
      setArtifactCountValue((current) => current + 1);
      setProofLink("");
      setProofLinkNote("");
      captureAnalyticsEvent("project_proof_link_saved", {
        project_id: projectId,
        module_title: guide.moduleTitle,
        career_path_id: guide.careerPathId,
        artifact_count_after: artifactCountValue + 1,
        has_public_profile: Boolean(publicProfileUrl),
        step_key: sessionCurrentModuleStep?.stepKey ?? null,
        via: "tutor_session_step",
      });
      setStatus(
        tutorCurrentStep
          ? `Proof link saved for "${tutorCurrentStep.title}". This step now has visible evidence attached.`
          : "Proof link saved. This module now has a visible artifact attached to it.",
      );
    } catch (workbenchError) {
      captureAnalyticsEvent("project_proof_link_failed", {
        project_id: projectId,
        module_title: guide.moduleTitle,
        career_path_id: guide.careerPathId,
        step_key: sessionCurrentModuleStep?.stepKey ?? null,
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
      if (sessionCurrentModuleStep?.stepKey) {
        form.append("stepKey", sessionCurrentModuleStep.stepKey);
      }

      const response = await fetch(`/api/projects/${projectId}/proof-upload`, {
        method: "POST",
        body: form,
      });
      const payload = (await response.json().catch(() => ({}))) as {
        ok?: boolean;
        error?: { message?: string };
        artifact?: { kind?: string; url?: string; stepKey?: string | null };
      };
      if (!response.ok || !payload.ok) {
        throw new Error(payload.error?.message ?? "Unable to upload proof file");
      }
      const nextArtifact: ProjectArtifact = {
        kind: payload.artifact?.kind ?? "proof_upload",
        url: payload.artifact?.url ?? "#",
        createdAt: new Date().toISOString(),
        metadata: {
          stepKey: payload.artifact?.stepKey ?? sessionCurrentModuleStep?.stepKey ?? null,
          stepTitle: tutorCurrentStep?.title ?? null,
        },
      };
      setArtifactItems((current) => [nextArtifact, ...current]);
      setArtifactCountValue((current) => current + 1);
      setProofFile(null);
      setProofFileInputKey((current) => current + 1);
      setProofUploadNote("");
      captureAnalyticsEvent("project_proof_file_uploaded", {
        project_id: projectId,
        module_title: guide.moduleTitle,
        career_path_id: guide.careerPathId,
        artifact_count_after: artifactCountValue + 1,
        has_public_profile: Boolean(publicProfileUrl),
        step_key: sessionCurrentModuleStep?.stepKey ?? null,
        via: "tutor_session_step",
      });
      setStatus(
        tutorCurrentStep
          ? `Proof file uploaded for "${tutorCurrentStep.title}". This step now has saved evidence attached.`
          : "Proof file uploaded. The workbench now has a saved artifact for this pack.",
      );
    } catch (workbenchError) {
      captureAnalyticsEvent("project_proof_file_upload_failed", {
        project_id: projectId,
        module_title: guide.moduleTitle,
        career_path_id: guide.careerPathId,
        step_key: sessionCurrentModuleStep?.stepKey ?? null,
      });
      setError(workbenchError instanceof Error ? workbenchError.message : "Unable to upload proof file.");
    } finally {
      setBusy(null);
    }
  }

  async function generateToolOutput(toolKey: string) {
    if (!projectId) return;
    setBusy("tool_action");
    setToolBusyKey(toolKey);
    setToolCopyStatus(null);
    setError(null);
    setStatus(null);
    try {
      const response = await fetch(`/api/projects/${projectId}/tool-actions`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          toolKey,
          moduleTitle: guide.moduleTitle,
          careerPathId: guide.careerPathId,
          stepKey: sessionCurrentModuleStep?.stepKey ?? null,
        }),
      });
      const payload = (await response.json().catch(() => ({}))) as {
        ok?: boolean;
        error?: { message?: string };
        output?: ToolOutput;
      };
      if (!response.ok || !payload.ok || !payload.output) {
        throw new Error(payload.error?.message ?? "Unable to generate tool output");
      }
      setToolOutput(payload.output);
      captureAnalyticsEvent("project_tool_output_generated", {
        project_id: projectId,
        module_title: guide.moduleTitle,
        career_path_id: guide.careerPathId,
        tool_key: toolKey,
        action_key: payload.output.actionKey,
        step_key: sessionCurrentModuleStep?.stepKey ?? null,
      });
      setStatus(`${payload.output.title} is ready. Copy it or open the target tool.`);
    } catch (toolError) {
      captureAnalyticsEvent("project_tool_output_failed", {
        project_id: projectId,
        module_title: guide.moduleTitle,
        career_path_id: guide.careerPathId,
        tool_key: toolKey,
        step_key: sessionCurrentModuleStep?.stepKey ?? null,
      });
      setError(toolError instanceof Error ? toolError.message : "Unable to generate tool output.");
    } finally {
      setBusy(null);
      setToolBusyKey(null);
    }
  }

  async function copyToolOutput() {
    if (!toolOutput?.content || typeof navigator === "undefined" || !navigator.clipboard) return;
    try {
      await navigator.clipboard.writeText(toolOutput.content);
      setToolCopyStatus(`${toolOutput.copyLabel} complete.`);
      captureAnalyticsEvent("project_tool_output_copied", {
        project_id: projectId,
        module_title: guide.moduleTitle,
        career_path_id: guide.careerPathId,
        tool_key: toolOutput.toolKey,
        action_key: toolOutput.actionKey,
      });
    } catch {
      setToolCopyStatus("Copy failed. Select and copy the draft manually.");
    }
  }

  return (
    <section id="pack-workbench" className="space-y-6">
      {/* ── The spine: module header + tutor session, full width ───────────── */}
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
            <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] font-semibold text-gray-300">
              {artifactCountValue} artifacts
            </span>
          </div>
        </div>

        <div className="rounded-2xl border border-violet-500/25 bg-violet-500/5 p-5">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="text-xs font-semibold uppercase tracking-[0.2em] text-violet-300/80">Tutor session</div>
              <h3 className="mt-2 text-lg font-medium text-white">
                {tutorSession
                  ? tutorSession.status === "completed"
                    ? "Session complete"
                    : `Step ${Math.min(tutorSession.currentStepIndex + 1, tutorSession.steps.length)} of ${tutorSession.steps.length}`
                  : "Run this module with your tutor"}
              </h3>
            </div>
            {tutorSession ? (
              <div className="flex flex-wrap gap-2">
                <span className="rounded-full border border-violet-500/30 bg-violet-500/10 px-3 py-1 text-[11px] font-semibold text-violet-200">
                  Steps {tutorStepsDone}/{tutorSession.steps.length}
                </span>
                <span className="rounded-full border border-violet-500/30 bg-violet-500/10 px-3 py-1 text-[11px] font-semibold text-violet-200">
                  Checklist {tutorChecklistDone}/{tutorSession.checklist.length}
                </span>
              </div>
            ) : null}
          </div>

          {/* Stale-playbook banner (UX audit F5). */}
          {playbookDrifted && tutorSession && tutorSession.status === "active" ? (
            <div className="mt-4 rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div className="text-sm leading-6 text-amber-200">
                <i className="fa-solid fa-triangle-exclamation mr-2"></i>
                Playbook updated — this session is running the old steps. Restart to get the new version (your current
                session is archived, not lost).
              </div>
              <button
                type="button"
                className="btn btn-secondary text-xs px-3 py-2 whitespace-nowrap"
                onClick={restartTutorSessionUi}
                disabled={!projectId || busy !== null}
              >
                {busy === "tutor_restart" ? "Restarting..." : "Restart Session"}
              </button>
            </div>
          ) : null}

          {!tutorSession ? (
            <div className="mt-4 space-y-4">
              <p className="text-sm leading-6 text-gray-300">
                The tutor walks you through this playbook step-by-step, collects your evidence and proof on each step,
                and ends by generating a real artifact from your work. Progress is saved — you can leave and resume any
                time.
              </p>
              <button
                type="button"
                className="btn btn-primary text-sm px-4 py-2"
                onClick={startTutorSessionUi}
                disabled={!projectId || busy !== null}
              >
                <i className="fa-solid fa-graduation-cap mr-2"></i>
                {busy === "tutor_start" ? "Starting..." : "Start Tutor Session"}
              </button>
            </div>
          ) : (
            <div className="mt-4 space-y-4">
              {tutorSession.status === "active" && tutorCurrentStep ? (
                <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                  <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-violet-300/80">Current step</div>
                  <div className="mt-2 text-sm font-medium text-white">{tutorCurrentStep.title}</div>
                  <p className="mt-2 text-xs leading-5 text-gray-400">{tutorCurrentStep.whyThisStep}</p>
                  <textarea
                    value={tutorEvidenceNote}
                    onChange={(event) => setTutorEvidenceNote(event.target.value)}
                    rows={2}
                    placeholder="What did you do for this step? Paste your evidence or one concrete progress note."
                    className="mt-3 w-full rounded-xl border border-white/10 bg-black/30 px-4 py-3 text-sm text-white outline-none transition focus:border-violet-500/40"
                  />
                  <div className="mt-3 flex flex-wrap items-center gap-3">
                    <button
                      type="button"
                      className="btn btn-primary text-xs px-3 py-2"
                      onClick={() => completeTutorStepUi(tutorCurrentStep.index)}
                      disabled={!projectId || busy !== null}
                    >
                      {busy === "tutor_step" ? "Saving..." : "Mark Step Complete"}
                    </button>
                    <button
                      type="button"
                      className="text-xs text-violet-300 hover:text-violet-200"
                      onClick={() => setAttachProofOpen((open) => !open)}
                    >
                      <i className={`fa-solid ${attachProofOpen ? "fa-chevron-up" : "fa-paperclip"} mr-1`}></i>
                      Attach evidence (link or file)
                    </button>
                  </div>

                  {attachProofOpen ? (
                    <div className="mt-4 grid gap-3 md:grid-cols-2">
                      <div className="rounded-xl border border-white/10 bg-black/20 p-3 space-y-2">
                        <div className="text-xs font-medium text-white">Proof link</div>
                        <input
                          value={proofLink}
                          onChange={(event) => setProofLink(event.target.value)}
                          placeholder="https://..."
                          className="w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm text-white outline-none transition focus:border-violet-500/40"
                        />
                        <input
                          value={proofLinkNote}
                          onChange={(event) => setProofLinkNote(event.target.value)}
                          placeholder="Optional note: what does this link prove?"
                          className="w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm text-white outline-none transition focus:border-violet-500/40"
                        />
                        <button
                          type="button"
                          className="btn btn-secondary w-full justify-center text-xs"
                          onClick={submitProofLink}
                          disabled={!projectId || !proofLink.trim() || busy !== null}
                        >
                          <i className="fa-solid fa-link mr-2"></i>
                          {busy === "proof_link" ? "Saving..." : "Save Proof Link"}
                        </button>
                      </div>
                      <div className="rounded-xl border border-white/10 bg-black/20 p-3 space-y-2">
                        <div className="text-xs font-medium text-white">Proof file</div>
                        <input
                          key={proofFileInputKey}
                          type="file"
                          accept=".png,.jpg,.jpeg,.webp,.pdf,.txt"
                          onChange={(event) => setProofFile(event.target.files?.[0] ?? null)}
                          className="block w-full text-xs text-gray-300 file:mr-3 file:rounded-xl file:border-0 file:bg-emerald-500/20 file:px-3 file:py-1.5 file:text-xs file:font-medium file:text-emerald-200 hover:file:bg-emerald-500/30"
                        />
                        <input
                          value={proofUploadNote}
                          onChange={(event) => setProofUploadNote(event.target.value)}
                          placeholder="Optional note: what does this file prove?"
                          className="w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm text-white outline-none transition focus:border-violet-500/40"
                        />
                        <button
                          type="button"
                          className="btn btn-secondary w-full justify-center text-xs"
                          onClick={uploadProofFile}
                          disabled={!projectId || !proofFile || busy !== null}
                        >
                          <i className="fa-solid fa-upload mr-2"></i>
                          {busy === "proof_upload" ? "Uploading..." : "Upload Proof File"}
                        </button>
                      </div>
                    </div>
                  ) : null}
                </div>
              ) : null}

              <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-violet-300/80">
                  Proof checklist — verified requires all three
                </div>
                <ul className="mt-3 space-y-2">
                  {tutorSession.checklist.map((item) => (
                    <li key={item.index} className="flex items-start justify-between gap-3">
                      <span className={`text-sm leading-6 ${item.done ? "text-emerald-300" : "text-gray-300"}`}>
                        <i className={`fa-solid ${item.done ? "fa-circle-check" : "fa-circle"} mr-2 text-xs`}></i>
                        {item.label}
                      </span>
                      {tutorSession.status === "active" ? (
                        <button
                          type="button"
                          className="btn btn-secondary px-3 py-1 text-[11px]"
                          onClick={() => toggleTutorChecklistUi(item.index, !item.done)}
                          disabled={!projectId || busy !== null}
                        >
                          {busy === "tutor_checklist" ? "..." : item.done ? "Undo" : "Done"}
                        </button>
                      ) : null}
                    </li>
                  ))}
                </ul>
              </div>

              {tutorSession.status === "active" ? (
                <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                  <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-violet-300/80">Ask the tutor</div>
                  <div className="mt-3 flex gap-2">
                    <input
                      value={tutorMessage}
                      onChange={(event) => setTutorMessage(event.target.value)}
                      placeholder="Stuck? Ask about the current step."
                      className="w-full rounded-xl border border-white/10 bg-black/30 px-4 py-2.5 text-sm text-white outline-none transition focus:border-violet-500/40"
                    />
                    <button
                      type="button"
                      className="btn btn-secondary px-3 py-2 text-xs"
                      onClick={sendTutorMessageUi}
                      disabled={!projectId || !tutorMessage.trim() || busy !== null}
                    >
                      {busy === "tutor_message" ? "..." : "Send"}
                    </button>
                  </div>
                  {tutorReply ? (
                    <div className="mt-3 rounded-xl border border-violet-500/20 bg-violet-500/5 px-4 py-3 text-sm leading-6 text-gray-200">
                      {tutorReply}
                    </div>
                  ) : null}
                </div>
              ) : null}

              {tutorSession.status === "active" ? (
                <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-4">
                  <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-emerald-300/80">
                    Finish with real proof
                  </div>
                  <p className="mt-2 text-xs leading-5 text-gray-400">
                    Completing the session can generate your artifact from everything you logged here — or attach your
                    own proof on the current step instead.
                  </p>
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <select
                      value={tutorArtifactKind}
                      onChange={(event) => setTutorArtifactKind(event.target.value as typeof tutorArtifactKind)}
                      className="rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm text-white outline-none"
                    >
                      <option value="">No artifact — I attached proof</option>
                      <option value="website">Generate website</option>
                      <option value="pdf">Generate project brief (PDF)</option>
                      <option value="pptx">Generate deck</option>
                      <option value="resume_docx">Generate resume (DOCX)</option>
                    </select>
                    <button
                      type="button"
                      className="btn btn-primary px-4 py-2 text-sm"
                      onClick={completeTutorSessionUi}
                      disabled={!projectId || !tutorReadyToComplete || busy !== null}
                    >
                      {busy === "tutor_complete" ? "Completing..." : "Complete Session"}
                    </button>
                  </div>
                  {!tutorReadyToComplete ? (
                    <div className="mt-2 text-[11px] text-gray-500">
                      Finish every step and checklist item to unlock completion.
                    </div>
                  ) : null}
                  <div className="mt-3 border-t border-white/5 pt-3">
                    <button
                      type="button"
                      className="text-xs text-gray-400 hover:text-gray-200"
                      onClick={() => setSkipAheadOpen((open) => !open)}
                    >
                      <i className="fa-solid fa-forward mr-1"></i>
                      Skip ahead — generate from what I have
                    </button>
                    {skipAheadOpen ? (
                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        <span className="text-[11px] text-gray-500">
                          Artifacts are stronger with a completed session behind them.
                        </span>
                        <button
                          type="button"
                          className="btn btn-secondary px-3 py-1.5 text-xs"
                          onClick={() => queueArtifact("website")}
                          disabled={!projectId || busy !== null}
                        >
                          {busy === "website" ? "Generating..." : "Website"}
                        </button>
                        <button
                          type="button"
                          className="btn btn-secondary px-3 py-1.5 text-xs"
                          onClick={() => queueArtifact("pdf")}
                          disabled={!projectId || busy !== null}
                        >
                          {busy === "pdf" ? "Generating..." : "PDF"}
                        </button>
                        <button
                          type="button"
                          className="btn btn-secondary px-3 py-1.5 text-xs"
                          onClick={() => queueArtifact("pptx")}
                          disabled={!projectId || busy !== null}
                        >
                          {busy === "pptx" ? "Generating..." : "Deck"}
                        </button>
                      </div>
                    ) : null}
                  </div>
                </div>
              ) : (
                <div className="rounded-2xl border border-emerald-500/25 bg-emerald-500/10 p-4 text-sm leading-6 text-emerald-200">
                  {tutorCompletion?.verified.awarded
                    ? `Verified: ${tutorCompletion.verified.skill}. This module is backed by real proof.`
                    : "Session complete. Generate an artifact or attach proof to unlock the verified state."}
                  {!tutorCompletion?.verified.awarded ? (
                    <button
                      type="button"
                      className="btn btn-secondary ml-3 px-3 py-1.5 text-xs"
                      onClick={startTutorSessionUi}
                      disabled={!projectId || busy !== null}
                    >
                      Start Another Session
                    </button>
                  ) : null}
                </div>
              )}
            </div>
          )}
        </div>

        {status ? (
          <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200">
            {status}
          </div>
        ) : null}
        {error ? (
          <div className="rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-200">
            {error}
          </div>
        ) : null}
      </div>

      {/* ── Context + proof surfaces (no competing action systems) ─────────── */}
      <div className="grid xl:grid-cols-[1.2fr_0.95fr] gap-6">
        <div className="glass p-6 rounded-2xl border border-white/10 space-y-6">
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
                  <span className="text-sm text-gray-400">Use the tutor session to choose the lightest-weight tool stack for this build.</span>
                )}
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-white/10 bg-black/20 p-5">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <div className="text-xs font-semibold uppercase tracking-[0.2em] text-sky-300/80">Tool launchers</div>
                <p className="mt-2 text-sm text-gray-400">
                  Open the real tools that fit this pack. Where we support API-backed help, generate a ready-to-paste draft from the current step before you leave.
                </p>
              </div>
              <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] font-semibold text-gray-300">
                {guide.toolLaunches.length} launchers
              </span>
            </div>
            {/* Live E2E fix (2026-07-07 finding #5): fixed 2/3-column tracks
                squeezed these cards to one word per line inside the split
                workbench grid. auto-fill + minmax keeps every card at a
                readable minimum width and wraps the count instead. */}
            <div className="mt-4 grid gap-3 grid-cols-[repeat(auto-fill,minmax(230px,1fr))]">
              {guide.toolLaunches.map((tool) => {
                const connection = tool.platform ? oauthByPlatform.get(tool.platform) ?? null : null;
                const connected = Boolean(connection?.connected);
                const destination = tool.kind === "oauth" && !connected && tool.platform
                  ? oauthConnectHref(tool.platform)
                  : tool.href;
                const openLabel = tool.kind === "oauth" && !connected ? tool.ctaLabel : `Open ${tool.label}`;
                return (
                  <div
                    key={tool.key}
                    className="min-w-0 rounded-2xl border border-white/10 bg-white/5 p-4 hover:bg-white/10 transition"
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
                    <div className="mt-4 grid gap-2">
                      <a
                        href={destination}
                        target={tool.opensInNewTab ? "_blank" : undefined}
                        rel={tool.opensInNewTab ? "noreferrer" : undefined}
                        className="btn btn-secondary w-full justify-center text-xs"
                        data-analytics-event="project_tool_launcher_clicked"
                        data-analytics-location="projects_workbench"
                        data-analytics-tool_key={tool.key}
                        data-analytics-tool_kind={tool.kind}
                        data-analytics-connected={connected}
                        data-analytics-destination={destination}
                      >
                        {openLabel}
                      </a>
                      {tool.apiAction ? (
                        <button
                          type="button"
                          className="btn btn-primary w-full justify-center text-xs"
                          onClick={() => generateToolOutput(tool.key)}
                          disabled={!projectId || busy !== null}
                        >
                          {busy === "tool_action" && toolBusyKey === tool.key ? "Generating..." : tool.apiAction.label}
                        </button>
                      ) : null}
                    </div>
                  </div>
                );
              })}
            </div>
            {toolOutput ? (
              <div className="mt-5 rounded-2xl border border-sky-500/20 bg-sky-500/5 p-5">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <div className="text-xs font-semibold uppercase tracking-[0.2em] text-sky-300/80">Generated tool draft</div>
                    <h3 className="mt-2 text-lg font-medium text-white">{toolOutput.title}</h3>
                    {tutorCurrentStep ? (
                      <p className="mt-2 text-sm text-gray-400">Built for {tutorCurrentStep.title}.</p>
                    ) : null}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button type="button" className="btn btn-secondary text-xs px-3 py-1.5" onClick={() => void copyToolOutput()}>
                      {toolOutput.copyLabel}
                    </button>
                    {toolOutput.openUrl ? (
                      <a href={toolOutput.openUrl} className="btn btn-primary text-xs px-3 py-1.5" target="_blank" rel="noreferrer">
                        {toolOutput.openLabel || "Open tool"}
                      </a>
                    ) : null}
                  </div>
                </div>
                <pre className="mt-4 whitespace-pre-wrap rounded-2xl border border-white/10 bg-black/30 p-4 text-sm leading-6 text-gray-200">
                  {toolOutput.content}
                </pre>
                {toolCopyStatus ? (
                  <div className="mt-3 text-xs text-sky-200">{toolCopyStatus}</div>
                ) : null}
              </div>
            ) : null}
          </div>
        </div>

        <div className="space-y-6">
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
                No proof yet. Run the tutor session above — evidence you attach and the artifact it generates land here.
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
                  data-analytics-event="public_profile_clicked"
                  data-analytics-location="projects_workbench"
                  data-analytics-destination="/dashboard/profile/"
                >
                  <i className="fa-solid fa-user mr-2"></i> Go To Profile Settings
                </a>
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
