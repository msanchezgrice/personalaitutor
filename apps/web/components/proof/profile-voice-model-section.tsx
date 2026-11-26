import React from "react";
import { VOICE_MODEL_METHOD_LABEL, type VoiceModelPublic } from "@aitutor/shared";
import { formatVoiceModelDate, formatVoiceModelSamples } from "@/lib/voice-model/format";
import { listPublishedVoiceModels } from "@/lib/voice-model/store";
import { VoiceModelTry } from "./voice-model-try";
import styles from "./voice-model.module.css";

/**
 * "Try my model" on the public profile page (/u/{handle}). Server component:
 * loads the learner's published, tuned models and renders one block per model
 * with a client "try it" island and the model card. Returns null when there is
 * nothing published. The page around it is responsible for only rendering it
 * on published profiles, inside the `.rm` wrapper.
 */
export async function ProfileVoiceModelSection(props: { learnerProfileId: string; handle: string; displayName: string }) {
  let models: VoiceModelPublic[];
  try {
    models = await listPublishedVoiceModels(props.learnerProfileId);
  } catch {
    // A store failure hides this section; it must not take the profile page down.
    return null;
  }
  if (models.length === 0) return null;

  return (
    <section className={`rm-band ${styles.section}`} aria-labelledby="voice-model-heading" data-testid="profile-voice-model">
      <div className={`rm-container rm-container--narrow ${styles.inner}`}>
        <h2 id="voice-model-heading" className={styles.title}>
          {models.length === 1 ? "Try my model" : "Try my models"}
        </h2>
        {models.map((model) => (
          <VoiceModelBlock key={model.slug} model={model} handle={props.handle} displayName={props.displayName} />
        ))}
      </div>
    </section>
  );
}

function VoiceModelBlock({ model, handle, displayName }: { model: VoiceModelPublic; handle: string; displayName: string }) {
  const tuned = formatVoiceModelDate(model.tunedAt);
  return (
    <div className={`${styles.model} rm-stack`} id={`model-${model.slug}`} style={{ gap: 24 }}>
      <p className={styles.introText}>
        {model.name} writes {model.purpose} the way I do. Give it a task and compare it with the untuned model.
      </p>
      <div className={styles.layout}>
        <VoiceModelTry
          handle={handle}
          slug={model.slug}
          modelName={model.name}
          demoPrompt={model.demoPrompt}
          demoBaseOutput={model.demoBaseOutput}
          demoTunedOutput={model.demoTunedOutput}
        />
        <div className={styles.cardWrap}>
          <dl className={styles.cardList} aria-label={`Model card for ${model.name} by ${displayName}`}>
            <div className={styles.cardRow}>
              <dt className={styles.cardTerm}>Base model</dt>
              <dd className={styles.cardValue}>{model.baseModel ?? "Not recorded"}</dd>
            </div>
            <div className={styles.cardRow}>
              <dt className={styles.cardTerm}>How it was tuned</dt>
              <dd className={styles.cardValue}>{model.methodLabel || VOICE_MODEL_METHOD_LABEL}</dd>
            </div>
            <div className={styles.cardRow}>
              <dt className={styles.cardTerm}>Samples</dt>
              <dd className={styles.cardValue}>{formatVoiceModelSamples(model.sampleCount, model.sampleType)}</dd>
            </div>
            {tuned ? (
              <div className={styles.cardRow}>
                <dt className={styles.cardTerm}>Updated</dt>
                <dd className={styles.cardValue}>
                  <time dateTime={model.tunedAt ?? undefined}>{tuned}</time>
                </dd>
              </div>
            ) : null}
          </dl>
          <p className={styles.cardNote}>
            Not fine-tuned: each run gives the base model a profile of how I write and examples of my writing.
            Visitors never see the samples.
          </p>
        </div>
      </div>
    </div>
  );
}
