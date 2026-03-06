import { CAREER_PATHS } from "@aitutor/shared";
import type { GoalType, SituationStatus } from "@aitutor/shared";

export type CareerPathId = (typeof CAREER_PATHS)[number]["id"];
export type YearsExperience = "0-1" | "1-3" | "3-5" | "5-10" | "10+";
export type CompanySize = "startup" | "small" | "medium" | "large";

export type RequiredNoteField =
  | "fullName"
  | "jobTitle"
  | "careerPathId"
  | "yearsExperience"
  | "situation"
  | "dailyWorkSummary"
  | "keySkills"
  | "selectedGoals"
  | "aiComfort";

export type OnboardingNotes = {
  summary: string;
  fullName: string;
  jobTitle: string;
  careerPathId: CareerPathId | "";
  careerCategoryLabel: string;
  yearsExperience: YearsExperience | "";
  companySize: CompanySize | "";
  situation: SituationStatus | "";
  dailyWorkSummary: string;
  keySkills: string[];
  selectedGoals: GoalType[];
  aiComfort: number | null;
  linkedinUrl: string;
  resumeFilename: string;
};

export type RealtimeOnboardingUpdate = Partial<OnboardingNotes> & {
  needsFollowup?: RequiredNoteField[];
};

export type TranscriptSpeaker = "assistant" | "user" | "system";

export type TranscriptEntry = {
  id: string;
  speaker: TranscriptSpeaker;
  text: string;
  timestamp: number;
};

export type LearningPlanMilestone = {
  window: string;
  title: string;
  detail: string;
};

export type LearningPlanPreview = {
  assessmentScore: number;
  primaryPath: (typeof CAREER_PATHS)[number];
  supportingPaths: Array<(typeof CAREER_PATHS)[number]>;
  toolStack: string[];
  focusModules: string[];
  projectIdea: string;
  proofArtifacts: string[];
  milestones: LearningPlanMilestone[];
  guideLinks: Array<{ label: string; href: string }>;
};

export const EXPERIENCE_LABELS: Record<YearsExperience, string> = {
  "0-1": "Less than 1 year",
  "1-3": "1-3 years",
  "3-5": "3-5 years",
  "5-10": "5-10 years",
  "10+": "10+ years",
};

export const COMPANY_SIZE_LABELS: Record<CompanySize, string> = {
  startup: "Startup (1-50)",
  small: "Small (51-200)",
  medium: "Medium (201-1000)",
  large: "Large (1000+)",
};

export const SITUATION_LABELS: Record<SituationStatus, string> = {
  employed: "Employed",
  unemployed: "Unemployed",
  student: "Student",
  founder: "Founder",
  freelancer: "Freelancer",
  career_switcher: "Career switcher",
};

export const GOAL_LABELS: Record<GoalType, string> = {
  build_business: "Build a business",
  upskill_current_job: "Upskill for current job",
  showcase_for_job: "Showcase skills for a new role",
  learn_foundations: "Learn foundations",
  ship_ai_projects: "Ship AI projects",
};

export const REQUIRED_NOTE_FIELDS: RequiredNoteField[] = [
  "fullName",
  "jobTitle",
  "careerPathId",
  "yearsExperience",
  "situation",
  "dailyWorkSummary",
  "keySkills",
  "selectedGoals",
  "aiComfort",
];

export const REQUIRED_NOTE_LABELS: Record<RequiredNoteField, string> = {
  fullName: "Name",
  jobTitle: "Role",
  careerPathId: "Learning track",
  yearsExperience: "Experience",
  situation: "Situation",
  dailyWorkSummary: "Work summary",
  keySkills: "Tools and skills",
  selectedGoals: "Goals",
  aiComfort: "AI comfort",
};

