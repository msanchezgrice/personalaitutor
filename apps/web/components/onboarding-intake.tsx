"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { SignUpButton, useAuth, useUser } from "@clerk/nextjs";
import type { GoalType, SituationStatus } from "@aitutor/shared";
import {
  fbOnboardingComplete,
  fbOnboardingStart,
  fbQuizComplete,
  fbQuizStart,
  fbViewContent,
} from "@/lib/fb-pixel";
import { trackAdCompleteRegistration, trackAdLead } from "@/lib/ad-conversions";
import { captureAnalyticsEvent, createAnalyticsEventId } from "@/lib/analytics";
import { readClientAttributionEnvelope } from "@/lib/attribution";
import { COMPLETE_REGISTRATION_FIRED_KEY, PENDING_SESSION_KEY, SIGN_UP_INTENT_KEY } from "@/components/auth-tracking-keys";

type Step = 1 | 2 | 3 | 4 | 5;

const ONBOARDING_FUNNEL = "onboarding_assessment";

const STEP_NAMES: Record<Step, string> = {
  1: "basic_information",
  2: "work_details",
  3: "resume_review",
  4: "ai_analysis",
  5: "assessment_complete",
};

function trackPosthog(event: string, properties?: Record<string, unknown>) {
  captureAnalyticsEvent(event, {
    funnel: ONBOARDING_FUNNEL,
    ...(properties ?? {}),
  });
}

function trackFunnelStep(step: string, properties?: Record<string, unknown>) {
  trackPosthog("onboarding_assessment_funnel_step", {
    step,
    ...properties,
  });
}

function trackValidationFailure(step: Step, reason: string, properties?: Record<string, unknown>) {
  trackPosthog("onboarding_step_validation_failed", {
    step,
    step_name: STEP_NAMES[step],
    reason,
    ...(properties ?? {}),
  });
}

type OnboardingStartPayload = {
  ok: boolean;
  session?: { id: string; userId: string };
  sessionToken?: string;
  user?: { id: string; handle: string; name: string };
  error?: { message?: string };
};

type OnboardingCompletePayload = {
  ok: boolean;
  session?: { id: string; userId: string };
  assessment?: { id: string; score: number; recommendedCareerPathIds: string[] };
  signedIn?: boolean;
  claimed?: boolean;
  user?: { id: string; handle: string; name: string; avatarUrl?: string | null } | null;
  error?: { message?: string };
};

type ResumeUploadPayload = {
  ok: boolean;
  resume?: {
    filename: string;
    path: string;
    bytes: number;
    mimeType: string;
    bucket: string;
  };
  error?: { message?: string };
};

type OnboardingDraft = {
  fullName: string;
  careerCategory: (typeof careerCategoryOptions)[number]["value"];
  customCareerCategory: string;
  jobTitle: string;
  yearsExperience: (typeof yearsExperienceOptions)[number]["value"];
  companySize: string;
  situation: SituationStatus;
  dailyWorkSummary: string;
  keySkills: string;
  linkedinUrl: string;
  selectedGoals: GoalType[];
  aiComfort: number;
  uploadedResumeName: string | null;
  ts: number;
};

type RiskSeverity = "Low" | "Medium" | "High";
type RiskBand = "Low" | "Moderate" | "High";

type CareerAssessmentTemplate = {
  title: string;
  description: string;
  riskAreas: Array<{ label: string; level: RiskSeverity }>;
  recommendedActions: string[];
  aiToolAnalysis: string;
  careerStrategies: string;
  actionPlan: string[];
};

const analysisSteps = [
  "Analyzing your professional profile",
  "Researching AI trends in your field",
  "Evaluating automation risk factors",
  "Generating personalized insights",
  "Finalizing your career assessment",
  "Preparing your personalized tutor setup",
];

const careerCategoryOptions = [
  { value: "product-manager", label: "Product Manager", path: "product-management" },
  { value: "designer", label: "Designer", path: "branding-design" },
  { value: "marketing", label: "Marketing", path: "marketing-seo" },
  { value: "accounting", label: "Accounting", path: "operations" },
  { value: "legal", label: "Legal", path: "operations" },
  { value: "software-engineering", label: "Software Engineering", path: "software-engineering" },
  { value: "other", label: "Other", path: "product-management" },
] as const;

const careerQuestionContent: Record<
  (typeof careerCategoryOptions)[number]["value"],
  {
    subtitle: string;
    jobTitlePlaceholder: string;
    workSummaryPlaceholder: string;
    skillsPlaceholder: string;
  }
> = {
  "product-manager": {
    subtitle: "Specialized analysis for product strategy, roadmapping, stakeholder management",
    jobTitlePlaceholder: "e.g., Senior Product Manager, Product Owner, Associate PM",
    workSummaryPlaceholder:
      "Describe your product management activities like roadmap planning, user story writing, stakeholder meetings, data analysis, feature prioritization, sprint planning...",
    skillsPlaceholder:
      "e.g., Jira, Confluence, Product Analytics, User Research, Roadmapping, Agile/Scrum, SQL, Stakeholder Management...",
  },
  designer: {
    subtitle: "Specialized analysis for design workflow, creative tooling, and review cycles",
    jobTitlePlaceholder: "e.g., Senior UX Designer, Product Designer, Graphic Designer",
    workSummaryPlaceholder:
      "Describe your design process, tools you use (Figma, Sketch, Adobe Creative Suite), daily tasks like user research, wireframing, prototyping, stakeholder meetings, design reviews...",
    skillsPlaceholder:
      "e.g., Figma, Sketch, Adobe Creative Suite, User Research, Prototyping, Design Systems, Interaction Design...",
  },
  marketing: {
    subtitle: "Specialized analysis for content, campaign execution, and growth operations",
    jobTitlePlaceholder: "e.g., Marketing Manager, Content Marketer, Digital Marketing Specialist",
    workSummaryPlaceholder:
      "Describe your marketing activities like content creation, campaign management, social media strategy, SEO optimization, analytics reporting, and lead generation...",
    skillsPlaceholder:
      "e.g., Google Analytics, HubSpot, Content Creation, SEO/SEM, Social Media Marketing, Email Marketing...",
  },
  accounting: {
    subtitle: "Specialized analysis for finance workflows, reconciliation, and reporting automation",
    jobTitlePlaceholder: "e.g., Staff Accountant, Financial Analyst, Bookkeeper, CPA",
    workSummaryPlaceholder:
      "Describe your accounting work like bookkeeping, financial reporting, tax preparation, accounts payable/receivable, financial analysis, and auditing...",
    skillsPlaceholder:
      "e.g., QuickBooks, Excel, SAP, Financial Reporting, Tax Software, Bookkeeping, Financial Analysis...",
  },
  legal: {
    subtitle: "Specialized analysis for legal research, contract review, and compliance operations",
    jobTitlePlaceholder: "e.g., Attorney, Legal Counsel, Paralegal, Legal Assistant",
    workSummaryPlaceholder:
      "Describe your legal work like contract review, legal research, document drafting, client consultation, case preparation, and regulatory compliance...",
    skillsPlaceholder:
      "e.g., Legal Research Databases, Contract Review, Document Drafting, Case Management Software...",
  },
  "software-engineering": {
    subtitle: "Specialized analysis for engineering workflows, architecture, and delivery velocity",
    jobTitlePlaceholder: "e.g., Software Engineer, Full-Stack Developer, Staff Engineer",
    workSummaryPlaceholder:
      "Describe your engineering work like implementation, code reviews, architecture decisions, debugging, incident response, and deployment workflows...",
    skillsPlaceholder:
      "e.g., TypeScript, Python, APIs, CI/CD, Testing, Observability, Cloud Infrastructure...",
  },
  other: {
    subtitle: "Specialized analysis for your role-specific workflows and automation opportunities",
    jobTitlePlaceholder: "e.g., Operations Lead, Sales Manager, HR Business Partner",
    workSummaryPlaceholder:
      "Describe your daily responsibilities, recurring tasks, decision points, and where AI could help you move faster...",
    skillsPlaceholder:
      "e.g., Domain tools, reporting platforms, automation tools, communication workflows...",
  },
};

