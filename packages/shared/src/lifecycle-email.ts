import { getCareerPath } from "./matrix";

export const EMAIL_PRODUCT_NAME = "AI Tutor";

export const LIFECYCLE_EMAIL_KEYS = [
  "welcome",
  "day_1_next_steps",
  "day_2_follow_up",
  "day_3_follow_up",
  "week_1_digest",
] as const;

export type LifecycleEmailKey = (typeof LIFECYCLE_EMAIL_KEYS)[number];

export type LifecycleAssessmentAnswer = {
  questionId: string;
  value: number;
};

export type LifecycleEmailAssessment = {
  score: number;
  answers: LifecycleAssessmentAnswer[];
  recommendedCareerPathIds: string[];
  startedAt?: string | null;
  submittedAt?: string | null;
};

export type LifecycleEmailModuleCta = {
  title: string;
  href: string;
  buttonLabel: string;
  helperText: string;
  stage?: "not_started" | "in_progress" | "ready_for_proof" | "proof_attached";
  projectTitle?: string | null;
  currentStepTitle?: string | null;
  completedStepCount?: number;
  totalStepCount?: number;
  artifactCount?: number;
};

export type LifecycleEmailNewsItem = {
  title: string;
  summary: string;
  url: string;
  source?: string | null;
  whyRelevant?: string | null;
  recommendedAction?: string | null;
};

export type LifecycleEmailSocialDraft = {
  platform: "linkedin" | "x";
  text: string;
};

export type LifecycleEmailProject = {
  title: string;
  url?: string | null;
  state?: string | null;
};

export type LifecycleEmailContext = {
  key: LifecycleEmailKey;
  baseUrl: string;
  learnerName: string;
  learnerHandle: string;
  careerPathName?: string | null;
  goals?: string[];
  dashboardUrl?: string;
  dashboardTrackingUrl?: string;
  publicProfileUrl?: string;
  publicProfileTrackingUrl?: string;
  assessment?: LifecycleEmailAssessment | null;
  moduleCta: LifecycleEmailModuleCta;
  project?: LifecycleEmailProject | null;
  newsItems?: LifecycleEmailNewsItem[];
  socialDrafts?: LifecycleEmailSocialDraft[];
};

export type LifecycleEmailTemplate = {
  key: LifecycleEmailKey;
  subject: string;
  previewText: string;
  html: string;
  text: string;
};

type LifecycleEmailCard = {
  title: string;
  paragraphs?: string[];
  items?: string[];
  snippets?: Array<{ label: string; text: string }>;
  cta?: { label: string; url: string };
};

type AssessmentState = "completed" | "abandoned" | "not_started";

function clampAnswerValue(input: number) {
  return Math.max(1, Math.min(5, Math.round(Number(input || 0))));
}

function formatScorePercent(score: number) {
  const normalized = Math.max(0, Math.min(1, Number(score || 0)));
  return Math.round(normalized * 100);
}

