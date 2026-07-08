"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { SignUpButton, useAuth, useUser } from "@clerk/nextjs";
import { getCareerPath, type GoalType, type SituationStatus } from "@aitutor/shared";
import {
  fbViewContent,
} from "@/lib/fb-pixel";
import {
  trackAdCompleteRegistration,
  trackAdLead,
  trackAdOnboardingComplete,
  trackAdOnboardingStart,
  trackAdQuizStart,
} from "@/lib/ad-conversions";
import { captureAnalyticsEvent, isMetaAttributionSource } from "@/lib/analytics";
import { readClientAttributionEnvelope } from "@/lib/attribution";
import {
  COMPLETE_REGISTRATION_FIRED_KEY,
  PENDING_SESSION_KEY,
  SIGN_UP_COMPLETION_TRACKED_KEY,
  SIGN_UP_INTENT_KEY,
} from "@/components/auth-tracking-keys";

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
  readiness?: OnboardingReadiness | null;
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
  linkedinUrl: string;
  selectedGoals: GoalType[];
  aiComfort: number;
  uploadedResumeName: string | null;
  ts: number;
};

type OnboardingReportSnapshot = OnboardingDraft & {
  sessionId: string;
  sessionUserId: string | null;
  sessionToken: string | null;
  assessmentScore: number;
  recommendedPaths: string[];
  readiness: OnboardingReadiness | null;
  nextRedirectHref: string;
  nextRedirectLabel: string;
};

/**
 * Internal-only band over the deterministic signal — kept for analytics
 * continuity (`risk_band` event property). Never rendered (UX audit F1).
 */
type RiskBand = "Low" | "Moderate" | "High";

/** Readiness summary returned by /api/onboarding/complete (UX audit F1). */
type OnboardingReadiness = {
  source: "linked" | "generated";
  readinessScore: number;
  headline: string;
  reportPath: string;
};

/** Prefill context from a linked anonymous assessment (UX audit F2). */
type AssessmentContextPayload = {
  ok: boolean;
  linked?: boolean;
  assessment?: {
    careerPathId: string | null;
    careerCategoryLabel: string | null;
    jobTitle: string | null;
    yearsExperience: string | null;
    companySize: string | null;
    situation: string | null;
    goals: string[];
    aiComfort: number | null;
    linkedinUrl: string | null;
  };
  report?: {
    readinessScore: number;
    headline: string;
    reportPath: string;
  };
};

const analysisSteps = [
  "Reviewing your role and goals",
  "Scoring your AI readiness for your role",
  "Ranking your skill gaps by market impact",
  "Drafting your 30-day plan",
  "Preparing your personalized tutor setup",
];