const assessmentTemplates: Record<(typeof careerCategoryOptions)[number]["value"], CareerAssessmentTemplate> = {
  "product-manager": {
    title: "Product Manager Assessment",
    description:
      "Analysis of AI automation impact on product management, with focus on planning, documentation, and stakeholder execution.",
    riskAreas: [
      { label: "PRD drafting and requirement formatting", level: "High" },
      { label: "Status reporting and routine updates", level: "Medium" },
      { label: "Strategic prioritization and tradeoff decisions", level: "Low" },
    ],
    recommendedActions: [
      "Shift more time into strategy and cross-functional alignment",
      "Build stronger experimentation and analytics interpretation skills",
      "Publish proof of AI-assisted product operations wins",
    ],
    aiToolAnalysis:
      "Use AI copilots for PRD scaffolding, synthesis from interviews, and release-note generation; keep human ownership for prioritization and narrative.",
    careerStrategies:
      "Position yourself as an AI-native PM who converts ambiguous goals into execution systems with measurable business outcomes.",
    actionPlan: [
      "Automate one weekly reporting workflow in your stack",
      "Create a repeatable AI prompt pack for discovery + planning",
      "Ship a public project card showing before/after cycle-time impact",
    ],
  },
  designer: {
    title: "Design Assessment",
    description:
      "Analysis of AI impact on design roles across ideation, production assets, and quality review workflows.",
    riskAreas: [
      { label: "Rapid concept generation and variation production", level: "High" },
      { label: "UI copy and basic component layout drafting", level: "Medium" },
      { label: "System-level UX strategy and taste leadership", level: "Low" },
    ],
    recommendedActions: [
      "Double down on research-backed design rationale and storytelling",
      "Lead design systems and interaction architecture decisions",
      "Use AI to accelerate iterations while preserving quality standards",
    ],
    aiToolAnalysis:
      "AI tools are strongest for drafts and exploration, while brand judgment, accessibility nuance, and product coherence remain designer-led.",
    careerStrategies:
      "Become the designer who can run high-volume exploration and still ship polished, conversion-driven experiences.",
    actionPlan: [
      "Create an AI-assisted exploration workflow for 3 concept directions",
      "Define a review rubric for quality and accessibility checks",
      "Publish a build log showing AI draft-to-final design evolution",
    ],
  },
  marketing: {
    title: "Marketing Assessment",
    description:
      "Evaluation of AI impact on marketing roles, including content creation, campaign management, and data analysis.",
    riskAreas: [
      { label: "Content writing and copy generation", level: "High" },
      { label: "Social media scheduling and performance summaries", level: "High" },
      { label: "Brand strategy and campaign positioning", level: "Low" },
    ],
    recommendedActions: [
      "Develop stronger strategic brand thinking",
      "Focus on creative campaign concepts and channel orchestration",
      "Improve advanced data interpretation and narrative reporting",
    ],
    aiToolAnalysis:
      "AI can generate variants quickly for ads, posts, and emails; strongest leverage comes from rapid testing loops and human-led messaging decisions.",
    careerStrategies:
      "Lead with experimentation frameworks and audience insight synthesis so AI output is tied to measurable growth outcomes.",
    actionPlan: [
      "Build a reusable AI content pipeline for one campaign",
      "Define test hypotheses and reporting templates by funnel stage",
      "Publish a public proof card with lift metrics from an AI-assisted sprint",
    ],
  },
  accounting: {
    title: "Accounting Assessment",
    description:
      "Analysis of AI automation in accounting, focusing on bookkeeping, reporting workflows, and advisory services.",
    riskAreas: [
      { label: "Data entry and bookkeeping", level: "High" },
      { label: "Basic financial reporting and reconciliations", level: "High" },
      { label: "Strategic financial advisory", level: "Low" },
    ],
    recommendedActions: [
      "Transition toward advisory and strategic planning functions",
      "Strengthen client communication and scenario planning skills",
      "Focus on complex compliance and exception-handling workflows",
    ],
    aiToolAnalysis:
      "AI handles repetitive categorization and first-pass summaries; accountants retain leverage in controls, risk judgment, and decision-grade interpretation.",
    careerStrategies:
      "Move upmarket by combining AI-enabled speed with trusted financial judgment and strategic advisory depth.",
    actionPlan: [
      "Automate one reconciliation or categorization workflow",
      "Build a monthly advisory insights template for stakeholders",
      "Document AI control checks and exception-handling process publicly",
    ],
  },
  legal: {
    title: "Legal Assessment",
    description:
      "Assessment of AI impact in legal workflows, including drafting support, research acceleration, and review operations.",
    riskAreas: [
      { label: "First-draft clause generation and summarization", level: "High" },
      { label: "Legal research triage and precedent clustering", level: "Medium" },
      { label: "Negotiation strategy and case judgment", level: "Low" },
    ],
    recommendedActions: [
      "Specialize in high-context advisory and negotiation outcomes",
      "Develop AI quality-control and citation validation workflows",
      "Use AI to accelerate drafting while retaining legal accountability",
    ],
    aiToolAnalysis:
      "AI improves speed for draft and research prep, but legal reliability depends on robust human review, source validation, and risk ownership.",
    careerStrategies:
      "Stand out as counsel who can deploy AI safely with defensible review frameworks and client-ready decision support.",
    actionPlan: [
      "Create a vetted prompt + citation-check checklist",
      "Pilot AI-assisted drafting on low-risk template documents",
      "Publish a build log on legal AI quality-control practices",
    ],
  },
  "software-engineering": {
    title: "Software Engineering Assessment",
    description:
      "Assessment of AI impact across coding productivity, debugging, architecture decisions, and operational reliability.",
    riskAreas: [
      { label: "Boilerplate implementation and unit test generation", level: "High" },
      { label: "Debugging and code review assistance", level: "Medium" },
      { label: "System architecture and reliability tradeoffs", level: "Low" },
    ],
    recommendedActions: [
      "Increase depth in architecture and distributed systems fundamentals",
      "Strengthen production debugging and observability workflows",
      "Use AI for speed while maintaining rigorous validation and testing",
    ],
    aiToolAnalysis:
      "AI accelerates implementation velocity; senior leverage remains in design decisions, runtime reliability, and shipping resilient systems.",
    careerStrategies:
      "Build a profile as an engineer who ships faster with AI and still raises quality bars through automation and testing discipline.",
    actionPlan: [
      "Create an AI-assisted code-generation + validation pipeline",
      "Instrument one project with stronger observability and alerts",
      "Publish a project card with latency, reliability, or dev-time gains",
    ],
  },
  other: {
    title: "Career Assessment",
    description:
      "General assessment of AI automation exposure in your current workflow with recommendations to build durable advantage.",
    riskAreas: [
      { label: "Repetitive documentation and routine communication tasks", level: "High" },
      { label: "Standardized analysis and report generation", level: "Medium" },
      { label: "Relationship management and strategic decision-making", level: "Low" },
    ],
    recommendedActions: [
      "Map high-frequency repetitive tasks and automate the first layer",
      "Strengthen domain-specific judgment and decision frameworks",
      "Show public proof of AI-enabled process improvements",
    ],
    aiToolAnalysis:
      "AI can handle repeatable workflows quickly; your leverage grows by owning context, edge-case handling, and cross-functional execution.",
    careerStrategies:
      "Adopt an operator mindset: automate repetitive work, reinvest time in high-judgment problems, and document measurable outcomes.",
    actionPlan: [
      "Identify top 3 repetitive workflows to automate this month",
      "Create one AI-assisted process with clear KPI improvements",
      "Publish the process and results in your public build log",
    ],
  },
};

const yearsExperienceOptions = [
  { value: "0-1", label: "Less than 1 year", score: 1 },
  { value: "1-3", label: "1-3 years", score: 2 },
  { value: "3-5", label: "3-5 years", score: 3 },
  { value: "5-10", label: "5-10 years", score: 4 },
  { value: "10+", label: "10+ years", score: 5 },
] as const;

const companySizeOptions = [
  { value: "", label: "Select company size" },
  { value: "startup", label: "Startup (1-50)" },
  { value: "small", label: "Small (51-200)" },
  { value: "medium", label: "Medium (201-1000)" },
  { value: "large", label: "Large (1000+)" },
] as const;

const situationOptions: Array<{ value: SituationStatus; label: string }> = [
  { value: "employed", label: "Employed" },
  { value: "unemployed", label: "Unemployed" },
  { value: "student", label: "Student" },
  { value: "founder", label: "Founder" },
  { value: "freelancer", label: "Freelancer" },
  { value: "career_switcher", label: "Career Switcher" },
];

const goalOptions: Array<{ value: GoalType; label: string }> = [
  { value: "build_business", label: "Build a business" },
  { value: "upskill_current_job", label: "Upskill for current job" },
  { value: "showcase_for_job", label: "Showcase skills for a new role" },
  { value: "ship_ai_projects", label: "Ship AI projects" },
  { value: "learn_foundations", label: "Learn foundations" },
];

const aiComfortOptions = [
  { value: 2, label: "Beginner" },
  { value: 3, label: "Intermediate" },
  { value: 5, label: "Advanced" },
] as const;