export const REQUIRED_NOTE_PROMPTS: Record<RequiredNoteField, { title: string; detail: string }> = {
  fullName: {
    title: "Lock the learner identity",
    detail: "Ask for the person's full name so the plan and session can be attached cleanly.",
  },
  jobTitle: {
    title: "Clarify the current role",
    detail: "Get the exact job title or responsibility anchor before you map the plan.",
  },
  careerPathId: {
    title: "Choose the learning track",
    detail: "Map the conversation to the best-fit path so the first modules are correct.",
  },
  yearsExperience: {
    title: "Size the experience band",
    detail: "Capture the range from 0-1 through 10+ so the plan can calibrate pace.",
  },
  situation: {
    title: "Understand the current situation",
    detail: "Confirm whether they are employed, a founder, a student, or in transition.",
  },
  dailyWorkSummary: {
    title: "Capture the real workflow",
    detail: "Pull out the day-to-day work so the first project feels grounded in reality.",
  },
  keySkills: {
    title: "List the working stack",
    detail: "Ask which tools, systems, and skills they already use so the plan compounds rather than resets.",
  },
  selectedGoals: {
    title: "Pin the learning goals",
    detail: "Find out whether this is for upskilling, hiring proof, foundations, projects, or business building.",
  },
  aiComfort: {
    title: "Gauge AI comfort",
    detail: "Get a 1 to 5 self-rating so the host can pace the plan and follow-ups correctly.",
  },
};

export const REALTIME_TOOL_NAME = "capture_onboarding_state";

export const REALTIME_ONBOARDING_INSTRUCTIONS = `
You are an onboarding host for an AI tutor product.
Your job is to run a live conversational intake, one question at a time, and collect enough detail to generate a practical learning plan.

Interview style:
- Sound like a calm human onboarding specialist, not a survey bot.
- Ask only one primary question at a time.
- Keep each turn short.
- If the user gives a vague answer, ask one sharp follow-up.
- Confirm important details naturally.

You must collect these fields before you wrap:
1. fullName
2. jobTitle
3. careerPathId mapped to one of these exact values: ${CAREER_PATHS.map((path) => path.id).join(", ")}
4. careerCategoryLabel in normal human words
5. yearsExperience using one of: 0-1, 1-3, 3-5, 5-10, 10+
6. companySize if known using one of: startup, small, medium, large
7. situation using one of: employed, unemployed, student, founder, freelancer, career_switcher
8. dailyWorkSummary describing the user's day-to-day work
9. keySkills as a short list of tools, systems, or skills
10. selectedGoals using one or more of: build_business, upskill_current_job, showcase_for_job, learn_foundations, ship_ai_projects
11. aiComfort as an integer from 1 to 5
12. linkedinUrl if the user wants to share it
13. resumeFilename if the user mentions a resume they want to upload later

Mapping guidance:
- Product roles usually map to product-management.
- Marketing or growth roles usually map to marketing-seo.
- Design roles usually map to branding-design.
- QA or testing roles usually map to quality-assurance.
- Sales, GTM, or RevOps roles usually map to sales-revops.
- Support or customer success roles usually map to customer-support.
- Ops, BizOps, finance ops, legal ops, or accounting workflows usually map to operations.
- Engineering roles usually map to software-engineering.

Tool rule:
- After every meaningful user answer, call ${REALTIME_TOOL_NAME} with the structured state you currently know.
- Always include needsFollowup with the required fields that are still missing or unclear.
- When all required fields are captured, tell the user you have enough to generate the plan and ask if they want you to wrap it up.
`.trim();