const careerCategoryOptions = [
  { value: "product-manager", label: "Product Manager", path: "product-management" },
  { value: "sales", label: "Sales", path: "sales-revops" },
  { value: "customer-service", label: "Customer Service", path: "customer-support" },
  { value: "operations", label: "Operations", path: "operations" },
  { value: "hr", label: "Human Resources", path: "human-resources" },
  { value: "designer", label: "Designer", path: "branding-design" },
  { value: "marketing", label: "Marketing", path: "marketing-seo" },
  { value: "accounting", label: "Accounting", path: "operations" },
  { value: "legal", label: "Legal", path: "operations" },
  { value: "software-engineering", label: "Software Engineering", path: "software-engineering" },
  { value: "other", label: "Other", path: "operations" },
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
  sales: {
    subtitle: "Specialized analysis for pipeline workflows, outreach systems, and revenue execution",
    jobTitlePlaceholder: "e.g., Sales Manager, Account Executive, RevOps Lead",
    workSummaryPlaceholder:
      "Describe your sales workflow, lead flow, qualification process, forecasting cadence, and repetitive tasks your team runs each week...",
    skillsPlaceholder:
      "e.g., HubSpot, Salesforce, Outreach, Apollo, Pipeline Reporting, Discovery Calls...",
  },
  "customer-service": {
    subtitle: "Specialized analysis for support workflows, customer response quality, and ticket operations",
    jobTitlePlaceholder: "e.g., Customer Support Manager, Support Lead, Customer Success Manager",
    workSummaryPlaceholder:
      "Describe your support workflow, ticket volume, escalation handling, and the recurring customer issues your team solves...",
    skillsPlaceholder:
      "e.g., Zendesk, Intercom, Knowledge Base Ops, Escalation Management, Customer Communication...",
  },
  operations: {
    subtitle: "Specialized analysis for process optimization, handoffs, and workflow automation",
    jobTitlePlaceholder: "e.g., Operations Manager, BizOps Lead, Program Manager",
    workSummaryPlaceholder:
      "Describe recurring operational workflows, handoffs, reporting loops, and where manual work slows your team down...",
    skillsPlaceholder:
      "e.g., Airtable, Notion, Zapier, Make, Process Documentation, KPI Tracking...",
  },
  hr: {
    subtitle: "Specialized analysis for hiring operations, people workflows, and HR process execution",
    jobTitlePlaceholder: "e.g., HR Manager, People Ops Partner, Talent Acquisition Lead",
    workSummaryPlaceholder:
      "Describe hiring and people workflows like screening, interview loops, policy rollouts, and employee support requests...",
    skillsPlaceholder:
      "e.g., Greenhouse, Lever, ATS Operations, Interview Coordination, Policy Workflows...",
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
  { value: "find_new_role", label: "Find a new role" },
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
const ONBOARDING_REPORT_SNAPSHOT_KEY = "ai_tutor_onboarding_report_snapshot_v1";

function getRiskBand(score: number): RiskBand {
  if (score >= 70) return "High";
  if (score >= 45) return "Moderate";
  return "Low";
}

/** Same bands as the tokenized report page — one score, one framing. */
function readinessBand(score: number) {
  if (score >= 70) return { label: "AI-Ready", color: "#10b981" };
  if (score >= 45) return { label: "Building", color: "#f59e0b" };
  return { label: "At Risk", color: "#ef4444" };
}

async function getJson<T>(url: string): Promise<T> {
  const res = await fetch(url, {
    headers: { "cache-control": "no-store" },
    credentials: "same-origin",
  });
  const data = (await res.json().catch(() => ({}))) as T & { ok?: boolean };
  if (!res.ok || !data || (typeof data === "object" && "ok" in data && !data.ok)) {
    throw new Error("Request failed");
  }
  return data;
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
  if (source.includes("linkedin")) return "social login";
  if (source === "x" || source.includes("twitter")) return "X sign-in";
  if (isMetaAttributionSource(source)) return "Facebook sign-in";
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

/** Maps a linked assessment's career path/label back to a category option (F2 prefill). */
function categoryForAssessment(
  careerPathId: string | null,
  label: string | null,
): { value: (typeof careerCategoryOptions)[number]["value"]; custom: string } {
  const normalizedLabel = label?.trim().toLowerCase() ?? "";
  const byLabel = careerCategoryOptions.find((option) => option.label.toLowerCase() === normalizedLabel);
  if (byLabel) return { value: byLabel.value, custom: "" };
  const byPath = careerCategoryOptions.find((option) => option.path === careerPathId);
  if (byPath && byPath.value !== "other") return { value: byPath.value, custom: "" };
  return { value: "other", custom: label?.trim() || "" };
}

function comfortOptionFor(aiComfort: number | null): number | null {
  if (aiComfort === null || Number.isNaN(aiComfort)) return null;
  if (aiComfort <= 2) return 2;
  if (aiComfort >= 5) return 5;
  return 3;
}

export function OnboardingIntake() {
  const { isLoaded: authLoaded, userId: authUserId } = useAuth();
  const { user } = useUser();
  const isSignedIn = Boolean(authUserId);
  const [step, setStep] = useState<Step>(1);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [analysisIndex, setAnalysisIndex] = useState(0);
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
  // Readiness finale (UX audit F1) + linked-assessment collapse (F2).
  const [readiness, setReadiness] = useState<OnboardingReadiness | null>(null);
  const [linkedContext, setLinkedContext] = useState<AssessmentContextPayload | null>(null);
  const assessmentContextFetched = useRef(false);
  const [fullName, setFullName] = useState("");
  const [customCareerCategory, setCustomCareerCategory] = useState("");
  const [jobTitle, setJobTitle] = useState("");
  const [yearsExperience, setYearsExperience] = useState<(typeof yearsExperienceOptions)[number]["value"]>("1-3");
  const [companySize, setCompanySize] = useState("");
  const [situation, setSituation] = useState<SituationStatus>("employed");
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
  const normalizedScore = useMemo(() => {
    if (assessmentScore === null || Number.isNaN(assessmentScore)) return 0;
    const raw = assessmentScore <= 1 ? assessmentScore * 100 : assessmentScore;
    return Math.max(0, Math.min(100, Math.round(raw)));
  }, [assessmentScore]);
  // Analytics-only band over the deterministic signal — never rendered (F1).
  const riskBand = useMemo(() => getRiskBand(normalizedScore), [normalizedScore]);
  // Collapsed flow (F2): a linked assessment removes the re-asking steps.
  const collapsed = Boolean(linkedContext?.linked && linkedContext.report);
  const readinessScoreBand = useMemo(
    () => readinessBand(readiness?.readinessScore ?? 0),
    [readiness?.readinessScore],
  );
  const recommendedPathDetails = useMemo(() => {
    const pathIds = recommendedPaths.length ? recommendedPaths : [selectedCareer.path];
    return pathIds
      .map((pathId) => getCareerPath(pathId))
      .filter((path): path is NonNullable<ReturnType<typeof getCareerPath>> => Boolean(path))
      .slice(0, 3);
  }, [recommendedPaths, selectedCareer.path]);
  const recommendedAuthSource = useMemo(() => preferredSourceLabel(), []);
  const hasLinkedInUrl = useMemo(() => Boolean(linkedinUrl.trim()), [linkedinUrl]);
  const hasResume = useMemo(() => Boolean(uploadedResumeName || resumeFile), [resumeFile, uploadedResumeName]);
  const onboardingAnalyticsContext = useMemo(
    () => ({
      session_id: sessionId,
      career_category: careerCategory,
      career_path_id: selectedCareer.path,
      career_category_label: selectedCareerLabel,
      years_experience: yearsExperience,
      company_size: companySize || null,
      situation,
      ai_comfort: aiComfort,
      goals: selectedGoals,
      goals_count: selectedGoals.length,
      primary_goal: selectedGoals[0] ?? null,
      has_linkedin_url: hasLinkedInUrl,
      has_resume: hasResume,
    }),
    [
      aiComfort,
      careerCategory,
      companySize,
      hasLinkedInUrl,
      hasResume,
      selectedCareer.path,
      selectedCareerLabel,
      selectedGoals,
      sessionId,
      situation,
      yearsExperience,
    ],
  );
  const assessmentAnswerProps = useMemo(
    () => ({
      answer_career_experience: selectedExperience.score,
      answer_ai_comfort: aiComfort,
      answer_daily_work_complexity: Math.min(5, Math.max(1, selectedExperience.score + (aiComfort >= 4 ? 1 : 0))),
      answer_linkedin_context: hasLinkedInUrl ? 5 : 2,
      answer_resume_context: hasResume ? 4 : 2,
    }),
    [aiComfort, hasLinkedInUrl, hasResume, selectedExperience.score],
  );
  const hasMeaningfulInput = useMemo(() => {
    const hasDefaultGoals =
      selectedGoals.length === 1 && selectedGoals[0] === "upskill_current_job";
    return Boolean(
      fullName.trim() ||
        customCareerCategory.trim() ||
        jobTitle.trim() ||
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
    fullName,
    jobTitle,
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
      fullName,
      jobTitle,
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
      ...onboardingAnalyticsContext,
      ...assessmentAnswerProps,
      destination: nextRedirectHref,
      action: "open_dashboard",
      score: normalizedScore,
      risk_band: riskBand,
    });
    trackPosthog("onboarding_continue_to_dashboard", {
      ...onboardingAnalyticsContext,
      ...assessmentAnswerProps,
      destination: nextRedirectHref,
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
    const wantsReportView = params.get("view") === "report";
    let boot: { sessionId?: string; sessionUserId?: string; sessionToken?: string } | null = null;
    let reportSnapshot: OnboardingReportSnapshot | null = null;
    try {
      const raw = window.sessionStorage.getItem(ONBOARDING_BOOTSTRAP_KEY);
      boot = raw ? (JSON.parse(raw) as { sessionId?: string; sessionUserId?: string; sessionToken?: string }) : null;
    } catch {
      boot = null;
    }

    if (wantsReportView) {
      try {
        const raw = window.sessionStorage.getItem(ONBOARDING_REPORT_SNAPSHOT_KEY);
        reportSnapshot = raw ? (JSON.parse(raw) as OnboardingReportSnapshot) : null;
      } catch {
        reportSnapshot = null;
      }
    }

    if (
      wantsReportView
      && reportSnapshot
      // Old snapshots (pre-F1) carry no readiness payload — the risk view
      // they described no longer exists, so they cannot be restored.
      && reportSnapshot.readiness
      && (!maybeSessionId || reportSnapshot.sessionId === maybeSessionId)
    ) {
      setSessionId(reportSnapshot.sessionId);
      setSessionUserId(reportSnapshot.sessionUserId);
      setSessionToken(reportSnapshot.sessionToken);
      setFullName(reportSnapshot.fullName);
      setCareerCategory(reportSnapshot.careerCategory);
      setCustomCareerCategory(reportSnapshot.customCareerCategory);
      setJobTitle(reportSnapshot.jobTitle);
      setYearsExperience(reportSnapshot.yearsExperience);
      setCompanySize(reportSnapshot.companySize);
      setSituation(reportSnapshot.situation);
      setLinkedinUrl(reportSnapshot.linkedinUrl);
      setSelectedGoals(reportSnapshot.selectedGoals.length ? reportSnapshot.selectedGoals : ["upskill_current_job"]);
      setAiComfort(reportSnapshot.aiComfort);
      setUploadedResumeName(reportSnapshot.uploadedResumeName);
      setAssessmentScore(reportSnapshot.assessmentScore);
      setRecommendedPaths(reportSnapshot.recommendedPaths);
      setReadiness(reportSnapshot.readiness);
      setNextRedirectHref(reportSnapshot.nextRedirectHref);
      setNextRedirectLabel(reportSnapshot.nextRedirectLabel || "Go to Dashboard");
      onboardingCompleteFired.current = true;
      setStep(5);
      return () => {
        document.documentElement.removeAttribute("data-onboarding-react");
      };
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

  // UX audit F2: signed-in users who already completed the anonymous
  // assessment get their basics + goals prefilled and the flow collapses to
  // confirm → optional resume → finale (which reuses THEIR score, F1).
  useEffect(() => {
    if (!isSignedIn || assessmentContextFetched.current) return;
    assessmentContextFetched.current = true;
    void getJson<AssessmentContextPayload>("/api/onboarding/assessment-context")
      .then((payload) => {
        if (!payload?.linked || !payload.assessment || !payload.report) return;
        setLinkedContext(payload);
        trackPosthog("onboarding_linked_assessment_prefilled", {
          readiness_score: payload.report.readinessScore,
          career_path_id: payload.assessment.careerPathId,
        });

        const linked = payload.assessment;
        const category = categoryForAssessment(linked.careerPathId, linked.careerCategoryLabel);
        setCareerCategory(category.value);
        if (category.custom) setCustomCareerCategory((prev) => (prev.trim() ? prev : category.custom));
        if (linked.jobTitle) setJobTitle((prev) => (prev.trim() ? prev : linked.jobTitle ?? ""));
        if (linked.yearsExperience && yearsExperienceOptions.some((option) => option.value === linked.yearsExperience)) {
          setYearsExperience(linked.yearsExperience as (typeof yearsExperienceOptions)[number]["value"]);
        }
        if (linked.companySize) setCompanySize((prev) => (prev.trim() ? prev : linked.companySize ?? ""));
        if (linked.situation) setSituation(linked.situation as SituationStatus);
        if (linked.linkedinUrl) setLinkedinUrl((prev) => (prev.trim() ? prev : linked.linkedinUrl ?? ""));
        const goals = (linked.goals ?? []).filter((goal): goal is GoalType =>
          goalOptions.some((option) => option.value === goal),
        );
        if (goals.length) setSelectedGoals(goals);
        const comfort = comfortOptionFor(linked.aiComfort);
        if (comfort !== null) setAiComfort(comfort);
      })
      .catch(() => {
        // No linked assessment (or fetch failed): run the standard flow.
      });
  }, [isSignedIn]);

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
      ...onboardingAnalyticsContext,
    });
    trackPosthog("auth_clerk_sign_up_completed", {
      auth_provider: "clerk",
      signup_started_at: intent.startedAt,
      source: intent.source ?? "onboarding_auth_gate",
      ...onboardingAnalyticsContext,
    });
    trackFunnelStep("clerk_sign_up_completed", {
      auth_provider: "clerk",
      signup_started_at: intent.startedAt,
      source: intent.source ?? "onboarding_auth_gate",
      ...onboardingAnalyticsContext,
    });
    try {
      window.sessionStorage.setItem(SIGN_UP_COMPLETION_TRACKED_KEY, "1");
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
      ...onboardingAnalyticsContext,
    });
    trackFunnelStep("onboarding_viewed", {
      entry_point: signUpIntent ? "clerk_sign_up" : "direct",
      has_existing_session: Boolean(sessionId),
      ...onboardingAnalyticsContext,
    });
    trackPosthog("onboarding_step_viewed", {
      step: 1,
      step_name: STEP_NAMES[1],
      ...onboardingAnalyticsContext,
    });
  }, [onboardingAnalyticsContext, sessionId]);

  // Track every step transition in PostHog
  const prevStepRef = useRef<Step>(1);
  useEffect(() => {
    if (step === prevStepRef.current) return;
    trackPosthog("onboarding_step_viewed", {
      step,
      step_name: STEP_NAMES[step],
      ...onboardingAnalyticsContext,
    });
    trackFunnelStep(STEP_NAMES[step], {
      step,
      ...onboardingAnalyticsContext,
    });
    prevStepRef.current = step;
  }, [onboardingAnalyticsContext, step]);

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
    trackAdOnboardingComplete({
      sessionId,
      careerCategory: selectedCareer.path,
      score: normalizedScore,
      source: "onboarding_summary",
    });
    trackPosthog("onboarding_step_completed", {
      step: 4,
      step_name: "ai_analysis",
      ...onboardingAnalyticsContext,
      ...assessmentAnswerProps,
    });
    trackPosthog("onboarding_assessment_complete", {
      step: 5,
      step_name: "assessment_complete",
      ...onboardingAnalyticsContext,
      ...assessmentAnswerProps,
      score: normalizedScore,
      risk_band: riskBand,
    });
    trackPosthog("onboarding_completed", {
      ...onboardingAnalyticsContext,
      ...assessmentAnswerProps,
      score: normalizedScore,
      risk_band: riskBand,
    });
    trackFunnelStep("onboarding_completed", {
      ...onboardingAnalyticsContext,
      ...assessmentAnswerProps,
      score: normalizedScore,
      risk_band: riskBand,
    });
  }, [assessmentAnswerProps, onboardingAnalyticsContext, step, selectedCareer.path, normalizedScore, riskBand]);

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
        ...onboardingAnalyticsContext,
      });
      setStep(1);
      setError(stepOneError);
      return;
    }
    const stepTwoError = validateStepTwo();
    if (stepTwoError) {
      trackValidationFailure(2, stepTwoError, {
        ...onboardingAnalyticsContext,
      });
      setStep(2);
      setError(stepTwoError);
      return;
    }

    trackPosthog("onboarding_step_completed", {
      step: 3,
      step_name: "resume_review",
      ...onboardingAnalyticsContext,
    });
    setStep(4);
    setBusy(true);
    try {
      const session = await ensureSession();
      trackPosthog("onboarding_analysis_started", {
        ...onboardingAnalyticsContext,
        ...assessmentAnswerProps,
        session_id: session.id,
      });
      trackPosthog("assessment_started", {
        ...onboardingAnalyticsContext,
        session_id: session.id,
        career_path_id: selectedCareer.path,
      });
      if (!quizStartFired.current) {
        quizStartFired.current = true;
        trackAdQuizStart({
          sessionId: session.id,
          careerCategory: selectedCareer.path,
          source: "onboarding_analysis_started",
        });
      }

      const answers = [
        { questionId: "career_experience", value: selectedExperience.score },
        { questionId: "ai_comfort", value: aiComfort },
        { questionId: "daily_work_complexity", value: Math.min(5, Math.max(1, selectedExperience.score + (aiComfort >= 4 ? 1 : 0))) },
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
        aiComfort,
        linkedinUrl: linkedinUrl.trim() || null,
        resumeFilename: uploadedResumeName ?? resumeFile?.name ?? null,
        situation,
        goals: selectedGoals,
        answers,
      });

      const score = completed.assessment?.score ?? 0;
      const recommended = completed.assessment?.recommendedCareerPathIds ?? [];
      const completedReadiness = completed.readiness ?? null;
      trackPosthog("assessment_completed", {
        ...onboardingAnalyticsContext,
        session_id: session.id,
        career_path_id: selectedCareer.path,
        score,
        readiness_score: completedReadiness?.readinessScore ?? null,
        readiness_source: completedReadiness?.source ?? null,
        recommended_paths: recommended.join(","),
      });
      const redirectPath = `/dashboard/?welcome=1&onboardingSessionId=${encodeURIComponent(session.id)}`;
      const redirectLabel = completed.signedIn ? "Go to Dashboard" : "Create Account to Continue";
      setAssessmentScore(score);
      setRecommendedPaths(recommended);
      setReadiness(completedReadiness);
      if (!quizCompleteFired.current) {
        quizCompleteFired.current = true;
        trackAdLead({
          score,
          sessionId: session.id,
          careerCategory: selectedCareer.path,
          source: "onboarding_assessment_complete",
          recommendedPaths: recommended,
        });
      }
      try {
        window.sessionStorage.setItem(
          ONBOARDING_REPORT_SNAPSHOT_KEY,
          JSON.stringify({
            fullName,
            careerCategory,
            customCareerCategory,
            jobTitle,
            yearsExperience,
            companySize,
            situation,
            linkedinUrl,
            selectedGoals,
            aiComfort,
            uploadedResumeName: uploadedResumeName ?? resumeFile?.name ?? null,
            ts: Date.now(),
            sessionId: session.id,
            sessionUserId: session.userId,
            sessionToken: session.token,
            assessmentScore: score,
            recommendedPaths: recommended,
            readiness: completedReadiness,
            nextRedirectHref: redirectPath,
            nextRedirectLabel: redirectLabel,
          } satisfies OnboardingReportSnapshot),
        );
      } catch {
        // Ignore storage failures.
      }
      setStep(5);
      try {
        window.localStorage.removeItem(ONBOARDING_DRAFT_KEY);
      } catch {
        // Ignore storage failures.
      }

      if (completed.signedIn) {
        setNextRedirectHref(redirectPath);
        setNextRedirectLabel(redirectLabel);
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

      setNextRedirectHref(redirectPath);
      setNextRedirectLabel(redirectLabel);
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
            <h2 className="text-3xl font-[Outfit] font-semibold text-[#0f172a]">Sign in to set up your tutor</h2>
            <p className="mt-3 text-slate-600">
              Use {recommendedAuthSource} to open your workspace. Already took the free assessment? Your score and
              report will be waiting inside — no re-entering your answers.
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
                      window.sessionStorage.removeItem(SIGN_UP_COMPLETION_TRACKED_KEY);
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
              {step === 1 && (collapsed ? "Confirm Your Details" : "Basic Information")}
              {step === 2 && "Goals & Setup"}
              {step === 3 && "Resume & Review"}
              {step === 4 && "Your Readiness Report"}
              {step === 5 && "Your AI-Readiness Score"}
            </h2>
            <div className="flex gap-2">
              {(collapsed ? [1, 3, 4, 5] : [1, 2, 3, 4, 5]).map((index) => (
                <span
                  key={index}
                  className={`inline-block h-4 w-4 rounded-full ${
                    index <= step ? "bg-emerald-500" : "bg-slate-200"
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

          {step === 1 ? (
            <div className="space-y-5">
              {collapsed ? (
                <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
                  <i className="fa-solid fa-circle-check mr-2" />
                  We pulled this from your assessment — confirm or edit anything below. Your readiness score is already
                  saved.
                </div>
              ) : null}
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

          {/* Collapsed flow (F2): the goals/situation fields join the confirm screen. */}
          {step === 2 || (step === 1 && collapsed) ? (
            <div className={`space-y-5 ${collapsed ? "mt-5" : ""}`}>
              {!collapsed ? (
                <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
                  Quick setup: choose your current situation, goals, and AI comfort level. This helps us build your first dashboard plan.
                </div>
              ) : null}

              <div>
                <label className="block text-sm font-medium mb-2 text-[#334155]">
                  <i className="fa-brands fa-linkedin text-[#0a66c2] mr-2" />
                  LinkedIn Profile (Optional)
                </label>
                <input
                  type="url"
                  value={linkedinUrl}
                  onChange={(event) => setLinkedinUrl(event.target.value)}
                  placeholder="https://linkedin.com/in/your-profile"
                  className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-[#1e293b] placeholder:text-slate-400 focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-100 transition-colors"
                />
                <p className="mt-2 text-sm text-slate-500">Optional, but useful for stronger role-specific recommendations.</p>
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
                <h4 className="text-xl font-semibold text-[#0f172a] mb-2">What happens next</h4>
                <ul className="space-y-2 text-slate-500">
                  {collapsed ? (
                    <li>
                      <i className="fa-solid fa-gauge-high mr-2 text-emerald-600" />
                      Your saved readiness score and report get attached to your workspace — no re-scoring.
                    </li>
                  ) : (
                    <li>
                      <i className="fa-solid fa-gauge-high mr-2 text-emerald-600" />
                      Your answers become your AI-readiness report: a 0-100 score, your top skill gaps, and a 30-day plan.
                    </li>
                  )}
                  <li><i className="fa-solid fa-robot mr-2 text-emerald-600" />Your responses personalize your tutor path.</li>
                  <li><i className="fa-solid fa-shield mr-2 text-emerald-600" />LinkedIn and resume context improves recommendations.</li>
                </ul>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
                <h4 className="text-xl font-semibold text-[#0f172a] mb-3">Review Your Information</h4>
                <div className="grid gap-2 text-[#0f172a]">
                  <p><strong>Role:</strong> {jobTitle.trim() ? `${jobTitle.trim()} (${selectedCareerLabel})` : selectedCareerLabel}</p>
                  <p><strong>Experience:</strong> {selectedExperience.label}</p>
                  <p><strong>Company Size:</strong> {companySize || "Not specified"}</p>
                  <p><strong>Resume:</strong> {uploadedResumeName || resumeFile ? "Uploaded" : "Not provided"}</p>
                  <p><strong>LinkedIn:</strong> {linkedinUrl.trim() ? "Provided" : "Not provided"}</p>
                </div>
              </div>
            </div>
          ) : null}

          {step === 4 ? (
            <div className="py-12 text-center">
              <div className="mx-auto mb-6 h-20 w-20 rounded-full border-4 border-emerald-500 border-t-transparent animate-spin" />
              <h3 className="text-3xl font-[Outfit] font-semibold text-[#0f172a] mb-5">
                {collapsed ? "Finishing your setup" : "Building your readiness report"}
              </h3>
              <div className="max-w-xl mx-auto rounded-2xl border border-emerald-200 bg-emerald-50 px-5 py-4 text-lg text-[#0f172a]">
                <i className="fa-solid fa-spinner animate-spin mr-3 text-emerald-600" />
                {analysisSteps[analysisIndex]}
              </div>
            </div>
          ) : null}

          {step === 5 ? (
            <div className="space-y-8">
              {/* One score, one framework: the 0-100 AI-readiness score (UX audit F1). */}
              {readiness ? (
                <div className="grid gap-6 md:grid-cols-[auto_1fr] md:items-center rounded-2xl border border-slate-200 bg-white shadow-sm p-6 md:p-8">
                  <div className="mx-auto relative h-40 w-40">
                    <div
                      className="h-full w-full rounded-full"
                      style={{
                        background: `conic-gradient(${readinessScoreBand.color} ${readiness.readinessScore * 3.6}deg, #d9e1ee 0deg)`,
                      }}
                    />
                    <div className="absolute inset-3 rounded-full bg-white flex flex-col items-center justify-center">
                      <span className="text-5xl font-bold" style={{ color: readinessScoreBand.color }}>
                        {readiness.readinessScore}
                      </span>
                      <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-500 mt-1">
                        out of 100
                      </span>
                    </div>
                  </div>
                  <div className="text-center md:text-left">
                    <span
                      className="inline-block rounded-full border px-3 py-1 text-xs font-semibold mb-3"
                      style={{
                        borderColor: `${readinessScoreBand.color}66`,
                        backgroundColor: `${readinessScoreBand.color}1a`,
                        color: readinessScoreBand.color,
                      }}
                    >
                      {readinessScoreBand.label} · AI-Readiness Score
                    </span>
                    <h3 className="text-2xl font-[Outfit] font-semibold text-[#0f172a] leading-snug mb-2">
                      {readiness.headline}
                    </h3>
                    <p className="text-sm text-slate-600 mb-4">
                      {readiness.source === "linked"
                        ? `This is the score from your assessment — scored for ${selectedCareerLabel}. Everything you finish here moves it.`
                        : `Scored for ${selectedCareerLabel}. Everything you finish here moves it.`}
                    </p>
                    <a
                      href={readiness.reportPath}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-2 text-sm font-semibold text-emerald-600 hover:text-emerald-500"
                    >
                      View your full report
                      <i className="fa-solid fa-arrow-up-right-from-square text-xs" />
                    </a>
                  </div>
                </div>
              ) : (
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-6 text-slate-600">
                  Your readiness report is being prepared. Open your dashboard to see your score.
                </div>
              )}

              {recommendedPathDetails.length ? (
                <div className="rounded-2xl border border-slate-200 bg-white p-5">
                  <h4 className="text-xl font-[Outfit] text-[#0f172a] mb-2">Recommended Skills, Modules, and Tools</h4>
                  <p className="text-sm text-slate-600 mb-4">
                    Start with the first track below. It is the fastest path based on your answers.
                  </p>
                  <div className="grid gap-4 md:grid-cols-3">
                    {recommendedPathDetails.map((path, index) => (
                      <div key={path.id} className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                        <p className="text-[11px] uppercase tracking-wide text-slate-500">
                          {index === 0 ? "Start Here" : "Then"}
                        </p>
                        <h5 className="text-base font-semibold text-[#0f172a] mt-1">{path.name}</h5>
                        <p className="text-xs text-slate-600 mt-1">{path.coreSkillDomain}</p>
                        <p className="text-xs font-semibold text-slate-700 mt-3">Modules</p>
                        <p className="text-xs text-slate-600">{path.modules.slice(0, 2).join(" • ")}</p>
                        <p className="text-xs font-semibold text-slate-700 mt-3">Tools</p>
                        <p className="text-xs text-slate-600">{path.tools.slice(0, 2).join(" • ")}</p>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}

              <div className="flex flex-col gap-3 border-t border-slate-200 pt-6 md:flex-row md:items-center md:justify-between">
                <p className="text-sm text-slate-500">
                  You are set. Go to your dashboard to start your 7-day free trial and unlock the first recommended module.
                </p>
                {!isSignedIn ? (
                  <SignUpButton mode="modal" forceRedirectUrl={nextRedirectHref ?? "/dashboard/?welcome=1"} fallbackRedirectUrl={nextRedirectHref ?? "/dashboard/?welcome=1"}>
                    <button
                      type="button"
                    className="btn btn-primary px-8"
                    disabled={!nextRedirectHref || navigatingAfterSummary}
                    onClick={() => {
                        trackPosthog("assessment_summary_cta_clicked", {
                          ...onboardingAnalyticsContext,
                          ...assessmentAnswerProps,
                          destination: nextRedirectHref,
                          action: "create_account_to_continue",
                          score: normalizedScore,
                          risk_band: riskBand,
                        });
                        try {
                          window.sessionStorage.setItem(
                            SIGN_UP_INTENT_KEY,
                            JSON.stringify({ startedAt: Date.now(), source: "assessment_complete_cta" }),
                          );
                          window.sessionStorage.removeItem(SIGN_UP_COMPLETION_TRACKED_KEY);
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
                  setStep((prev) => {
                    if (prev <= 1) return prev;
                    // Collapsed flow (F2): step 2 does not exist on its own.
                    if (collapsed && prev === 3) return 1;
                    return (prev - 1) as Step;
                  });
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
                      const validation = validateStepOne() ?? (collapsed ? validateStepTwo() : null);
                      if (validation) {
                        trackValidationFailure(1, validation, {
                          ...onboardingAnalyticsContext,
                        });
                        setError(validation);
                        return;
                      }
                      if (!onboardingStartFired.current) {
                        onboardingStartFired.current = true;
                        trackAdOnboardingStart({
                          sessionId,
                          careerCategory: selectedCareer.path,
                          source: "onboarding_step_one_completed",
                        });
                      }
                      trackPosthog("onboarding_step_completed", {
                        step: 1,
                        step_name: "basic_information",
                        job_title: jobTitle,
                        linked_assessment: collapsed,
                        ...onboardingAnalyticsContext,
                      });
                      if (collapsed) {
                        // Collapsed flow (F2): the confirm screen covered the
                        // work-details step — go straight to resume upload.
                        trackPosthog("onboarding_step_completed", {
                          step: 2,
                          step_name: "work_details",
                          has_linkedin: !!linkedinUrl.trim(),
                          linked_assessment: true,
                          ...onboardingAnalyticsContext,
                        });
                        setStep(3);
                        return;
                      }
                    }
                    if (step === 2) {
                      const validation = validateStepTwo();
                      if (validation) {
                        trackValidationFailure(2, validation, {
                          ...onboardingAnalyticsContext,
                        });
                        setError(validation);
                        return;
                      }
                      trackPosthog("onboarding_step_completed", {
                        step: 2,
                        step_name: "work_details",
                        has_linkedin: !!linkedinUrl.trim(),
                        ...onboardingAnalyticsContext,
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
                  <i className="fa-solid fa-gauge-high mr-2" />
                  {busy ? "Working..." : collapsed ? "Finish Setup" : "Get My Readiness Report"}
                </button>
              )}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