const ONBOARDING_BOOTSTRAP_KEY = "ai_tutor_onboarding_bootstrap_v1";
const ONBOARDING_DRAFT_KEY = "ai_tutor_onboarding_draft_v1";

function getRiskBand(score: number): RiskBand {
  if (score >= 70) return "High";
  if (score >= 45) return "Moderate";
  return "Low";
}

function getTimeline(score: number): string {
  if (score >= 70) return "1-2 years";
  if (score >= 45) return "1-3 years";
  return "3-5 years";
}

function sanitizeRedirectPath(path: string) {
  if (!path.startsWith("/")) return "/onboarding";
  return path;
}

function readSignUpIntent() {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.sessionStorage.getItem(SIGN_UP_INTENT_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as { startedAt?: number; source?: string };
  } catch {
    return null;
  }
}

function preferredSourceLabel(): string {
  if (typeof window === "undefined") return "social login";
  const source = readClientAttributionEnvelope()?.last?.utmSource?.toLowerCase() ?? "";
  if (source.includes("linkedin")) return "LinkedIn sign-in";
  if (source === "x" || source.includes("twitter")) return "X sign-in";
  if (source.includes("facebook") || source.includes("meta") || source.includes("instagram")) return "Facebook sign-in";
  return "social login";
}

async function postJson<T>(url: string, body: Record<string, unknown>): Promise<T> {
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "cache-control": "no-store",
    },
    credentials: "same-origin",
    body: JSON.stringify(body),
  });

  const data = (await res.json().catch(() => ({}))) as T & { ok?: boolean; error?: { message?: string } };
  if (!res.ok || !data || (typeof data === "object" && "ok" in data && !data.ok)) {
    const message =
      data && typeof data === "object" && "error" in data && data.error?.message
        ? data.error.message
        : "Request failed";
    throw new Error(message);
  }
  return data;
}

