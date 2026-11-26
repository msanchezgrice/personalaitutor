import React from "react";
import { EXAMPLE_CAREER_MAP, VOICE_MODEL_METHOD_LABEL, getCareerMapTitle } from "@aitutor/shared";
import type { ProofSitePageData } from "@/components/proof/site-page";
import styles from "./site-page.module.css";

/**
 * The static example proof page at /u/maya-ortiz. Maya Ortiz and Kiteborne
 * Games are fictional (the launch-film example); every surface that shows
 * her says "Example". Built from EXAMPLE_CAREER_MAP so it matches the map the
 * landing page and /map show for the same résumé.
 */

export const EXAMPLE_PROOF_SITE_HANDLE = "maya-ortiz";

export const EXAMPLE_PROOF_SITE_FOOTER =
  "This is an example profile. Maya Ortiz and Kiteborne Games are fictional. A real page is written and published by its owner, with the site, the voice model and the build log built in My AI Skill Tutor.";

export function exampleProofSiteData(): ProofSitePageData {
  const map = EXAMPLE_CAREER_MAP;
  const newTitle = getCareerMapTitle(map.primary.titleId)?.title ?? "Go-to-Market Engineer";
  return {
    handle: EXAMPLE_PROOF_SITE_HANDLE,
    name: map.person.displayName ?? "Maya Ortiz",
    newTitle,
    previousRole: `${map.person.previousTitle} at Kiteborne Games, 2018 to 2025`,
    tagline: "I turn launch plans into AI workflows, player emails into brand-voice prompts, and communities into agents.",
    bio: "I spent seven years in games publishing: launches, lifecycle email, community and paid campaigns. Now I build the automated workflows a go-to-market team runs on, and I write up each one here as I build it.",
    translations: map.translations.slice(0, 3).map((row) => ({ before: row.before, now: row.now })),
    contactEmail: "maya@example.com",
    linkedinUrl: null,
    built: [
      {
        title: "Launch-day agent workflow",
        description: "One brief goes in. Store copy, patch notes and three email variants come out for review. Built in n8n with a human approval step.",
        href: null,
        flow: true,
        steps: [{ label: "Brief" }, { label: "Agent drafts" }, { label: "Maya reviews", highlight: true }],
      },
    ],
  };
}

export const EXAMPLE_VOICE_MODEL = {
  name: "maya-voice-v1",
  baseModel: "gpt-4.1-mini",
  methodLabel: VOICE_MODEL_METHOD_LABEL,
  samples: "24 launch emails",
  updated: "Nov 18, 2026",
  task: "Announce that Season 4 starts Friday",
  baseOutput: "Exciting update coming soon! Season 4 arrives this Friday with new content.",
  tunedOutput: "Squad up. Season 4 drops Friday.",
} as const;

export const EXAMPLE_BUILD_LOG = [
  { date: "Week 3 · Nov 16", title: "I turned our launch checklist into one agent workflow" },
  { date: "Week 2 · Nov 9", title: "24 emails later, the model stopped saying “exciting”" },
  { date: "Week 1 · Nov 2", title: "My studio closed. Here is the map I'm following" },
] as const;

/** Static "Try my model" section: a saved comparison, no live runs on the example page. */
export function ExampleVoiceModelSection() {
  const model = EXAMPLE_VOICE_MODEL;
  return (
    <section className="rm-band" aria-labelledby="example-model-heading" data-testid="example-voice-model">
      <div className={`rm-container rm-container--narrow ${styles.modelBand}`}>
        <div className="rm-stack" style={{ gap: 8 }}>
          <h2 id="example-model-heading" className={styles.h2}>
            Try my model
          </h2>
          <p className="rm-p" style={{ maxWidth: "42em" }}>
            {model.name} writes game announcements the way I do. On a real page you give it a task and compare it with the untuned model. On this example page the outputs below are fixed.
          </p>
        </div>
        <div className={styles.modelLayout}>
          <div className={styles.modelMain}>
            <div className="rm-stack" style={{ gap: 6 }}>
              <span className="rm-label" style={{ marginBottom: 0 }}>
                Example task
              </span>
              <p className={styles.taskBox}>{model.task}</p>
            </div>
            <div className={styles.outputs}>
              <div className={styles.outputBase}>
                <span className={styles.outputLabel}>Base model</span>
                <span className={styles.outputBaseText}>{model.baseOutput}</span>
              </div>
              <div className={styles.outputTuned}>
                <span className={styles.outputLabel}>{model.name}</span>
                <span className={styles.outputTunedText}>{model.tunedOutput}</span>
              </div>
            </div>
          </div>
          <dl className={styles.modelCard} aria-label="Model card">
            <div>
              <dt>Base model</dt>
              <dd>{model.baseModel}</dd>
            </div>
            <div>
              <dt>How it was tuned</dt>
              <dd>{model.methodLabel}</dd>
            </div>
            <div>
              <dt>Samples</dt>
              <dd>{model.samples}</dd>
            </div>
            <div>
              <dt>Updated</dt>
              <dd>{model.updated}</dd>
            </div>
          </dl>
        </div>
      </div>
    </section>
  );
}

/** Static build log list: titles only, no links (the example has no post pages). */
export function ExampleBuildLogSection() {
  return (
    <section className={`rm-container rm-container--narrow ${styles.logSection}`} aria-labelledby="example-log-heading" data-testid="example-build-log">
      <h2 id="example-log-heading" className={styles.h2}>
        Build log
      </h2>
      <ul className={styles.logList}>
        {EXAMPLE_BUILD_LOG.map((post) => (
          <li key={post.title} className={styles.logItem}>
            <span className={styles.logDate}>{post.date}</span>
            <span className={styles.logTitle}>{post.title}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