function formatShortDate(input?: string | null) {
  if (!input) return null;
  const value = new Date(input);
  if (Number.isNaN(value.getTime())) return null;
  return value.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

function escapeHtml(input: string) {
  return input
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function normalizeQuestionLabel(questionId: string) {
  switch (questionId) {
    case "career_experience":
      return "Career experience";
    case "ai_comfort":
      return "AI comfort";
    case "daily_work_complexity":
      return "Workflow complexity";
    case "linkedin_context":
      return "LinkedIn signal";
    case "resume_context":
      return "Resume signal";
    default:
      if (/^assessment_q_\d+$/i.test(questionId)) {
        return `Assessment signal ${questionId.split("_").pop()}`;
      }
      if (/^q_\d+$/i.test(questionId)) {
        return `Quiz signal ${questionId.split("_").pop()}`;
      }
      return questionId
        .replace(/[_-]+/g, " ")
        .replace(/\b\w/g, (char) => char.toUpperCase());
  }
}

function answerInsight(questionId: string, value: number) {
  const score = clampAnswerValue(value);
  switch (questionId) {
    case "career_experience":
      if (score >= 4) return "You already have enough domain depth to build practical proof quickly.";
      if (score === 3) return "You have enough role context to turn one focused workflow into proof this week.";
      return "Keep the first build narrow so the proof is visible fast.";
    case "ai_comfort":
      if (score >= 4) return "You can move straight into applied implementation without heavy theory overhead.";
      if (score === 3) return "You have enough familiarity to learn by shipping, not by collecting more tutorials.";
      return "Start with guided reps and one narrow workflow before expanding.";
    case "daily_work_complexity":
      if (score >= 4) return "Your day-to-day work has enough moving parts to justify workflow automation quickly.";
      if (score === 3) return "There is enough process complexity here to produce a concrete before and after story.";
      return "Pick one repeated task so the improvement is easy to measure.";
    case "linkedin_context":
      if (score >= 4) return "Your public profile context is strong enough to reuse when you package proof publicly.";
      return "Tightening your public positioning will make the proof easier to understand.";
    case "resume_context":
      if (score >= 4) return "Your resume context gives the tutor enough signal to tailor the first build.";
      return "Add more background signal so future recommendations can stay role-specific.";
    default:
      if (score >= 4) return "This answer suggests you can take a more aggressive build-first path.";
      if (score === 3) return "This answer suggests a balanced path: one guided build and one public proof step.";
      return "This answer suggests starting with a simpler workflow and clearer success criteria.";
  }
}

function summarizeAssessmentAnswers(answers: LifecycleAssessmentAnswer[]) {
  return answers.slice(0, 5).map((answer) => {
    const label = normalizeQuestionLabel(answer.questionId);
    const score = clampAnswerValue(answer.value);
    return `${label}: ${score}/5. ${answerInsight(answer.questionId, score)}`;
  });
}

function assessmentState(assessment?: LifecycleEmailAssessment | null): AssessmentState {
  if (!assessment) return "not_started";
  if (assessment.submittedAt) return "completed";
  if (assessment.startedAt) return "abandoned";
  return "not_started";
}

function readinessSummary(score: number) {
  const percent = formatScorePercent(score);
  if (percent >= 75) {
    return `${percent}/100 readiness. You are ready to learn by shipping visible output fast.`;
  }
  if (percent >= 45) {
    return `${percent}/100 readiness. You have enough baseline signal to build momentum with one focused workflow.`;
  }
  return `${percent}/100 readiness. Keep the first build small and concrete so your confidence compounds quickly.`;
}

function recommendedCareerPathNames(ids: string[]) {
  return ids
    .map((id) => getCareerPath(id)?.name ?? null)
    .filter((value): value is string => Boolean(value));
}

function normalizeBaseUrl(input: string) {
  return input.replace(/\/+$/, "");
}

function buildFallbackSocialDrafts(input: {
  learnerName: string;
  moduleTitle: string;
  targetUrl: string;
  project?: LifecycleEmailProject | null;
}) {
  const projectTitle = input.project?.title?.trim();
  const context = projectTitle || input.moduleTitle;
  const linkedin = [
    `I spent this week turning ${context} into visible proof instead of another private note.`,
    `The goal is simple: finish one concrete workflow, document what changed, and share the result publicly.`,
    input.targetUrl,
  ].join("\n\n");
  const x = `I am turning ${context} into visible proof this week. One concrete workflow, one artifact, one public write-up. ${input.targetUrl}`.slice(
    0,
    280,
  );

  return [
    { platform: "linkedin" as const, text: linkedin },
    { platform: "x" as const, text: x },
  ];
}

function moduleProgressSummary(moduleCta: LifecycleEmailModuleCta) {
  const completed = Math.max(0, Number(moduleCta.completedStepCount ?? 0));
  const total = Math.max(0, Number(moduleCta.totalStepCount ?? 0));
  if (!total) return null;
  if (moduleCta.stage === "ready_for_proof") {
    return `All ${total} steps are complete. The next move is attaching visible proof.`;
  }
  if (moduleCta.stage === "proof_attached") {
    return `${completed}/${total} steps are complete and proof is already attached. Tighten the story and publish it.`;
  }
  const currentStep = moduleCta.currentStepTitle?.trim();
  if (currentStep) {
    return `${completed}/${total} steps are complete. The current checkpoint is ${currentStep}.`;
  }
  return `${completed}/${total} steps are complete.`;
}

function moduleNextActionLine(moduleCta: LifecycleEmailModuleCta) {
  if (moduleCta.stage === "ready_for_proof") {
    return `Open ${moduleCta.title}, attach the first proof link or file, and make the work visible.`;
  }
  if (moduleCta.stage === "proof_attached") {
    return `Open ${moduleCta.title}, tighten the proof story, and reuse it publicly.`;
  }
  if (moduleCta.currentStepTitle?.trim()) {
    return `Open ${moduleCta.title} and focus on ${moduleCta.currentStepTitle}.`;
  }
  return `Open ${moduleCta.title}, complete one checkpoint, and turn it into a concrete artifact or build log update today.`;
}

function composeIntro(input: LifecycleEmailContext, state: AssessmentState) {
  switch (input.key) {
    case "welcome":
      return "Your workspace is live. This week is about finishing the assessment, starting the right module, and turning that work into visible proof.";
    case "day_1_next_steps":
      return state === "completed"
        ? "You have enough signal to move from quiz answers into concrete execution today."
        : "This is the right moment to finish the assessment so your next steps stop being generic.";
    case "day_2_follow_up":
      return state === "completed"
        ? "Day two should translate your quiz signals into one focused build step."
        : "You do not need more browsing time. You need the assessment finished so the plan can tighten around your real context.";
    case "day_3_follow_up":
      return state === "completed"
        ? "By day three, your answers should already be turning into a visible work sample."
        : "Three days in, the fastest way forward is still the same: finish the quiz and unlock a role-specific module path.";
    case "week_1_digest":
      return "One week in. Here is your progress pulse, draft social copy, relevant AI news, and the clearest next module CTA.";
  }
}

function buildCards(input: LifecycleEmailContext, state: AssessmentState) {
  const dashboardUrl = input.dashboardUrl ?? `${normalizeBaseUrl(input.baseUrl)}/dashboard/`;
  const dashboardTrackingUrl = input.dashboardTrackingUrl ?? dashboardUrl;
  const publicProfileUrl = input.publicProfileUrl ?? `${normalizeBaseUrl(input.baseUrl)}/u/${input.learnerHandle}`;
  const publicProfileTrackingUrl = input.publicProfileTrackingUrl ?? publicProfileUrl;
  const answerFeedback = summarizeAssessmentAnswers(input.assessment?.answers ?? []);
  const recommendedPaths = recommendedCareerPathNames(input.assessment?.recommendedCareerPathIds ?? []);
  const goals = (input.goals ?? []).map((goal) => goal.replace(/_/g, " "));
  const assessmentStartedDate = formatShortDate(input.assessment?.startedAt);
  const targetUrl = input.project?.url || publicProfileUrl;
  const weeklySocialDrafts =
    input.socialDrafts?.length
      ? input.socialDrafts.slice(0, 2)
      : buildFallbackSocialDrafts({
          learnerName: input.learnerName,
          moduleTitle: input.moduleCta.title,
          targetUrl,
          project: input.project,
        });

  const weeklyNewsItems =
    input.newsItems?.slice(0, 3).map((entry) => {
      const parts = [entry.title];
      if (entry.whyRelevant) parts.push(entry.whyRelevant);
      else if (entry.summary) parts.push(entry.summary);
      if (entry.recommendedAction) parts.push(`Action: ${entry.recommendedAction}`);
      if (entry.source) parts.push(`Source: ${entry.source}`);
      parts.push(entry.url);
      return parts.join(" ");
    }) ?? [];

  switch (input.key) {
    case "welcome":
      return [
        {
          title: "What you will get in week one",
          paragraphs: [
            "The email cadence is simple: a full welcome now, next-step nudges on days 1, 2, and 3, then a week-one digest with social drafts, AI news, and your current module CTA.",
          ],
          items: [
            "Welcome: orient the workspace and clarify the first move.",
            "Day 1: turn quiz signals into a concrete next step.",
            "Day 2: tighten the plan around one workflow.",
            "Day 3: push toward shipped public proof.",
            "Week 1: send social drafts, relevant AI news, and a progress CTA.",
          ],
        },
        {
          title: "Best next move",
          paragraphs: [
            state === "completed"
              ? `Your assessment is already complete. Move straight into ${input.moduleCta.title}.`
              : "Finish the assessment first so the tutor can turn your current role signal into a specific module path and project direction.",
            input.moduleCta.helperText,
            moduleProgressSummary(input.moduleCta) ?? "The first visible checkpoint should happen inside the module, not in private notes.",
          ],
          cta: {
            label: input.moduleCta.buttonLabel,
            url: input.moduleCta.href,
          },
          },
        {
          title: "Your workspace links",
          items: [`Dashboard: ${dashboardTrackingUrl}`, `Public profile: ${publicProfileTrackingUrl}`],
        },
      ] satisfies LifecycleEmailCard[];
    case "day_1_next_steps":
      if (state === "completed") {
        return [
          {
            title: "Your quiz results",
            paragraphs: [readinessSummary(input.assessment?.score ?? 0)],
            items: answerFeedback.length ? answerFeedback : ["Your score is in. Start with the module below and use the first artifact as your proof anchor."],
          },
          {
            title: "Recommended paths",
            paragraphs: [
              recommendedPaths.length
                ? `Your strongest path matches are ${recommendedPaths.join(", ")}.`
                : `Your primary path is ${input.careerPathName ?? "your current track"}.`,
            ],
            items: goals.length ? goals.map((goal) => `Goal signal: ${goal}`) : undefined,
          },
          {
            title: "Do this next",
            paragraphs: [
              moduleNextActionLine(input.moduleCta),
              input.moduleCta.helperText,
            ],
            cta: {
              label: input.moduleCta.buttonLabel,
              url: input.moduleCta.href,
            },
          },
        ] satisfies LifecycleEmailCard[];
      }

      return [
        {
          title: "Finish the assessment",
          paragraphs: [
            state === "abandoned" && assessmentStartedDate
              ? `You started the assessment on ${assessmentStartedDate} but did not submit it.`
              : "You have not completed the assessment yet.",
            "That quiz is what lets the tutor map your role context, goals, and workflow complexity into the right first module.",
          ],
          items: [
            "Unlock a role-specific module path.",
            "Get a clearer first project direction.",
            "Receive result-based follow-up emails instead of generic nudges.",
          ],
          cta: {
            label: "Finish Assessment",
            url: dashboardTrackingUrl,
          },
        },
      ] satisfies LifecycleEmailCard[];
    case "day_2_follow_up":
      if (state === "completed") {
        return [
          {
            title: "Turn the quiz into shipped proof",
            paragraphs: [
              `Day two is about translation: use ${input.moduleCta.title} to produce one visible output, not just more planning.`,
              moduleProgressSummary(input.moduleCta) ?? input.moduleCta.helperText,
            ],
            items: [
              moduleNextActionLine(input.moduleCta),
              "Document what changed before and after AI support.",
              input.moduleCta.stage === "proof_attached"
                ? "Reuse the finished proof in your dashboard, profile, or public updates."
                : "Publish the result to your dashboard and public profile.",
            ],
            cta: {
              label: input.moduleCta.buttonLabel,
              url: input.moduleCta.href,
            },
          },
          {
            title: "Signals worth keeping in view",
            items: answerFeedback.slice(0, 3),
          },
        ] satisfies LifecycleEmailCard[];
      }

      return [
        {
          title: "Your plan is still waiting on the quiz",
          paragraphs: [
            "Without the assessment, the tutor cannot tighten the module recommendation or the project direction around your actual role signal.",
            state === "abandoned"
              ? "Pick up where you left off and submit it in one pass."
              : "Set aside ten focused minutes and complete it in one pass.",
          ],
          items: [
            "Get a clearer module recommendation.",
            "Unlock better follow-up guidance.",
            "Start building with more specific context.",
          ],
          cta: {
            label: "Complete Quiz",
            url: dashboardTrackingUrl,
          },
        },
      ] satisfies LifecycleEmailCard[];
    case "day_3_follow_up":
      if (state === "completed") {
        return [
          {
            title: "By now, your answers should be turning into a proof story",
            paragraphs: [
              input.project?.title
                ? `The clearest next move is to keep pushing ${input.project.title} and connect it back to the quiz signals that made it the right build.`
                : `If you have not started a project yet, use ${input.moduleCta.title} to create the first visible work sample now.`,
              moduleProgressSummary(input.moduleCta) ?? input.moduleCta.helperText,
            ],
            items: [
              "State the workflow you improved.",
              "Show what AI changed in the output or speed.",
              input.moduleCta.stage === "ready_for_proof"
                ? "Attach the proof so the completed checklist turns into visible evidence."
                : "Capture the result in your build log or profile.",
            ],
            cta: {
              label: input.moduleCta.buttonLabel,
              url: input.moduleCta.href,
            },
          },
          {
            title: "Talking points to reuse publicly",
            items: [
              "What problem were you solving?",
              "What did the AI system automate or accelerate?",
              "What would you improve in the next pass?",
            ],
          },
        ] satisfies LifecycleEmailCard[];
      }

      return [
        {
          title: "Three days in, the highest-leverage move is still the quiz",
          paragraphs: [
            "If the assessment stays unfinished, the tutor has to guess instead of working from your actual signal.",
            "Finish it now, then move directly into the first module while the context is fresh.",
          ],
          items: [
            "Assessment first.",
            `Then start ${input.moduleCta.title}.`,
            "Then capture one visible proof step.",
          ],
          cta: {
            label: "Finish Assessment",
            url: dashboardTrackingUrl,
          },
        },
      ] satisfies LifecycleEmailCard[];
    case "week_1_digest":
      return [
        {
          title: "Week 1 momentum",
          paragraphs: [
            input.project?.title
              ? `Your current build is ${input.project.title}. Keep pushing it until the output is public and inspectable.`
              : `Your clearest next module is ${input.moduleCta.title}. Use it to produce the first visible work sample this week.`,
            input.moduleCta.helperText,
            moduleProgressSummary(input.moduleCta) ?? "No checklist progress was available at send time.",
          ],
          items: [
            recommendedPaths.length
              ? `Recommended path signal: ${recommendedPaths.join(", ")}`
              : `Career path: ${input.careerPathName ?? "Current learner track"}`,
            goals.length ? `Current goals: ${goals.join(", ")}` : "Current goals: keep building visible proof.",
          ],
          cta: {
            label: input.moduleCta.buttonLabel,
            url: input.moduleCta.href,
          },
        },
        {
          title: "Draft social posts",
          paragraphs: [
            "Use these as starting points. Tighten the wording around your actual artifact before you publish.",
          ],
          snippets: weeklySocialDrafts.map((draft) => ({
            label: draft.platform === "linkedin" ? "LinkedIn draft" : "X draft",
            text: draft.text,
          })),
        },
        {
          title: "AI news worth watching",
          items: weeklyNewsItems.length
            ? weeklyNewsItems
            : ["No fresh personalized news was available at send time. Open your dashboard to refresh the latest AI signal set."],
        },
      ] satisfies LifecycleEmailCard[];
  }
}

function stageSubject(input: LifecycleEmailContext, state: AssessmentState) {
  switch (input.key) {
    case "welcome":
      return `Welcome to ${EMAIL_PRODUCT_NAME}, ${input.learnerName}`;
    case "day_1_next_steps":
      return state === "completed"
        ? `Your quiz results and first step inside ${EMAIL_PRODUCT_NAME}`
        : `Finish your ${EMAIL_PRODUCT_NAME} assessment`;
    case "day_2_follow_up":
      return state === "completed"
        ? `Day 2 plan: turn your results into shipped proof`
        : `Your personalized plan is waiting on the quiz`;
    case "day_3_follow_up":
      return state === "completed"
        ? `Day 3: turn your answers into visible proof`
        : `Three days in: complete the quiz and unlock the path`;
    case "week_1_digest":
      return `Week 1 digest: social drafts, AI news, and your next module`;
  }
}

function stagePreviewText(input: LifecycleEmailContext, state: AssessmentState) {
  switch (input.key) {
    case "welcome":
      return "Your workspace is ready, your first-week cadence is set, and the next move is clear.";
    case "day_1_next_steps":
      return state === "completed"
        ? "Your quiz signals are in. Start the right module and ship the first proof step."
        : "Complete the assessment so the tutor can stop guessing and start personalizing.";
    case "day_2_follow_up":
      return state === "completed"
        ? "Move from result summary into one focused workflow build."
        : "Finish the quiz and unlock a tighter plan.";
    case "day_3_follow_up":
      return state === "completed"
        ? "Convert your answers into a project, artifact, or public proof update."
        : "Finish the quiz, then move straight into the first module.";
    case "week_1_digest":
      return "Your week-one digest includes drafts, AI news, and a clear CTA.";
  }
}

function renderHtmlTemplate(input: {
  learnerName: string;
  previewText: string;
  intro: string;
  cards: LifecycleEmailCard[];
  footerLinks: Array<{ label: string; url: string }>;
}) {
  const cardsHtml = input.cards
    .map((card) => {
      const paragraphs = (card.paragraphs ?? [])
        .map((paragraph) => `<p style="margin:0 0 12px;color:#475569;line-height:1.7;">${escapeHtml(paragraph)}</p>`)
        .join("");
      const items = (card.items ?? []).length
        ? `<ul style="margin:0;padding-left:18px;color:#334155;line-height:1.7;">${(card.items ?? [])
            .map((item) => `<li style="margin:0 0 8px;">${escapeHtml(item)}</li>`)
            .join("")}</ul>`
        : "";
      const snippets = (card.snippets ?? [])
        .map(
          (snippet) => `
            <div style="margin:0 0 12px;">
              <div style="margin:0 0 6px;font-size:12px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:#0f766e;">${escapeHtml(snippet.label)}</div>
              <div style="white-space:pre-wrap;background:#0f172a;color:#e2e8f0;border-radius:12px;padding:14px 16px;font-size:14px;line-height:1.6;">${escapeHtml(snippet.text)}</div>
            </div>
          `,
        )
        .join("");
      const cta = card.cta
        ? `<div style="margin-top:16px;"><a href="${escapeHtml(card.cta.url)}" style="display:inline-block;background:#0f766e;color:#ffffff;padding:11px 16px;border-radius:10px;text-decoration:none;font-weight:700;">${escapeHtml(card.cta.label)}</a></div>`
        : "";

      return `
        <section style="margin:0 0 16px;background:#ffffff;border:1px solid #e2e8f0;border-radius:16px;padding:22px;">
          <h2 style="margin:0 0 12px;font-size:18px;line-height:1.3;color:#0f172a;">${escapeHtml(card.title)}</h2>
          ${paragraphs}
          ${items}
          ${snippets}
          ${cta}
        </section>
      `;
    })
    .join("");

  const footerLinks = input.footerLinks
    .map((link) => `<a href="${escapeHtml(link.url)}" style="color:#0f766e;text-decoration:none;">${escapeHtml(link.label)}</a>`)
    .join(" &middot; ");

  return `
    <div style="display:none;max-height:0;overflow:hidden;opacity:0;">${escapeHtml(input.previewText)}</div>
    <div style="font-family:Inter,Arial,sans-serif;background:#f8fafc;padding:24px;color:#0f172a;">
      <div style="max-width:680px;margin:0 auto;">
        <div style="background:#ffffff;border:1px solid #dbe4ee;border-radius:20px;padding:24px;">
          <div style="display:flex;align-items:center;gap:12px;margin:0 0 18px;padding-bottom:14px;border-bottom:1px solid #e2e8f0;">
            <span style="display:inline-flex;align-items:center;justify-content:center;width:32px;height:32px;border-radius:10px;background:#0f766e;color:#ffffff;font-size:14px;font-weight:800;">AI</span>
            <span style="font-size:16px;font-weight:800;letter-spacing:0.02em;color:#0f172a;">${EMAIL_PRODUCT_NAME}</span>
          </div>
          <h1 style="margin:0 0 12px;font-size:28px;line-height:1.2;">${escapeHtml(input.learnerName)}, here is your next move.</h1>
          <p style="margin:0 0 20px;color:#475569;line-height:1.75;">${escapeHtml(input.intro)}</p>
        </div>
        <div style="height:16px;"></div>
        ${cardsHtml}
        <p style="margin:18px 0 0;text-align:center;color:#64748b;font-size:13px;line-height:1.6;">
          ${footerLinks}<br />
          You are receiving this because you created an ${EMAIL_PRODUCT_NAME} workspace.
        </p>
      </div>
    </div>
  `.trim();
}

function renderTextTemplate(input: {
  learnerName: string;
  intro: string;
  cards: LifecycleEmailCard[];
  footerLinks: Array<{ label: string; url: string }>;
}) {
  const sections = input.cards
    .map((card) => {
      const paragraphs = (card.paragraphs ?? []).join("\n");
      const items = (card.items ?? []).map((item) => `- ${item}`).join("\n");
      const snippets = (card.snippets ?? [])
        .map((snippet) => `${snippet.label}:\n${snippet.text}`)
        .join("\n\n");
      const cta = card.cta ? `\n${card.cta.label}: ${card.cta.url}` : "";

      return [card.title, paragraphs, items, snippets].filter(Boolean).join("\n") + cta;
    })
    .join("\n\n");

  const footer = input.footerLinks.map((link) => `${link.label}: ${link.url}`).join("\n");

  return [`${input.learnerName}, here is your next move.`, input.intro, sections, footer].filter(Boolean).join("\n\n");
}

export function resolveLifecycleEmailKey(input: {
  anchorIso?: string | null;
  nowIso?: string;
  sentKeys: LifecycleEmailKey[];
}) {
  const sent = new Set(input.sentKeys);
  if (!sent.has("welcome")) return "welcome";
  if (!input.anchorIso) return null;

  const anchor = new Date(input.anchorIso);
  if (Number.isNaN(anchor.getTime())) return null;

  const now = input.nowIso ? new Date(input.nowIso) : new Date();
  const ageHours = (now.getTime() - anchor.getTime()) / (1000 * 60 * 60);

  if (ageHours >= 24 * 7 && !sent.has("week_1_digest")) return "week_1_digest";
  if (ageHours >= 72 && ageHours < 24 * 7 && !sent.has("day_3_follow_up")) return "day_3_follow_up";
  if (ageHours >= 48 && ageHours < 96 && !sent.has("day_2_follow_up")) return "day_2_follow_up";
  if (ageHours >= 24 && ageHours < 72 && !sent.has("day_1_next_steps")) return "day_1_next_steps";

  return null;
}

export function buildLifecycleEmail(input: LifecycleEmailContext): LifecycleEmailTemplate {
  const state = assessmentState(input.assessment);
  const subject = stageSubject(input, state);
  const previewText = stagePreviewText(input, state);
  const intro = composeIntro(input, state);
  const cards = buildCards(input, state);
  const dashboardUrl = input.dashboardUrl ?? `${normalizeBaseUrl(input.baseUrl)}/dashboard/`;
  const dashboardTrackingUrl = input.dashboardTrackingUrl ?? dashboardUrl;
  const publicProfileUrl = input.publicProfileUrl ?? `${normalizeBaseUrl(input.baseUrl)}/u/${input.learnerHandle}`;
  const publicProfileTrackingUrl = input.publicProfileTrackingUrl ?? publicProfileUrl;
  const footerLinks = [
    { label: "Dashboard", url: dashboardTrackingUrl },
    { label: "Public profile", url: publicProfileTrackingUrl },
  ];

  return {
    key: input.key,
    subject,
    previewText,
    html: renderHtmlTemplate({
      learnerName: input.learnerName,
      previewText,
      intro,
      cards,
      footerLinks,
    }),
    text: renderTextTemplate({
      learnerName: input.learnerName,
      intro,
      cards,
      footerLinks,
    }),
  };
}