export function OnboardingIntake() {
  const { isLoaded: authLoaded, userId: authUserId } = useAuth();
  const { user } = useUser();
  const isSignedIn = Boolean(authUserId);
  const [step, setStep] = useState<Step>(1);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [analysisIndex, setAnalysisIndex] = useState(0);
  const [linkedinConnected, setLinkedinConnected] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [sessionUserId, setSessionUserId] = useState<string | null>(null);
  const [sessionToken, setSessionToken] = useState<string | null>(null);
  const [assessmentScore, setAssessmentScore] = useState<number | null>(null);
  const [recommendedPaths, setRecommendedPaths] = useState<string[]>([]);
  const [resumeUploadBusy, setResumeUploadBusy] = useState(false);
  const [uploadedResumeName, setUploadedResumeName] = useState<string | null>(null);
  const [nextRedirectHref, setNextRedirectHref] = useState<string | null>(null);
  const [nextRedirectLabel, setNextRedirectLabel] = useState("Continue");
  const [navigatingAfterSummary, setNavigatingAfterSummary] = useState(false);
  const viewContentFired = useRef(false);
  const onboardingStartFired = useRef(false);
  const quizStartFired = useRef(false);
  const quizCompleteFired = useRef(false);
  const onboardingCompleteFired = useRef(false);
  const sessionWarmupStarted = useRef(false);
  const signUpCompletedFired = useRef(false);
  const lastRemoteDraftSignature = useRef<string | null>(null);

  const [careerCategory, setCareerCategory] = useState<(typeof careerCategoryOptions)[number]["value"]>("product-manager");
  const [fullName, setFullName] = useState("");
  const [customCareerCategory, setCustomCareerCategory] = useState("");
  const [jobTitle, setJobTitle] = useState("");
  const [yearsExperience, setYearsExperience] = useState<(typeof yearsExperienceOptions)[number]["value"]>("1-3");
  const [companySize, setCompanySize] = useState("");
  const [situation, setSituation] = useState<SituationStatus>("employed");
  const [dailyWorkSummary, setDailyWorkSummary] = useState("");
  const [keySkills, setKeySkills] = useState("");
  const [linkedinUrl, setLinkedinUrl] = useState("");
  const [selectedGoals, setSelectedGoals] = useState<GoalType[]>(["upskill_current_job"]);
  const [aiComfort, setAiComfort] = useState<number>(3);
  const [resumeFile, setResumeFile] = useState<File | null>(null);

  const selectedCareer = useMemo(
    () => careerCategoryOptions.find((entry) => entry.value === careerCategory) ?? careerCategoryOptions[0],
    [careerCategory],
  );
  const selectedCareerLabel = useMemo(() => {
    if (careerCategory === "other") {
      return customCareerCategory.trim() || "Other";
    }
    return selectedCareer.label;
  }, [careerCategory, customCareerCategory, selectedCareer.label]);
  const selectedExperience = useMemo(
    () => yearsExperienceOptions.find((entry) => entry.value === yearsExperience) ?? yearsExperienceOptions[1],
    [yearsExperience],
  );
  const selectedCareerContent = useMemo(
    () => careerQuestionContent[careerCategory] ?? careerQuestionContent.other,
    [careerCategory],
  );
  const activeAssessmentTemplate = useMemo(
    () => assessmentTemplates[careerCategory] ?? assessmentTemplates.other,
    [careerCategory],
  );
  const normalizedScore = useMemo(() => {
    if (assessmentScore === null || Number.isNaN(assessmentScore)) return 0;
    const raw = assessmentScore <= 1 ? assessmentScore * 100 : assessmentScore;
    return Math.max(0, Math.min(100, Math.round(raw)));
  }, [assessmentScore]);
  const riskBand = useMemo(() => getRiskBand(normalizedScore), [normalizedScore]);
  const riskTimeline = useMemo(() => getTimeline(normalizedScore), [normalizedScore]);
  const riskColor = useMemo(() => {
    if (riskBand === "High") return "#dc2626";
    if (riskBand === "Moderate") return "#d97706";
    return "#16a34a";
  }, [riskBand]);
  const recommendedAuthSource = useMemo(() => preferredSourceLabel(), []);
  const hasMeaningfulInput = useMemo(() => {
    const hasDefaultGoals =
      selectedGoals.length === 1 && selectedGoals[0] === "upskill_current_job";
    return Boolean(
      fullName.trim() ||
        customCareerCategory.trim() ||
        jobTitle.trim() ||
        dailyWorkSummary.trim() ||
        keySkills.trim() ||
        linkedinUrl.trim() ||
        uploadedResumeName ||
        resumeFile ||
        careerCategory !== "product-manager" ||
        yearsExperience !== "1-3" ||
        companySize ||
        situation !== "employed" ||
        aiComfort !== 3 ||
        !hasDefaultGoals,
    );
  }, [
    aiComfort,
    careerCategory,
    companySize,
    customCareerCategory,
    dailyWorkSummary,
    fullName,
    jobTitle,
    keySkills,
    linkedinUrl,
    resumeFile,
    selectedGoals,
    situation,
    uploadedResumeName,
    yearsExperience,
  ]);
  const remoteDraftPayload = useMemo(
    () => ({
      fullName,
      careerCategory,
      careerCategoryLabel: selectedCareerLabel,
      customCareerCategory,
      careerPathId: selectedCareer.path,
      jobTitle,
      yearsExperience,
      companySize: companySize || null,
      situation,
      dailyWorkSummary,
      keySkills,
      linkedinUrl: linkedinUrl.trim() ? linkedinUrl.trim() : null,
      selectedGoals,
      aiComfort,
      resumeFilename: uploadedResumeName ?? resumeFile?.name ?? null,
      uploadedResumeName,
      currentStep: step,
    }),
    [
      aiComfort,
      careerCategory,
      companySize,
      customCareerCategory,
      dailyWorkSummary,
      fullName,
      jobTitle,
      keySkills,
      linkedinUrl,
      resumeFile,
      selectedCareer.path,
      selectedCareerLabel,
      selectedGoals,
      situation,
      step,
      uploadedResumeName,
      yearsExperience,
    ],
  );
  const remoteDraftSignature = useMemo(() => JSON.stringify(remoteDraftPayload), [remoteDraftPayload]);

  const continueAfterSummary = () => {
    if (!nextRedirectHref || !isSignedIn) return;
    trackPosthog("assessment_summary_cta_clicked", {
      session_id: sessionId,
      destination: nextRedirectHref,
      action: "open_dashboard",
      career_category: careerCategory,
      score: normalizedScore,
      risk_band: riskBand,
    });
    trackPosthog("onboarding_continue_to_dashboard", {
      session_id: sessionId,
      destination: nextRedirectHref,
      career_category: careerCategory,
      score: normalizedScore,
      risk_band: riskBand,
      requires_signup: !isSignedIn,
    });
    setNavigatingAfterSummary(true);
    window.location.href = nextRedirectHref;
  };

  useEffect(() => {
    if (typeof window === "undefined") return;
    document.documentElement.setAttribute("data-onboarding-react", "1");
    document.documentElement.setAttribute("data-path", "/onboarding");
    document.body?.setAttribute("data-path", "/onboarding");

    const params = new URLSearchParams(window.location.search);
    const maybeSessionId = params.get("sessionId");
    let boot: { sessionId?: string; sessionUserId?: string; sessionToken?: string } | null = null;
    try {
      const raw = window.sessionStorage.getItem(ONBOARDING_BOOTSTRAP_KEY);
      boot = raw ? (JSON.parse(raw) as { sessionId?: string; sessionUserId?: string; sessionToken?: string }) : null;
    } catch {
      boot = null;
    }

    if (maybeSessionId) {
      setSessionId(maybeSessionId);
      if (boot?.sessionId === maybeSessionId && boot.sessionUserId) {
        setSessionUserId(boot.sessionUserId);
      }
      if (boot?.sessionId === maybeSessionId && boot.sessionToken) {
        setSessionToken(boot.sessionToken);
      }
    } else if (boot?.sessionId) {
      setSessionId(boot.sessionId);
      if (boot.sessionUserId) setSessionUserId(boot.sessionUserId);
      if (boot.sessionToken) setSessionToken(boot.sessionToken);
    }
    const oauth = params.get("oauth");
    if (oauth === "linkedin_connected") {
      setLinkedinConnected(true);
      trackPosthog("onboarding_linkedin_oauth_completed", {
        session_id: maybeSessionId ?? boot?.sessionId ?? null,
      });
    } else if (oauth === "linkedin_denied") {
      setError("LinkedIn connection was denied. You can continue onboarding without it or try again.");
      trackPosthog("onboarding_linkedin_oauth_failed", {
        session_id: maybeSessionId ?? boot?.sessionId ?? null,
        reason: "oauth_denied",
      });
    }
    return () => {
      document.documentElement.removeAttribute("data-onboarding-react");
    };
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const raw = window.localStorage.getItem(ONBOARDING_DRAFT_KEY);
      if (!raw) return;
      const draft = JSON.parse(raw) as Partial<OnboardingDraft>;
      if (typeof draft.fullName === "string") setFullName(draft.fullName);
      if (draft.careerCategory) setCareerCategory(draft.careerCategory);
      if (typeof draft.customCareerCategory === "string") setCustomCareerCategory(draft.customCareerCategory);
      if (typeof draft.jobTitle === "string") setJobTitle(draft.jobTitle);
      if (draft.yearsExperience) setYearsExperience(draft.yearsExperience);
      if (typeof draft.companySize === "string") setCompanySize(draft.companySize);
      if (draft.situation) setSituation(draft.situation);
      if (typeof draft.dailyWorkSummary === "string") setDailyWorkSummary(draft.dailyWorkSummary);
      if (typeof draft.keySkills === "string") setKeySkills(draft.keySkills);
      if (typeof draft.linkedinUrl === "string") setLinkedinUrl(draft.linkedinUrl);
      if (Array.isArray(draft.selectedGoals) && draft.selectedGoals.length) setSelectedGoals(draft.selectedGoals);
      if (typeof draft.aiComfort === "number") setAiComfort(draft.aiComfort);
      if (typeof draft.uploadedResumeName === "string") setUploadedResumeName(draft.uploadedResumeName);
      trackPosthog("onboarding_draft_restored", {
        has_resume_name: Boolean(draft.uploadedResumeName),
      });
    } catch {
      // Ignore draft parsing failures.
    }
  }, []);

  useEffect(() => {
    const candidateName =
      user?.fullName?.trim() ||
      [user?.firstName, user?.lastName].filter(Boolean).join(" ").trim() ||
      "";
    if (!candidateName) return;
    setFullName((prev) => (prev.trim() ? prev : candidateName));
  }, [user?.fullName, user?.firstName, user?.lastName]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const payload: OnboardingDraft = {
      fullName,
      careerCategory,
      customCareerCategory,
      jobTitle,
      yearsExperience,
      companySize,
      situation,
      dailyWorkSummary,
      keySkills,
      linkedinUrl,
      selectedGoals,
      aiComfort,
      uploadedResumeName,
      ts: Date.now(),
    };
    try {
      window.localStorage.setItem(ONBOARDING_DRAFT_KEY, JSON.stringify(payload));
    } catch {
      // Ignore storage failures.
    }
  }, [
    fullName,
    careerCategory,
    customCareerCategory,
    jobTitle,
    yearsExperience,
    companySize,
    situation,
    dailyWorkSummary,
    keySkills,
    linkedinUrl,
    selectedGoals,
    aiComfort,
    uploadedResumeName,
  ]);

  useEffect(() => {
    if (!sessionId || !sessionToken) return;
    const draftKey = `${sessionId}:${remoteDraftSignature}`;
    if (draftKey === lastRemoteDraftSignature.current) return;

    const timer = window.setTimeout(() => {
      void postJson("/api/onboarding/draft", {
        sessionId,
        sessionToken,
        draft: remoteDraftPayload,
      })
        .then(() => {
          lastRemoteDraftSignature.current = draftKey;
        })
        .catch(() => {
          // Keep local draft state even if the network save fails.
        });
    }, 350);

    return () => {
      window.clearTimeout(timer);
    };
  }, [remoteDraftPayload, remoteDraftSignature, sessionId, sessionToken]);

  useEffect(() => {
    if (!sessionId || !sessionToken || typeof window === "undefined") return;

    const flushDraft = () => {
      const body = JSON.stringify({
        sessionId,
        sessionToken,
        draft: remoteDraftPayload,
      });

      if (navigator.sendBeacon) {
        const blob = new Blob([body], { type: "application/json" });
        if (navigator.sendBeacon("/api/onboarding/draft", blob)) {
          return;
        }
      }

      void window.fetch("/api/onboarding/draft", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body,
        keepalive: true,
      });
    };

    const onVisibilityChange = () => {
      if (document.visibilityState === "hidden") {
        flushDraft();
      }
    };

    window.addEventListener("pagehide", flushDraft);
    document.addEventListener("visibilitychange", onVisibilityChange);

    return () => {
      window.removeEventListener("pagehide", flushDraft);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [remoteDraftPayload, sessionId, sessionToken]);

  useEffect(() => {
    if (!authLoaded || !isSignedIn || signUpCompletedFired.current) return;
    const intent = readSignUpIntent();
    if (!intent?.startedAt) return;
    signUpCompletedFired.current = true;
    trackPosthog("clerk_sign_up_completed", {
      auth_provider: "clerk",
      signup_started_at: intent.startedAt,
      source: intent.source ?? "onboarding_auth_gate",
    });
    trackPosthog("auth_clerk_sign_up_completed", {
      auth_provider: "clerk",
      signup_started_at: intent.startedAt,
      source: intent.source ?? "onboarding_auth_gate",
    });
    trackFunnelStep("clerk_sign_up_completed", {
      auth_provider: "clerk",
      signup_started_at: intent.startedAt,
      source: intent.source ?? "onboarding_auth_gate",
    });
    try {
      if (window.sessionStorage.getItem(COMPLETE_REGISTRATION_FIRED_KEY) !== "1") {
        trackAdCompleteRegistration({
          sessionId,
          source: "onboarding_auth_gate",
        });
        window.sessionStorage.setItem(COMPLETE_REGISTRATION_FIRED_KEY, "1");
      }
      window.sessionStorage.removeItem(SIGN_UP_INTENT_KEY);
    } catch {
      // Ignore strict privacy mode storage errors.
    }
  }, [authLoaded, isSignedIn, sessionId]);

  useEffect(() => {
    if (viewContentFired.current) return;
    viewContentFired.current = true;
    const signUpIntent = readSignUpIntent();
    fbViewContent("onboarding_quiz", {
      flow: "pre_signup_onboarding",
      step: 1,
    });
    trackPosthog("onboarding_viewed", {
      entry_point: signUpIntent ? "clerk_sign_up" : "direct",
      has_existing_session: Boolean(sessionId),
      career_category: careerCategory,
    });
    trackFunnelStep("onboarding_viewed", {
      entry_point: signUpIntent ? "clerk_sign_up" : "direct",
      has_existing_session: Boolean(sessionId),
      career_category: careerCategory,
    });
    trackPosthog("onboarding_step_viewed", { step: 1, step_name: STEP_NAMES[1] });
  }, [careerCategory, sessionId]);

  // Track every step transition in PostHog
  const prevStepRef = useRef<Step>(1);
  useEffect(() => {
    if (step === prevStepRef.current) return;
    trackPosthog("onboarding_step_viewed", {
      step,
      step_name: STEP_NAMES[step],
      session_id: sessionId,
      career_category: careerCategory,
    });
    trackFunnelStep(STEP_NAMES[step], {
      step,
      session_id: sessionId,
      career_category: careerCategory,
    });
    prevStepRef.current = step;
  }, [step, sessionId, careerCategory]);

  useEffect(() => {
    if (step !== 4) return;
    const timer = window.setInterval(() => {
      setAnalysisIndex((prev) => (prev + 1) % analysisSteps.length);
    }, 2000);
    return () => {
      window.clearInterval(timer);
    };
  }, [step]);

  useEffect(() => {
    if (step !== 5 || onboardingCompleteFired.current) return;
    onboardingCompleteFired.current = true;
    fbOnboardingComplete();
    trackPosthog("onboarding_step_completed", {
      step: 4,
      step_name: "ai_analysis",
      session_id: sessionId,
    });
    trackPosthog("onboarding_assessment_complete", {
      step: 5,
      step_name: "assessment_complete",
      session_id: sessionId,
      career_category: careerCategory,
      score: normalizedScore,
      risk_band: riskBand,
    });
    trackPosthog("onboarding_completed", {
      session_id: sessionId,
      career_category: careerCategory,
      score: normalizedScore,
      risk_band: riskBand,
    });
    trackFunnelStep("onboarding_completed", {
      session_id: sessionId,
      career_category: careerCategory,
      score: normalizedScore,
      risk_band: riskBand,
    });
  }, [step, sessionId, careerCategory, normalizedScore, riskBand]);

  const toggleGoal = (goal: GoalType) => {
    setSelectedGoals((prev) =>
      prev.includes(goal) ? prev.filter((entry) => entry !== goal) : [...prev, goal],
    );
  };

  const ensureSession = async () => {
    if (sessionId) {
      if (!sessionToken) {
        throw new Error("Onboarding session expired. Restart onboarding to continue.");
      }
      return { id: sessionId, userId: sessionUserId ?? "", token: sessionToken };
    }
    const acquisition = readClientAttributionEnvelope();
    const normalizedName = fullName.trim();
    const handleSeed = normalizedName || jobTitle.trim() || "new-learner";
    const payload = await postJson<OnboardingStartPayload>("/api/onboarding/start", {
      name: normalizedName || "New Learner",
      handleBase: handleSeed.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
      careerPathId: selectedCareer.path,
      acquisition: acquisition ?? undefined,
    });
    if (!payload.session?.id || !payload.session?.userId) {
      throw new Error("Unable to initialize onboarding session");
    }
    if (!payload.sessionToken) {
      throw new Error("Unable to initialize onboarding session token");
    }
    setSessionId(payload.session.id);
    setSessionUserId(payload.session.userId);
    setSessionToken(payload.sessionToken);
    try {
      window.sessionStorage.setItem(
        ONBOARDING_BOOTSTRAP_KEY,
        JSON.stringify({
          sessionId: payload.session.id,
          sessionUserId: payload.session.userId,
          sessionToken: payload.sessionToken,
        }),
      );
    } catch {
      // Ignore storage failures.
    }
    return { id: payload.session.id, userId: payload.session.userId, token: payload.sessionToken };
  };

  useEffect(() => {
    if (!hasMeaningfulInput && step < 2) return;
    if (sessionId || sessionWarmupStarted.current) return;
    sessionWarmupStarted.current = true;
    void ensureSession().catch(() => {
      sessionWarmupStarted.current = false;
    });
  }, [hasMeaningfulInput, step, sessionId]);

  const validateStepOne = () => {
    if (!fullName.trim()) return "Enter your full name.";
    if (!careerCategory) return "Select your career category.";
    if (careerCategory === "other" && !customCareerCategory.trim()) {
      return "Please specify your career category.";
    }
    if (!yearsExperience) return "Select years of experience.";
    return null;
  };

  const validateStepTwo = () => {
    if (!selectedGoals.length) return "Select at least one primary goal.";
    if (linkedinUrl.trim().length > 0) {
      try {
        const parsed = new URL(linkedinUrl.trim());
        if (!parsed.hostname.includes("linkedin.com")) {
          return "LinkedIn URL must be on linkedin.com.";
        }
      } catch {
        return "LinkedIn URL format is invalid.";
      }
    }
    return null;
  };

  const runLinkedInOAuth = async () => {
    setError(null);
    setBusy(true);
    try {
      const session = await ensureSession();
      trackPosthog("onboarding_linkedin_oauth_started", {
        session_id: session.id,
        source: "onboarding_step_work_details",
      });
      const redirectPath = sanitizeRedirectPath(
        `/onboarding?sessionId=${encodeURIComponent(session.id)}&oauth=linkedin_connected`,
      );
      const href =
        `/api/auth/linkedin/start?redirect=1` +
        `&sessionId=${encodeURIComponent(session.id)}` +
        `&redirectPath=${encodeURIComponent(redirectPath)}`;
      window.location.href = href;
    } catch (err) {
      trackPosthog("onboarding_linkedin_oauth_failed", {
        session_id: sessionId,
        reason: err instanceof Error ? err.message : "oauth_start_failed",
      });
      setError(err instanceof Error ? err.message : "Unable to start LinkedIn OAuth");
    } finally {
      setBusy(false);
    }
  };

  const uploadResume = async (file: File) => {
    setError(null);
    setResumeUploadBusy(true);
    try {
      const session = await ensureSession();
      trackPosthog("onboarding_resume_upload_started", {
        session_id: session.id,
        file_type: file.type,
        file_size: file.size,
      });
      const form = new FormData();
      form.append("sessionId", session.id);
      form.append("sessionToken", session.token);
      form.append("file", file);

      const res = await fetch("/api/onboarding/resume-upload", {
        method: "POST",
        body: form,
        credentials: "same-origin",
      });

      const data = (await res.json().catch(() => ({}))) as ResumeUploadPayload;
      if (!res.ok || !data.ok || !data.resume) {
        throw new Error(data.error?.message ?? "Unable to upload resume");
      }

      setResumeFile(file);
      setUploadedResumeName(data.resume.filename);
      trackPosthog("onboarding_resume_uploaded", {
        session_id: sessionId,
        file_type: file.type,
        file_size: file.size,
      });
    } catch (err) {
      trackPosthog("onboarding_resume_upload_failed", {
        session_id: sessionId,
        file_type: file.type,
        file_size: file.size,
        reason: err instanceof Error ? err.message : "resume_upload_failed",
      });
      setResumeFile(null);
      setUploadedResumeName(null);
      setError(err instanceof Error ? err.message : "Unable to upload resume");
    } finally {
      setResumeUploadBusy(false);
    }
  };

  const startAnalysis = async () => {
    setError(null);
    const stepOneError = validateStepOne();
    if (stepOneError) {
      trackValidationFailure(1, stepOneError, {
        career_category: careerCategory,
      });
      setStep(1);
      setError(stepOneError);
      return;
    }
    const stepTwoError = validateStepTwo();
    if (stepTwoError) {
      trackValidationFailure(2, stepTwoError, {
        has_linkedin: !!linkedinUrl.trim() || linkedinConnected,
        goals_count: selectedGoals.length,
      });
      setStep(2);
      setError(stepTwoError);
      return;
    }

    trackPosthog("onboarding_step_completed", {
      step: 3,
      step_name: "resume_review",
      has_resume: !!(uploadedResumeName || resumeFile),
      session_id: sessionId,
    });
    setStep(4);
    setBusy(true);
    trackPosthog("onboarding_analysis_started", {
      session_id: sessionId,
      career_category: careerCategory,
    });
    if (!quizStartFired.current) {
      quizStartFired.current = true;
      fbQuizStart();
    }
    try {
      const session = await ensureSession();
      const leadEventId = createAnalyticsEventId("lead");

      const answers = [
        { questionId: "career_experience", value: selectedExperience.score },
        { questionId: "ai_comfort", value: aiComfort },
        { questionId: "daily_work_complexity", value: Math.min(5, Math.max(1, Math.ceil(dailyWorkSummary.trim().length / 70))) },
        { questionId: "linkedin_context", value: linkedinUrl.trim() ? 5 : 2 },
        { questionId: "resume_context", value: uploadedResumeName || resumeFile ? 4 : 2 },
      ];

      const completed = await postJson<OnboardingCompletePayload>("/api/onboarding/complete", {
        sessionId: session.id,
        sessionToken: session.token,
        careerPathId: selectedCareer.path,
        careerCategoryLabel: selectedCareerLabel,
        jobTitle: jobTitle.trim() || undefined,
        yearsExperience,
        companySize: companySize || null,
        dailyWorkSummary: dailyWorkSummary.trim(),
        keySkills: keySkills.trim() || null,
        aiComfort,
        linkedinUrl: linkedinUrl.trim() || null,
        resumeFilename: uploadedResumeName ?? resumeFile?.name ?? null,
        situation,
        goals: selectedGoals,
        answers,
      });

      const score = completed.assessment?.score ?? 0;
      const recommended = completed.assessment?.recommendedCareerPathIds ?? [];
      setAssessmentScore(score);
      setRecommendedPaths(recommended);
      if (!quizCompleteFired.current) {
        quizCompleteFired.current = true;
        fbQuizComplete(score, recommended, leadEventId);
        trackAdLead({
          score,
          sessionId: session.id,
          careerCategory,
          source: "onboarding_assessment_complete",
          eventId: leadEventId,
        });
      }
      setStep(5);
      try {
        window.localStorage.removeItem(ONBOARDING_DRAFT_KEY);
      } catch {
        // Ignore storage failures.
      }

      if (completed.signedIn) {
        setNextRedirectHref(`/dashboard/?welcome=1&onboardingSessionId=${encodeURIComponent(session.id)}`);
        setNextRedirectLabel("Open Dashboard");
        return;
      }

      try {
        window.sessionStorage.setItem(
          PENDING_SESSION_KEY,
          JSON.stringify({ sessionId: session.id, ts: Date.now() }),
        );
      } catch {
        // Ignore storage failures.
      }

      const redirectPath = `/dashboard/?welcome=1&onboardingSessionId=${encodeURIComponent(session.id)}`;
      setNextRedirectHref(redirectPath);
      setNextRedirectLabel("Create Account to Continue");
    } catch (err) {
      trackPosthog("onboarding_analysis_failed", {
        session_id: sessionId,
        career_category: careerCategory,
        reason: err instanceof Error ? err.message : "analysis_failed",
      });
      setError(err instanceof Error ? err.message : "Unable to complete onboarding");
      setStep(3);
    } finally {
      setBusy(false);
    }
  };

  const progressPercent = useMemo(() => {
    if (step <= 1) return 20;
    if (step === 2) return 45;
    if (step === 3) return 70;
    if (step === 4) return 85;
    return 100;
  }, [step]);

  if (!isSignedIn) {
    return (
      <div
        id="onboarding-react-root"
        className="relative min-h-screen bg-[#f8fafc] text-[#1e293b] overflow-x-hidden px-4 py-10 md:px-6"
        data-onboarding-react-root="1"
      >
        <div className="max-w-3xl mx-auto">
          <div className="text-center mb-8">
            <a href="/" className="inline-flex items-center gap-3 mb-5">
              <img src="/assets/branding/brand_brain_icon.svg" alt="My AI Skill Tutor" className="h-11 w-11 object-contain" />
              <span className="font-[Outfit] font-bold text-4xl tracking-tight text-[#0f172a]">My AI Skill Tutor</span>
            </a>
          </div>
          <div className="bg-white p-8 md:p-10 rounded-2xl border border-slate-200 shadow-sm">
            <h2 className="text-3xl font-[Outfit] font-semibold text-[#0f172a]">Create your account first</h2>
            <p className="mt-3 text-slate-600">
              Start with {recommendedAuthSource} for the fastest setup, then finish your personalized assessment.
            </p>
            <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center">
              <SignUpButton mode="modal" forceRedirectUrl="/onboarding/?post_signup=1" fallbackRedirectUrl="/onboarding/?post_signup=1">
                <button
                  type="button"
                  className="btn btn-primary px-8"
                  onClick={() => {
                    try {
                      window.sessionStorage.setItem(
                        SIGN_UP_INTENT_KEY,
                        JSON.stringify({ startedAt: Date.now(), source: "onboarding_auth_gate" }),
                      );
                    } catch {
                      // Ignore storage failures.
                    }
                    trackPosthog("auth_sign_up_cta_clicked", {
                      auth_provider: "clerk",
                      source: "onboarding_auth_gate",
                    });
                    trackPosthog("clerk_sign_up_started", {
                      auth_provider: "clerk",
                      source: "onboarding_auth_gate",
                    });
                    trackFunnelStep("clerk_sign_up_started", {
                      auth_provider: "clerk",
                      source: "onboarding_auth_gate",
                    });
                    trackPosthog("auth_clerk_sign_up_viewed", {
                      auth_provider: "clerk",
                      source: "onboarding_auth_gate",
                    });
                  }}
                >
                  Continue with Social Login
                </button>
              </SignUpButton>
              <a className="btn btn-secondary" href="/sign-in?redirect_url=/onboarding/">
                I already have an account
              </a>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      id="onboarding-react-root"
      className="relative min-h-screen bg-[#f8fafc] text-[#1e293b] overflow-x-hidden px-4 py-10 md:px-6"
      data-onboarding-react-root="1"
    >
      <div className="max-w-5xl mx-auto">
        <div className="text-center mb-8">
          <a href="/" className="inline-flex items-center gap-3 mb-5">
            <img src="/assets/branding/brand_brain_icon.svg" alt="My AI Skill Tutor" className="h-11 w-11 object-contain" />
            <span className="font-[Outfit] font-bold text-4xl tracking-tight text-[#0f172a]">My AI Skill Tutor</span>
          </a>
        </div>

        <div className="bg-white p-8 md:p-10 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-3xl font-[Outfit] font-semibold text-[#0f172a]">
              {step === 1 && "Basic Information"}
              {step === 2 && "Work Details"}
              {step === 3 && "Resume & Review"}
              {step === 4 && "AI Analysis"}
              {step === 5 && "Assessment Complete"}
            </h2>
            <div className="flex gap-2">
              {[1, 2, 3, 4, 5].map((index) => (
                <span
                  key={index}
                  className={`inline-block h-4 w-4 rounded-full ${
                    index < step
                      ? "bg-emerald-500"
                      : index === step
                        ? "bg-emerald-500"
                        : "bg-slate-200"
                  }`}
                />
              ))}
            </div>
          </div>

          <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden mb-8">
            <div className="h-full bg-gradient-to-r from-emerald-500 to-teal-400 rounded-full transition-all duration-500" style={{ width: `${progressPercent}%` }} />
          </div>

          {error ? (
            <div className="mb-6 rounded-xl border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          ) : null}

          {linkedinConnected ? (
            <div className="mb-6 rounded-xl border border-emerald-300 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
              LinkedIn connected successfully. You can continue the onboarding quiz.
            </div>
          ) : null}

          {step === 1 ? (
            <div className="space-y-5">
              <div>
                <label className="block text-sm font-medium mb-2 text-[#334155]">Full Name</label>
                <input
                  type="text"
                  value={fullName}
                  onChange={(event) => setFullName(event.target.value)}
                  placeholder="e.g., Miguel Sanchez-Grice"
                  className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-[#1e293b] placeholder:text-slate-400 focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-100 transition-colors"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2 text-[#334155]">Career Category</label>
                <select
                  value={careerCategory}
                  onChange={(event) =>
                    setCareerCategory(event.target.value as (typeof careerCategoryOptions)[number]["value"])
                  }
                  className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-[#1e293b] placeholder:text-slate-400 focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-100 transition-colors"
                >
                  {careerCategoryOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>

              {careerCategory === "other" ? (
                <div>
                  <label className="block text-sm font-medium mb-2 text-[#334155]">Please specify your career category</label>
                  <input
                    type="text"
                    value={customCareerCategory}
                    onChange={(event) => setCustomCareerCategory(event.target.value)}
                    placeholder="e.g., Sales, Operations, HR"
                    className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-[#1e293b] placeholder:text-slate-400 focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-100 transition-colors"
                  />
                </div>
              ) : null}

              <div>
                <label className="block text-sm font-medium mb-2 text-[#334155]">Job Title (Optional)</label>
                <input
                  type="text"
                  value={jobTitle}
                  onChange={(event) => setJobTitle(event.target.value)}
                  placeholder={selectedCareerContent.jobTitlePlaceholder}
                  className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-[#1e293b] placeholder:text-slate-400 focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-100 transition-colors"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2 text-[#334155]">Years of Experience</label>
                <select
                  value={yearsExperience}
                  onChange={(event) =>
                    setYearsExperience(event.target.value as (typeof yearsExperienceOptions)[number]["value"])
                  }
                  className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-[#1e293b] placeholder:text-slate-400 focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-100 transition-colors"
                >
                  {yearsExperienceOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2 text-[#334155]">Company Size (Optional)</label>
                <select
                  value={companySize}
                  onChange={(event) => setCompanySize(event.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-[#1e293b] placeholder:text-slate-400 focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-100 transition-colors"
                >
                  {companySizeOptions.map((option) => (
                    <option key={option.value || "none"} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          ) : null}

          {step === 2 ? (
            <div className="space-y-5">
              <div>
                <label className="block text-sm font-medium mb-2 text-[#334155]">Daily Work Summary</label>
                <textarea
                  rows={4}
                  value={dailyWorkSummary}
                  onChange={(event) => setDailyWorkSummary(event.target.value)}
                  placeholder={selectedCareerContent.workSummaryPlaceholder}
                  className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-[#1e293b] placeholder:text-slate-400 focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-100 transition-colors"
                />
                <p className="mt-2 text-sm text-slate-500">
                  {dailyWorkSummary.trim().length}/300 characters (recommended 20+ for better recommendations)
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2 text-[#334155]">Key Skills &amp; Tools (Optional)</label>
                <textarea
                  rows={3}
                  value={keySkills}
                  onChange={(event) => setKeySkills(event.target.value)}
                  placeholder={selectedCareerContent.skillsPlaceholder}
                  className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-[#1e293b] placeholder:text-slate-400 focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-100 transition-colors"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2 text-[#334155]">
                  <i className="fa-brands fa-linkedin text-[#0a66c2] mr-2" />
                  LinkedIn Profile URL
                </label>
                <input
                  type="url"
                  value={linkedinUrl}
                  onChange={(event) => setLinkedinUrl(event.target.value)}
                  placeholder="https://linkedin.com/in/your-profile"
                  className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-[#1e293b] placeholder:text-slate-400 focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-100 transition-colors"
                />
                <p className="mt-2 text-sm text-slate-500">We use this for profile context and recommendations.</p>
                <button
                  type="button"
                  onClick={() => {
                    void runLinkedInOAuth();
                  }}
                  disabled={busy}
                  className="mt-3 btn btn-secondary"
                >
                  <i className="fa-brands fa-linkedin mr-2" />
                  Connect LinkedIn OAuth
                </button>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2 text-[#334155]">Current Situation</label>
                <select
                  value={situation}
                  onChange={(event) => setSituation(event.target.value as SituationStatus)}
                  className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-[#1e293b] placeholder:text-slate-400 focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-100 transition-colors"
                >
                  {situationOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2 text-[#334155]">Primary Goals</label>
                <div className="grid gap-2 sm:grid-cols-2">
                  {goalOptions.map((goal) => {
                    const checked = selectedGoals.includes(goal.value);
                    return (
                      <label
                        key={goal.value}
                        className={`rounded-xl border px-3 py-2 text-sm cursor-pointer ${
                          checked ? "border-emerald-400 bg-emerald-50 text-emerald-800" : "border-slate-200 bg-white text-[#334155] hover:border-emerald-300 transition-colors"
                        }`}
                      >
                        <input
                          type="checkbox"
                          className="mr-2 align-middle"
                          checked={checked}
                          onChange={() => toggleGoal(goal.value)}
                        />
                        {goal.label}
                      </label>
                    );
                  })}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2 text-[#334155]">How comfortable are you with AI tools today?</label>
                <div className="grid grid-cols-3 gap-2">
                  {aiComfortOptions.map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => setAiComfort(option.value)}
                      className={`rounded-xl border px-3 py-2 text-sm ${
                        aiComfort === option.value
                          ? "border-emerald-500 bg-emerald-50 text-emerald-700"
                          : "border-slate-200 bg-white text-[#334155] hover:border-emerald-300 transition-colors"
                      }`}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          ) : null}

          {step === 3 ? (
            <div className="space-y-6">
              <div>
                <label className="block text-sm font-medium mb-3 text-[#334155]">Upload Resume (Optional)</label>
                <label className="block rounded-2xl border-2 border-dashed border-slate-300 bg-slate-50 px-6 py-10 text-center cursor-pointer hover:border-emerald-400 hover:bg-emerald-50/40 transition-colors">
                  <input
                    type="file"
                    accept=".pdf,.doc,.docx,.txt"
                    className="hidden"
                    onChange={(event) => {
                      const file = event.target.files?.[0] ?? null;
                      if (!file) {
                        setResumeFile(null);
                        setUploadedResumeName(null);
                        return;
                      }
                      void uploadResume(file);
                    }}
                  />
                  <div className="mx-auto mb-4 h-16 w-16 rounded-full bg-emerald-50 flex items-center justify-center">
                    <i className="fa-solid fa-upload text-2xl text-emerald-500" />
                  </div>
                  <p className="text-xl font-medium text-[#0f172a]">
                    {resumeUploadBusy
                      ? "Uploading resume..."
                      : uploadedResumeName ?? resumeFile?.name ?? "Drop your resume here"}
                  </p>
                  <p className="text-sm text-slate-500 mt-2">
                    {resumeUploadBusy
                      ? "Please wait while we save your file"
                      : uploadedResumeName
                        ? "File uploaded successfully"
                        : "Supports PDF, DOC, DOCX, TXT (max 10MB)"}
                  </p>
                </label>
              </div>

              <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5">
                <h4 className="text-xl font-semibold text-[#0f172a] mb-2">Ready for AI Analysis</h4>
                <ul className="space-y-2 text-slate-500">
                  <li><i className="fa-solid fa-robot mr-2 text-emerald-600" />Your responses personalize your tutor path.</li>
                  <li><i className="fa-regular fa-clock mr-2 text-emerald-600" />Analysis typically takes 30-60 seconds.</li>
                  <li><i className="fa-solid fa-shield mr-2 text-emerald-600" />LinkedIn and resume context improves recommendations.</li>
                </ul>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
                <h4 className="text-xl font-semibold text-[#0f172a] mb-3">Review Your Information</h4>
                <div className="grid gap-2 text-[#0f172a]">
                  <p><strong>Role:</strong> {jobTitle || "Not provided"} ({selectedCareerLabel})</p>
                  <p><strong>Experience:</strong> {selectedExperience.label}</p>
                  <p><strong>Company Size:</strong> {companySize || "Not specified"}</p>
                  <p><strong>Resume:</strong> {uploadedResumeName || resumeFile ? "Uploaded" : "Not provided"}</p>
                  <p><strong>LinkedIn:</strong> {linkedinUrl.trim() ? "Provided" : linkedinConnected ? "Connected via OAuth" : "Not provided"}</p>
                </div>
              </div>
            </div>
          ) : null}

          {step === 4 ? (
            <div className="py-12 text-center">
              <div className="mx-auto mb-6 h-20 w-20 rounded-full border-4 border-emerald-500 border-t-transparent animate-spin" />
              <h3 className="text-3xl font-[Outfit] font-semibold text-[#0f172a] mb-5">AI Analysis in Progress</h3>
              <div className="max-w-xl mx-auto rounded-2xl border border-emerald-200 bg-emerald-50 px-5 py-4 text-lg text-[#0f172a]">
                <i className="fa-solid fa-spinner animate-spin mr-3 text-emerald-600" />
                {analysisSteps[analysisIndex]}
              </div>
            </div>
          ) : null}

          {step === 5 ? (
            <div className="space-y-8">
              <div className="flex flex-wrap gap-2">
                {careerCategoryOptions.map((option) => (
                  <span
                    key={option.value}
                    className={`rounded-full border px-4 py-1 text-sm ${
                      option.value === careerCategory
                        ? "border-emerald-500 bg-emerald-500 text-white"
                        : "border-slate-200 bg-white text-slate-600 hover:border-emerald-300 transition-colors"
                    }`}
                  >
                    {option.label}
                  </span>
                ))}
              </div>

              <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
                <div className="space-y-4">
                  <h3 className="text-3xl font-[Outfit] font-semibold text-[#0f172a]">{activeAssessmentTemplate.title}</h3>
                  <div className="flex items-center gap-3 text-sm">
                    <span
                      className="rounded-full px-3 py-1 font-semibold"
                      style={{ backgroundColor: `${riskColor}1a`, color: riskColor }}
                    >
                      {riskBand} Risk ({normalizedScore}/100)
                    </span>
                    <span className="text-slate-500">Timeline: {riskTimeline}</span>
                  </div>
                  <p className="text-slate-500">{activeAssessmentTemplate.description}</p>

                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
                    <h4 className="text-2xl font-[Outfit] text-[#0f172a] mb-3">Key Risk Areas</h4>
                    <ul className="space-y-2">
                      {activeAssessmentTemplate.riskAreas.map((item) => {
                        const dotColor =
                          item.level === "High" ? "#dc2626" : item.level === "Medium" ? "#d97706" : "#16a34a";
                        return (
                          <li key={item.label} className="flex items-start gap-3 text-[#0f172a]">
                            <span className="mt-2 inline-block h-2.5 w-2.5 rounded-full" style={{ backgroundColor: dotColor }} />
                            <span>
                              {item.label} ({item.level} Risk)
                            </span>
                          </li>
                        );
                      })}
                    </ul>
                  </div>

                  <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5">
                    <h4 className="text-2xl font-[Outfit] text-[#0f172a] mb-3">Recommended Actions</h4>
                    <ul className="list-disc list-inside space-y-2 text-[#0f172a]">
                      {activeAssessmentTemplate.recommendedActions.map((action) => (
                        <li key={action}>{action}</li>
                      ))}
                    </ul>
                  </div>
                </div>

                <div className="rounded-2xl border border-slate-200 bg-white shadow-sm p-5">
                  <div className="mx-auto relative h-36 w-36">
                    <div
                      className="h-full w-full rounded-full"
                      style={{
                        background: `conic-gradient(${riskColor} ${normalizedScore * 3.6}deg, #d9e1ee 0deg)`,
                      }}
                    />
                    <div className="absolute inset-3 rounded-full bg-white flex flex-col items-center justify-center">
                      <span className="text-5xl font-bold" style={{ color: riskColor }}>
                        {normalizedScore}
                      </span>
                      <span className="text-sm font-semibold" style={{ color: riskColor }}>
                        {riskBand} Risk
                      </span>
                    </div>
                  </div>

                  <h4 className="mt-6 text-3xl font-[Outfit] text-[#0f172a] text-center">{activeAssessmentTemplate.title}</h4>
                  <p className="text-center text-slate-500 mb-4">Risk Assessment Report</p>

                  <div className="space-y-3">
                    {activeAssessmentTemplate.riskAreas.slice(0, 2).map((item) => (
                      <div key={item.label} className="rounded-xl border border-slate-200 p-3">
                        <div className="flex items-center justify-between gap-3">
                          <p className="font-semibold text-[#0f172a]">{item.label}</p>
                          <span
                            className="rounded-full px-2 py-0.5 text-xs font-semibold"
                            style={{
                              backgroundColor:
                                item.level === "High" ? "#fecaca" : item.level === "Medium" ? "#fde68a" : "#bbf7d0",
                              color: item.level === "High" ? "#991b1b" : item.level === "Medium" ? "#92400e" : "#166534",
                            }}
                          >
                            {item.level}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>

                  <p className="mt-4 text-sm text-center text-slate-500">
                    <i className="fa-regular fa-clock mr-2" />
                    Timeline: {riskTimeline}
                  </p>
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-3">
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
                  <h4 className="text-xl font-[Outfit] text-[#0f172a] mb-2">AI Tool Analysis</h4>
                  <p className="text-slate-500">{activeAssessmentTemplate.aiToolAnalysis}</p>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
                  <h4 className="text-xl font-[Outfit] text-[#0f172a] mb-2">Career Strategies</h4>
                  <p className="text-slate-500">{activeAssessmentTemplate.careerStrategies}</p>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
                  <h4 className="text-xl font-[Outfit] text-[#0f172a] mb-2">Action Plan</h4>
                  <ul className="list-disc list-inside space-y-1 text-slate-500">
                    {activeAssessmentTemplate.actionPlan.map((stepItem) => (
                      <li key={stepItem}>{stepItem}</li>
                    ))}
                  </ul>
                </div>
              </div>

              {recommendedPaths.length ? (
                <div className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-[#0f172a]">
                  Recommended skill tracks: {recommendedPaths.join(", ")}
                </div>
              ) : null}

              <div className="flex flex-col gap-3 border-t border-slate-200 pt-6 md:flex-row md:items-center md:justify-between">
                <p className="text-sm text-slate-500">
                  Review complete. Continue to activate your tutor dashboard and personalized modules.
                </p>
                {!isSignedIn ? (
                  <SignUpButton mode="modal" forceRedirectUrl={nextRedirectHref ?? "/dashboard/?welcome=1"} fallbackRedirectUrl={nextRedirectHref ?? "/dashboard/?welcome=1"}>
                    <button
                      type="button"
                    className="btn btn-primary px-8"
                    disabled={!nextRedirectHref || navigatingAfterSummary}
                    onClick={() => {
                        trackPosthog("assessment_summary_cta_clicked", {
                          session_id: sessionId,
                          destination: nextRedirectHref,
                          action: "create_account_to_continue",
                          career_category: careerCategory,
                          score: normalizedScore,
                          risk_band: riskBand,
                        });
                        try {
                          window.sessionStorage.setItem(
                            SIGN_UP_INTENT_KEY,
                            JSON.stringify({ startedAt: Date.now(), source: "assessment_complete_cta" }),
                          );
                        } catch {
                          // Ignore storage failures.
                        }
                        trackPosthog("auth_sign_up_cta_clicked", {
                          auth_provider: "clerk",
                          source: "assessment_complete_cta",
                        });
                        trackPosthog("clerk_sign_up_started", {
                          auth_provider: "clerk",
                          source: "assessment_complete_cta",
                        });
                        trackFunnelStep("clerk_sign_up_started", {
                          auth_provider: "clerk",
                          source: "assessment_complete_cta",
                        });
                      }}
                    >
                      {nextRedirectLabel}
                      <i className="fa-solid fa-arrow-right ml-2" />
                    </button>
                  </SignUpButton>
                ) : (
                  <button
                    type="button"
                    className="btn btn-primary px-8"
                    onClick={continueAfterSummary}
                    disabled={!nextRedirectHref || navigatingAfterSummary}
                  >
                    {navigatingAfterSummary ? "Opening..." : nextRedirectLabel}
                    <i className="fa-solid fa-arrow-right ml-2" />
                  </button>
                )}
              </div>
            </div>
          ) : null}

          {step < 4 ? (
            <div className="mt-8 flex items-center justify-between border-t border-slate-200 pt-6">
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => {
                  setError(null);
                  trackPosthog("onboarding_step_back_clicked", {
                    step,
                    step_name: STEP_NAMES[step],
                    session_id: sessionId,
                  });
                  setStep((prev) => (prev > 1 ? ((prev - 1) as Step) : prev));
                }}
                disabled={busy || resumeUploadBusy || step === 1}
              >
                <i className="fa-solid fa-arrow-left mr-2" />
                Back
              </button>
              {step < 3 ? (
                <button
                  type="button"
                  className="btn btn-primary px-8"
                  onClick={() => {
                    setError(null);
                    if (step === 1) {
                      const validation = validateStepOne();
                      if (validation) {
                        trackValidationFailure(1, validation, {
                          career_category: careerCategory,
                        });
                        setError(validation);
                        return;
                      }
                      if (!onboardingStartFired.current) {
                        onboardingStartFired.current = true;
                        fbOnboardingStart();
                      }
                      trackPosthog("onboarding_step_completed", {
                        step: 1,
                        step_name: "basic_information",
                        career_category: careerCategory,
                        job_title: jobTitle,
                        years_experience: yearsExperience,
                        session_id: sessionId,
                      });
                    }
                    if (step === 2) {
                      const validation = validateStepTwo();
                      if (validation) {
                        trackValidationFailure(2, validation, {
                          has_linkedin: !!linkedinUrl.trim() || linkedinConnected,
                          goals_count: selectedGoals.length,
                        });
                        setError(validation);
                        return;
                      }
                      trackPosthog("onboarding_step_completed", {
                        step: 2,
                        step_name: "work_details",
                        has_linkedin: !!linkedinUrl.trim() || linkedinConnected,
                        goals_count: selectedGoals.length,
                        ai_comfort: aiComfort,
                        situation,
                        session_id: sessionId,
                      });
                    }
                    setStep((prev) => (prev < 5 ? ((prev + 1) as Step) : prev));
                  }}
                  disabled={busy || resumeUploadBusy}
                >
                  Continue <i className="fa-solid fa-arrow-right ml-2" />
                </button>
              ) : (
                <button
                  type="button"
                  className="btn btn-primary px-8"
                  onClick={() => {
                    void startAnalysis();
                  }}
                  disabled={busy || resumeUploadBusy}
                >
                  <i className="fa-solid fa-robot mr-2" />
                  {busy ? "Analyzing..." : "Start AI Analysis"}
                </button>
              )}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