export const REALTIME_ONBOARDING_TOOL = {
  type: "function",
  name: REALTIME_TOOL_NAME,
  description: "Update the structured onboarding notes after each meaningful answer.",
  parameters: {
    type: "object",
    additionalProperties: false,
    properties: {
      summary: {
        type: "string",
        description: "One or two sentences summarizing what the user shared most recently.",
      },
      fullName: { type: "string" },
      jobTitle: { type: "string" },
      careerPathId: {
        type: "string",
        enum: CAREER_PATHS.map((path) => path.id),
      },
      careerCategoryLabel: { type: "string" },
      yearsExperience: {
        type: "string",
        enum: ["0-1", "1-3", "3-5", "5-10", "10+"],
      },
      companySize: {
        type: "string",
        enum: ["startup", "small", "medium", "large"],
      },
      situation: {
        type: "string",
        enum: ["employed", "unemployed", "student", "founder", "freelancer", "career_switcher"],
      },
      dailyWorkSummary: { type: "string" },
      keySkills: {
        type: "array",
        items: { type: "string" },
        maxItems: 12,
      },
      selectedGoals: {
        type: "array",
        items: {
          type: "string",
          enum: ["build_business", "upskill_current_job", "showcase_for_job", "learn_foundations", "ship_ai_projects"],
        },
        maxItems: 5,
      },
      aiComfort: {
        type: "integer",
        minimum: 1,
        maximum: 5,
      },
      linkedinUrl: { type: "string" },
      resumeFilename: { type: "string" },
      needsFollowup: {
        type: "array",
        items: {
          type: "string",
          enum: REQUIRED_NOTE_FIELDS,
        },
        description: "Required fields that are still missing or unclear.",
      },
    },
    required: ["needsFollowup"],
  },
} as const;

export function createEmptyNotes(): OnboardingNotes {
  return {
    summary: "",
    fullName: "",
    jobTitle: "",
    careerPathId: "",
    careerCategoryLabel: "",
    yearsExperience: "",
    companySize: "",
    situation: "",
    dailyWorkSummary: "",
    keySkills: [],
    selectedGoals: [],
    aiComfort: null,
    linkedinUrl: "",
    resumeFilename: "",
  };
}

function uniqueStrings(input: string[]) {
  return Array.from(
    new Set(
      input
        .map((value) => value.trim())
        .filter(Boolean),
    ),
  );
}

export function mergeOnboardingNotes(current: OnboardingNotes, update: RealtimeOnboardingUpdate): OnboardingNotes {
  return {
    summary: update.summary?.trim() || current.summary,
    fullName: update.fullName?.trim() || current.fullName,
    jobTitle: update.jobTitle?.trim() || current.jobTitle,
    careerPathId: update.careerPathId || current.careerPathId,
    careerCategoryLabel: update.careerCategoryLabel?.trim() || current.careerCategoryLabel,
    yearsExperience: update.yearsExperience || current.yearsExperience,
    companySize: update.companySize || current.companySize,
    situation: update.situation || current.situation,
    dailyWorkSummary: update.dailyWorkSummary?.trim() || current.dailyWorkSummary,
    keySkills: Array.isArray(update.keySkills) && update.keySkills.length ? uniqueStrings(update.keySkills) : current.keySkills,
    selectedGoals: Array.isArray(update.selectedGoals) && update.selectedGoals.length ? Array.from(new Set(update.selectedGoals)) : current.selectedGoals,
    aiComfort: typeof update.aiComfort === "number" ? Math.max(1, Math.min(5, Math.round(update.aiComfort))) : current.aiComfort,
    linkedinUrl: update.linkedinUrl?.trim() || current.linkedinUrl,
    resumeFilename: update.resumeFilename?.trim() || current.resumeFilename,
  };
}

export function getMissingRequiredFields(notes: OnboardingNotes): RequiredNoteField[] {
  return REQUIRED_NOTE_FIELDS.filter((field) => {
    if (field === "selectedGoals") return notes.selectedGoals.length === 0;
    if (field === "keySkills") return notes.keySkills.length === 0;
    if (field === "aiComfort") return typeof notes.aiComfort !== "number";
    return !String(notes[field] ?? "").trim();
  });
}

export function getCoveragePercent(notes: OnboardingNotes) {
  const missing = getMissingRequiredFields(notes).length;
  return Math.round(((REQUIRED_NOTE_FIELDS.length - missing) / REQUIRED_NOTE_FIELDS.length) * 100);
}

export function buildHandleBase(name: string) {
  const normalized = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
  return normalized || "onboarding-learner";
}

