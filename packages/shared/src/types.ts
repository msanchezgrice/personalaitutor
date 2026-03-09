export type SkillStatus = "not_started" | "in_progress" | "built" | "verified";
export type ThemeMode = "dark" | "light";

export type SituationStatus =
  | "employed"
  | "unemployed"
  | "student"
  | "founder"
  | "freelancer"
  | "career_switcher";

export type GoalType =
  | "build_business"
  | "upskill_current_job"
  | "find_new_role"
  | "showcase_for_job"
  | "learn_foundations"
  | "ship_ai_projects";

export type AcquisitionAttributionPoint = {
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
  utmContent?: string;
  utmTerm?: string;
  fbclid?: string;
  twclid?: string;
  liFatId?: string;
  gclid?: string;
  msclkid?: string;
  referrer?: string;
  landingPath?: string;
  capturedAt?: string;
};

export type AcquisitionAttribution = {
  first?: AcquisitionAttributionPoint;
  last?: AcquisitionAttributionPoint;
};

export type CareerPath = {
  id: string;
  name: string;
  coreSkillDomain: string;
  modules: string[];
  tools: string[];
  roles: string[];
};

export type ModuleTrack = {
  id: string;
  careerPathId: string;
  title: string;
  summary: string;
};

export type VerificationPolicy = {
  moduleMinScore: number;
  projectMinScore: number;
  builtMinArtifacts: number;
};

export type UserSkill = {
  skill: string;
  status: SkillStatus;
  score: number;
  evidenceCount: number;
};

export type UserProfile = {
  id: string;
  handle: string;
  name: string;
  avatarUrl?: string | null;
  contactEmail?: string | null;
  headline: string;
  bio: string;
  careerPathId: string;
  skills: UserSkill[];
  tools: string[];
  socialLinks: {
    linkedin?: string;
    x?: string;
    website?: string;
    github?: string;
  };
  published: boolean;
  tokensUsed: number;
  goals: GoalType[];
  acquisition?: AcquisitionAttribution;
  createdAt: string;
  updatedAt: string;
};

export type ArtifactKind =
  | "website"
  | "pptx"
  | "pdf"
  | "resume_docx"
  | "resume_pdf"
  | "proof_link"
  | "proof_upload";

export type BuildLogEntry = {
  id: string;
  projectId: string;
  userId: string;
  message: string;
  level: "info" | "success" | "warn" | "error";
  createdAt: string;
  metadata?: Record<string, unknown>;
};

export type Project = {
  id: string;
  userId: string;
  slug: string;
  title: string;
  description: string;
  state: "idea" | "planned" | "building" | "built" | "showcased" | "archived";
  artifacts: Array<{ kind: ArtifactKind | string; url: string; createdAt: string }>;
  buildLog: BuildLogEntry[];
  createdAt: string;
  updatedAt: string;
};

export type AgentJobStatus =
  | "queued"
  | "claimed"
  | "running"
  | "waiting_on_user"
  | "completed"
  | "failed"
  | "cancelled";

export type AgentJob = {
  id: string;
  projectId: string | null;
  userId: string | null;
  type: string;
  payload: Record<string, unknown>;
  status: AgentJobStatus;
  attempts: number;
  maxAttempts: number;
  createdAt: string;
  updatedAt: string;
  leaseUntil: string | null;
  lastErrorCode: string | null;
};

export type AgentJobEvent = {
  id: string;
  jobId: string;
  userId: string | null;
  projectId: string | null;
  type: string;
  message: string;
  createdAt: string;
  payload?: Record<string, unknown>;
};

export type OnboardingSession = {
  id: string;
  userId: string;
  situation: SituationStatus | null;
  careerPathId: string | null;
  linkedinUrl: string | null;
  resumeFilename: string | null;
  aiKnowledgeScore: number | null;
  goals: GoalType[];
  intakeProfile?: Record<string, unknown>;
  acquisition?: AcquisitionAttribution;
  status: "started" | "collecting" | "assessment_pending" | "ready_for_dashboard";
  createdAt: string;
  updatedAt: string;
};

export type AssessmentAttempt = {
  id: string;
  userId: string;
  score: number;
  startedAt: string;
  submittedAt: string | null;
  answers: Array<{ questionId: string; value: number }>;
  recommendedCareerPathIds: string[];
};

export type VerificationEvent = {
  id: string;
  userId: string;
  projectId: string | null;
  skill: string;
  eventType:
    | "module_started"
    | "module_completed"
    | "artifact_generated"
    | "verification_passed"
    | "verification_revoked";
  details: Record<string, unknown>;
  createdAt: string;
};

export type SocialPlatform = "linkedin" | "x";
export type PublishMode = "api" | "composer";

export type SocialDraft = {
  id: string;
  userId: string;
  projectId: string | null;
  platform: SocialPlatform;
  text: string;
  ogUrl: string;
  shareUrl: string;
  status: "draft" | "published" | "failed";
  createdAt: string;
  updatedAt: string;
};

export type OAuthConnection = {
  userId: string;
  platform: SocialPlatform | "linkedin_profile";
  connected: boolean;
  accountLabel: string | null;
  connectedAt: string | null;
  lastErrorCode: string | null;
};

export type TalentCard = {
  handle: string;
  name: string;
  avatarUrl?: string | null;
  careerType: string;
  role: string;
  status: SkillStatus;
  topSkills: string[];
  topTools: string[];
  evidenceScore: number;
};

export type EmployerLead = {
  id: string;
  employerName: string;
  employerEmail: string;
  handle: string;
  note: string;
  createdAt: string;
};

export type NewsInsight = {
  id: string;
  title: string;
  url: string;
  summary: string;
  careerPathIds: string[];
  publishedAt: string;
  learnerProfileId?: string | null;
  source?: string | null;
  category?: "capabilities" | "tools" | "job_displacement" | "policy" | "workflow";
  relevanceScore?: number;
  rankingScore?: number;
  impact?: "high" | "medium" | "low";
  whyRelevant?: string;
  recommendedAction?: string;
  contextSignals?: string[];
};

export type DailyUpdate = {
  id: string;
  userId: string;
  status: "sent" | "failed";
  summary: string;
  upcomingTasks: string[];
  newsIds: string[];
  createdAt: string;
  failureCode: string | null;
};

export type DashboardAchievement = {
  key: string;
  title: string;
  description: string;
  xp: number;
  unlocked: boolean;
  unlockedAt: string | null;
};

export type DashboardBadge = {
  key: string;
  title: string;
  description: string;
  unlocked: boolean;
  unlockedAt: string | null;
};

export type DashboardGamification = {
  xpTotal: number;
  level: number;
  levelLabel: string;
  levelSubtitle: string;
  levelProgressPct: number;
  levelProgressText: string;
  nextLevel: number | null;
  xpToNextLevel: number | null;
  primaryTrackId: string;
  primaryTrackName: string;
  achievements: DashboardAchievement[];
  badges: DashboardBadge[];
};

export type DashboardSummary = {
  user: UserProfile;
  projects: Project[];
  pendingJobs: AgentJob[];
  latestEvents: AgentJobEvent[];
  moduleRecommendations: ModuleTrack[];
  dailyUpdate: DailyUpdate | null;
  gamification: DashboardGamification;
};
