import type { Metadata } from "next";
import { resolveLearnerRoleLabel, type VoiceModelSample } from "@aitutor/shared";
import { DashboardShell } from "@/components/dashboard-runtime-shell";
import { VoiceModelStudio } from "@/components/proof/voice-model-studio";
import { buildDashboardRuntimeBootstrap, getDashboardServerState } from "@/app/dashboard/_lib";
import { loadVoiceModelPrefill } from "@/lib/voice-model/prefill";
import { listVoiceModelSamples, listVoiceModelsForProfile } from "@/lib/voice-model/store";

export const metadata: Metadata = {
  title: "Voice model | Proof Studio",
  robots: { index: false, follow: false },
};

/** Proof Studio: the learner's voice model (tuned in context on their own writing). */
export default async function DashboardProofModelPage() {
  const state = await getDashboardServerState();
  const user = state.user;
  const learnerProfileId = user?.id ?? null;

  const models = learnerProfileId ? await listVoiceModelsForProfile(learnerProfileId) : [];
  const sampleLists = await Promise.all(models.map((model) => listVoiceModelSamples(model.id)));
  const initialSamples: Record<string, VoiceModelSample[]> = {};
  models.forEach((model, index) => {
    initialSamples[model.id] = sampleLists[index] ?? [];
  });
  const prefill = learnerProfileId && models.length === 0 ? await loadVoiceModelPrefill(learnerProfileId) : null;

  return (
    <DashboardShell
      activeTab="proof"
      headerTitle="Voice model"
      headerSubtitle="Proof Studio · a model tuned on your own writing"
      operatorToolsHref={state.operatorToolsUrl}
      billingPortalEnabled={Boolean(state.billing.subscription)}
      runtimeBootstrap={buildDashboardRuntimeBootstrap(state)}
      initialUser={{
        name: user?.name ?? state.seed?.name ?? "Learner",
        headline: resolveLearnerRoleLabel({ headline: user?.headline, careerPathId: user?.careerPathId }),
        avatarUrl: user?.avatarUrl ?? state.seed?.avatarUrl ?? null,
        publicProfileUrl: state.publicProfileUrl,
        levelLabel: state.sidebarLevel.label,
        levelSubtitle: state.sidebarLevel.subtitle,
        levelProgressPct: state.sidebarLevel.progressPct,
        levelProgressText: state.sidebarLevel.progressText,
      }}
    >
      <div className="rm" style={{ minHeight: 0, background: "transparent" }}>
        <p style={{ margin: 0, padding: "16px clamp(16px, 3vw, 32px) 0", maxWidth: 1040, marginInline: "auto" }}>
          <a href="/dashboard/proof">← Proof Studio</a>
        </p>
        {learnerProfileId ? (
          <VoiceModelStudio
            initialModels={models}
            initialSamples={initialSamples}
            prefill={prefill}
            handle={user?.handle ?? ""}
            profilePublished={Boolean(user?.published)}
          />
        ) : (
          <p className="rm-alert" style={{ margin: 32 }}>
            Sign in to build your voice model.
          </p>
        )}
      </div>
    </DashboardShell>
  );
}