export function buildAssessmentAnswers(notes: OnboardingNotes) {
  const experienceScoreByBand: Record<YearsExperience, number> = {
    "0-1": 1,
    "1-3": 2,
    "3-5": 3,
    "5-10": 4,
    "10+": 5,
  };

  return [
    {
      questionId: "career_experience",
      value: notes.yearsExperience ? experienceScoreByBand[notes.yearsExperience] : 2,
    },
    {
      questionId: "ai_comfort",
      value: notes.aiComfort ?? 3,
    },
    {
      questionId: "daily_work_complexity",
      value: Math.min(5, Math.max(1, Math.ceil(notes.dailyWorkSummary.trim().length / 70))),
    },
    {
      questionId: "linkedin_context",
      value: notes.linkedinUrl.trim() ? 5 : 2,
    },
    {
      questionId: "resume_context",
      value: notes.resumeFilename.trim() ? 4 : 2,
    },
  ];
}

function goalNarrative(goal: GoalType) {
  if (goal === "build_business") return "turning this into a business-facing workflow";
  if (goal === "showcase_for_job") return "packaging the work into hiring-ready proof";
  if (goal === "ship_ai_projects") return "shipping a project you can demo publicly";
  if (goal === "learn_foundations") return "building a clean AI fundamentals base";
  return "getting better leverage inside your current role";
}

function buildProjectIdea(notes: OnboardingNotes, primaryPath: (typeof CAREER_PATHS)[number]) {
  const topGoal = notes.selectedGoals[0] ?? "upskill_current_job";
  const role = notes.jobTitle || notes.careerCategoryLabel || primaryPath.name;
  return `Build a ${role.toLowerCase()} workflow that uses ${primaryPath.modules[0]} and ${primaryPath.modules[1] ?? primaryPath.modules[0]} to improve ${
    goalNarrative(topGoal)
  }.`;
}

export function buildLearningPlan(input: {
  notes: OnboardingNotes;
  recommendedCareerPathIds: string[];
  assessmentScore: number;
}): LearningPlanPreview {
  const recommendedPaths = input.recommendedCareerPathIds
    .map((id) => CAREER_PATHS.find((path) => path.id === id))
    .filter((path): path is (typeof CAREER_PATHS)[number] => Boolean(path));

  const primaryPath =
    recommendedPaths[0] ??
    CAREER_PATHS.find((path) => path.id === input.notes.careerPathId) ??
    CAREER_PATHS[0];

  const supportingPaths = recommendedPaths.slice(1, 3);
  const focusModules = primaryPath.modules.slice(0, 3);
  const toolStack = Array.from(new Set([...primaryPath.tools.slice(0, 4), ...input.notes.keySkills.slice(0, 4)])).slice(0, 6);
  const proofArtifacts = [
    "A public workflow walkthrough with screenshots",
    "One portfolio-ready case study tied to a real job outcome",
    "A short LinkedIn or profile post explaining the before-and-after process",
  ];

  return {
    assessmentScore: input.assessmentScore,
    primaryPath,
    supportingPaths,
    toolStack,
    focusModules,
    projectIdea: buildProjectIdea(input.notes, primaryPath),
    proofArtifacts,
    milestones: [
      {
        window: "Days 1-30",
        title: `Build fluency in ${primaryPath.name}`,
        detail: `Work through ${focusModules[0]} and ${focusModules[1] ?? focusModules[0]}, using ${toolStack.slice(0, 2).join(" and ")} on one live workflow from your week.`,
      },
      {
        window: "Days 31-60",
        title: "Ship the first useful project",
        detail: buildProjectIdea(input.notes, primaryPath),
      },
      {
        window: "Days 61-90",
        title: "Turn the work into proof",
        detail: `Package the project into a case study and add one public artifact so the work supports ${goalNarrative(input.notes.selectedGoals[0] ?? "showcase_for_job")}.`,
      },
    ],
    guideLinks: [
      { label: "AI Upskilling Roadmap", href: "/learn/ai-upskilling-roadmap" },
      { label: "How to Build an AI Portfolio", href: "/learn/how-to-build-an-ai-portfolio" },
      { label: "Prove AI Skills to Employers", href: "/learn/prove-ai-skills-to-employers" },
    ],
  };
}
