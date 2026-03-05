import {
  CAREER_PATHS,
  getCareerPath,
  getEmployerFilterFacets,
  getModuleTracksForCareerPath,
  MODULE_TRACKS,
} from "./matrix";
import type {
  AcquisitionAttribution,
  AgentJob,
  AgentJobEvent,
  AgentJobStatus,
  ArtifactKind,
  AssessmentAttempt,
  BuildLogEntry,
  DailyUpdate,
  DashboardSummary,
  EmployerLead,
  GoalType,
  NewsInsight,
  OAuthConnection,
  OnboardingSession,
  Project,
  PublishMode,
  SkillStatus,
  SocialDraft,
  SocialPlatform,
  TalentCard,
  UserProfile,
  UserSkill,
  VerificationEvent,
  VerificationPolicy,
} from "./types";

const nowIso = () => new Date().toISOString();
const id = (prefix: string) => `${prefix}_${Math.random().toString(36).slice(2, 10)}`;
const PLATFORM_NAME = "My AI Skill Tutor";

const verificationPolicy: VerificationPolicy = {
  moduleMinScore: 0.4,
  projectMinScore: 0.4,
  builtMinArtifacts: 1,
};

const defaultUserId = "user_test_0001";

const defaultUser: UserProfile = {
  id: defaultUserId,
  handle: "test-user-0001",
  name: "TEST_USER_0001",
  avatarUrl: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=256&q=80&fit=crop",
  headline: "Synthetic profile for end-to-end verification",
  bio: "Synthetic user for onboarding, dashboard, profile publish, and employer search verification.",
  careerPathId: CAREER_PATHS[0].id,
  skills: [
    { skill: "Prompt Engineering", status: "built", score: 0.56, evidenceCount: 2 },
    { skill: "Workflow Design", status: "in_progress", score: 0.32, evidenceCount: 1 },
  ],
  tools: ["OpenAI API", "Supabase", "Vercel"],
  socialLinks: {
    linkedin: "https://www.linkedin.com/in/test-user-0001",
    x: "https://x.com/test_user_0001",
    website: "http://localhost:6396/u/test-user-0001",
  },
  published: true,
  tokensUsed: 18430,
  goals: ["upskill_current_job", "ship_ai_projects"],
  acquisition: undefined,
  createdAt: nowIso(),
  updatedAt: nowIso(),
};

const defaultProject: Project = {
  id: "project_alpha_001",
  userId: defaultUser.id,
  slug: "project-alpha-001",
  title: "PROJECT_ALPHA_001",
  description: "Synthetic customer support copilot prototype with artifact outputs.",
  state: "building",
  artifacts: [{ kind: "website", url: "/u/test-user-0001/projects/project-alpha-001", createdAt: nowIso() }],
  buildLog: [],
  createdAt: nowIso(),
  updatedAt: nowIso(),
};

const talentCards: TalentCard[] = [
  { handle: "candidate-001", name: "Candidate 001", careerType: "Employed", role: "Product Manager", status: "verified", topSkills: ["Prompt Engineering", "RAG"], topTools: ["OpenAI API", "Supabase"], evidenceScore: 83 },
  { handle: "candidate-002", name: "Candidate 002", careerType: "Employed", role: "Marketing Lead", status: "verified", topSkills: ["Content Automation", "Analytics"], topTools: ["ChatGPT", "HubSpot"], evidenceScore: 74 },
  { handle: "candidate-003", name: "Candidate 003", careerType: "Employed", role: "Operations Manager", status: "built", topSkills: ["Workflow Automation", "QA"], topTools: ["n8n", "Zapier"], evidenceScore: 61 },
  { handle: "candidate-004", name: "Candidate 004", careerType: "Employed", role: "Software Engineer", status: "verified", topSkills: ["Agent Orchestration", "Prompt Engineering"], topTools: ["OpenAI API", "LangGraph"], evidenceScore: 79 },
  { handle: "candidate-005", name: "Candidate 005", careerType: "Employed", role: "Data Analyst", status: "built", topSkills: ["AI Reporting", "Data QA"], topTools: ["Python", "Notebook"], evidenceScore: 67 },
  { handle: "candidate-006", name: "Candidate 006", careerType: "Freelancer", role: "Consultant", status: "in_progress", topSkills: ["Client Automation", "Prompting"], topTools: ["Make", "OpenAI API"], evidenceScore: 54 },
  { handle: "candidate-007", name: "Candidate 007", careerType: "Founder", role: "Startup Operator", status: "built", topSkills: ["AI Product Strategy", "Ops"], topTools: ["Vercel", "Supabase"], evidenceScore: 63 },
  { handle: "candidate-008", name: "Candidate 008", careerType: "Student", role: "CS Student", status: "in_progress", topSkills: ["Prompting", "Documentation"], topTools: ["ChatGPT", "Notion AI"], evidenceScore: 49 },
  { handle: "candidate-009", name: "Candidate 009", careerType: "Career Switcher", role: "Ops to PM", status: "built", topSkills: ["Workflow Design", "AI QA"], topTools: ["Zapier", "Loom"], evidenceScore: 58 },
  { handle: "candidate-010", name: "Candidate 010", careerType: "Employed", role: "Sales Manager", status: "built", topSkills: ["Outreach Automation", "CRM AI"], topTools: ["HubSpot", "OpenAI API"], evidenceScore: 64 },
  { handle: "candidate-011", name: "Candidate 011", careerType: "Employed", role: "Recruiter", status: "in_progress", topSkills: ["AI Screening", "Prompting"], topTools: ["Greenhouse", "ChatGPT"], evidenceScore: 52 },
  { handle: "candidate-012", name: "Candidate 012", careerType: "Freelancer", role: "Designer", status: "built", topSkills: ["AI Prototype UX", "Generation"], topTools: ["Figma", "Midjourney"], evidenceScore: 60 },
  { handle: "candidate-013", name: "Candidate 013", careerType: "Employed", role: "Support Lead", status: "verified", topSkills: ["Support Copilots", "Routing"], topTools: ["Zendesk", "OpenAI API"], evidenceScore: 76 },
  { handle: "candidate-014", name: "Candidate 014", careerType: "Employed", role: "Finance Analyst", status: "in_progress", topSkills: ["AI Reporting", "Validation"], topTools: ["Excel", "Python"], evidenceScore: 47 },
  { handle: "candidate-015", name: "Candidate 015", careerType: "Employed", role: "Product Marketing", status: "built", topSkills: ["AI GTM Ops", "Copy"], topTools: ["Notion AI", "HubSpot"], evidenceScore: 62 },
  { handle: "candidate-016", name: "Candidate 016", careerType: "Employed", role: "Engineer", status: "verified", topSkills: ["Eval Pipelines", "Agent QA"], topTools: ["LangSmith", "OpenAI API"], evidenceScore: 81 },
  { handle: "candidate-017", name: "Candidate 017", careerType: "Founder", role: "Solo Operator", status: "built", topSkills: ["AI Ops", "Automation"], topTools: ["Zapier", "Notion"], evidenceScore: 59 },
  { handle: "candidate-018", name: "Candidate 018", careerType: "Career Switcher", role: "Teacher", status: "in_progress", topSkills: ["AI Curriculum", "Content"], topTools: ["ChatGPT", "Canva"], evidenceScore: 46 },
  { handle: "candidate-019", name: "Candidate 019", careerType: "Freelancer", role: "Consultant", status: "built", topSkills: ["Workflow Audits", "Automation"], topTools: ["Make", "Airtable"], evidenceScore: 66 },
  { handle: "candidate-020", name: "Candidate 020", careerType: "Unemployed", role: "Job Seeker", status: "in_progress", topSkills: ["Portfolio Proof", "Prompting"], topTools: ["ChatGPT", "Vercel"], evidenceScore: 44 },
];

const defaultOAuthConnections: OAuthConnection[] = [
  { userId: defaultUserId, platform: "linkedin_profile", connected: false, accountLabel: null, connectedAt: null, lastErrorCode: null },
  { userId: defaultUserId, platform: "linkedin", connected: false, accountLabel: null, connectedAt: null, lastErrorCode: null },
  { userId: defaultUserId, platform: "x", connected: false, accountLabel: null, connectedAt: null, lastErrorCode: null },
];

const state = {
  users: [defaultUser] as UserProfile[],
  projects: [defaultProject] as Project[],
  onboardingSessions: [] as OnboardingSession[],
  assessments: [] as AssessmentAttempt[],
  jobs: [] as AgentJob[],
  jobEvents: [] as AgentJobEvent[],
  verificationEvents: [] as VerificationEvent[],
  socialDrafts: [] as SocialDraft[],
  oauthConnections: defaultOAuthConnections,
  talent: talentCards,
  employerLeads: [] as EmployerLead[],
  newsInsights: [] as NewsInsight[],
  dailyUpdates: [] as DailyUpdate[],
};

export function getState() {
  return state;
}

export function resetStateForTests() {
  state.users = [structuredClone(defaultUser)];
  state.projects = [structuredClone(defaultProject)];
  state.onboardingSessions = [];
  state.assessments = [];
  state.jobs = [];
  state.jobEvents = [];
  state.verificationEvents = [];
  state.socialDrafts = [];
  state.oauthConnections = structuredClone(defaultOAuthConnections);
  state.talent = structuredClone(talentCards);
  state.employerLeads = [];
  state.newsInsights = [];
  state.dailyUpdates = [];
}

export function getVerificationPolicy() {
  return verificationPolicy;
}

function statusRank(status: SkillStatus) {
  switch (status) {
    case "not_started":
      return 0;
    case "in_progress":
      return 1;
    case "built":
      return 2;
    case "verified":
      return 3;
    default:
      return 0;
  }
}

function nextStatus(current: SkillStatus, requested: SkillStatus) {
  if (requested === "built" && current === "verified") return current;
  if (requested === "verified" && current === "not_started") return "in_progress";
  return statusRank(requested) > statusRank(current) ? requested : current;
}

function updateSkill(user: UserProfile, skillName: string, requested: SkillStatus, score: number, evidenceDelta = 0) {
  const existing = user.skills.find((entry) => entry.skill === skillName);
  if (!existing) {
    user.skills.push({
      skill: skillName,
      status: requested,
      score,
      evidenceCount: Math.max(0, evidenceDelta),
    });
    return;
  }

  existing.score = Math.max(existing.score, score);
  existing.evidenceCount = Math.max(0, existing.evidenceCount + evidenceDelta);
  existing.status = nextStatus(existing.status, requested);

  if (existing.status === "verified" && existing.score < verificationPolicy.projectMinScore) {
    existing.status = "built";
  }
}

function ensureOAuthConnection(userId: string, platform: OAuthConnection["platform"]) {
  const found = state.oauthConnections.find((entry) => entry.userId === userId && entry.platform === platform);
  if (found) return found;

  const created: OAuthConnection = {
    userId,
    platform,
    connected: false,
    accountLabel: null,
    connectedAt: null,
    lastErrorCode: null,
  };
  state.oauthConnections.push(created);
  return created;
}

export function listOAuthConnections(userId: string) {
  ensureOAuthConnection(userId, "linkedin_profile");
  ensureOAuthConnection(userId, "linkedin");
  ensureOAuthConnection(userId, "x");
  return state.oauthConnections.filter((entry) => entry.userId === userId);
}

export function connectOAuth(userId: string, platform: OAuthConnection["platform"], accountLabel: string) {
  const connection = ensureOAuthConnection(userId, platform);
  connection.connected = true;
  connection.accountLabel = accountLabel;
  connection.connectedAt = nowIso();
  connection.lastErrorCode = null;
  return connection;
}

export function markOAuthFailure(userId: string, platform: OAuthConnection["platform"], code: string) {
  const connection = ensureOAuthConnection(userId, platform);
  connection.connected = false;
  connection.lastErrorCode = code;
  return connection;
}

function touchProfile(user: UserProfile) {
  user.updatedAt = nowIso();
}

function safeHandle(raw: string) {
  return raw
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
}

function uniqueHandle(base: string) {
  const normalized = safeHandle(base) || `user-${Math.random().toString(36).slice(2, 8)}`;
  const handles = new Set(state.users.map((entry) => entry.handle));
  if (!handles.has(normalized)) return normalized;
  let i = 2;
  while (handles.has(`${normalized}-${i}`)) i += 1;
  return `${normalized}-${i}`;
}

export function findUserByHandle(handle: string) {
  return state.users.find((entry) => entry.handle === handle) ?? null;
}

export function findUserById(userId: string) {
  return state.users.find((entry) => entry.id === userId) ?? null;
}

export function createUser(input: {
  handleBase: string;
  name: string;
  avatarUrl?: string | null;
  headline?: string;
  bio?: string;
  careerPathId?: string;
  goals?: GoalType[];
  acquisition?: AcquisitionAttribution;
}) {
  const created: UserProfile = {
    id: id("user"),
    handle: uniqueHandle(input.handleBase),
    name: input.name,
    avatarUrl: input.avatarUrl ?? null,
    headline: input.headline ?? "AI learner building public proof",
    bio: input.bio ?? "Synthetic user generated through onboarding flow.",
    careerPathId: input.careerPathId && getCareerPath(input.careerPathId) ? input.careerPathId : CAREER_PATHS[0].id,
    skills: [],
    tools: [],
    socialLinks: {},
    published: false,
    tokensUsed: 0,
    goals: input.goals ?? ["learn_foundations"],
    acquisition: input.acquisition,
    createdAt: nowIso(),
    updatedAt: nowIso(),
  };

  state.users.push(created);
  listOAuthConnections(created.id);
  return created;
}

export function upsertUserProfile(input: Partial<UserProfile> & Pick<UserProfile, "id">) {
  const found = state.users.find((entry) => entry.id === input.id);
  if (!found) {
    const created: UserProfile = {
      ...defaultUser,
      ...input,
      id: input.id,
      handle: input.handle ?? uniqueHandle("test-user"),
      createdAt: nowIso(),
      updatedAt: nowIso(),
    };
    state.users.push(created);
    listOAuthConnections(created.id);
    return created;
  }

  Object.assign(found, input);
  touchProfile(found);
  return found;
}

export function createOnboardingSession(input: {
  userId?: string;
  name?: string;
  avatarUrl?: string | null;
  handleBase?: string;
  careerPathId?: string;
  acquisition?: AcquisitionAttribution;
}) {
  const user =
    (input.userId ? findUserById(input.userId) : null) ??
    createUser({
      handleBase: input.handleBase ?? "test-user",
      name: input.name ?? "TEST_USER_ONBOARDING",
      avatarUrl: input.avatarUrl ?? null,
      careerPathId: input.careerPathId,
      acquisition: input.acquisition,
    });

  const session: OnboardingSession = {
    id: id("onb"),
    userId: user.id,
    situation: null,
    careerPathId: input.careerPathId ?? user.careerPathId,
    linkedinUrl: null,
    resumeFilename: null,
    aiKnowledgeScore: null,
    goals: user.goals,
    acquisition: input.acquisition,
    status: "started",
    createdAt: nowIso(),
    updatedAt: nowIso(),
  };

  state.onboardingSessions.push(session);
  appendJobEvent({
    jobId: "onboarding",
    userId: user.id,
    projectId: null,
    type: "onboarding.started",
    message: `Onboarding session ${session.id} started.`,
  });
  return { user, session };
}

export function findOnboardingSession(sessionId: string) {
  return state.onboardingSessions.find((entry) => entry.id === sessionId) ?? null;
}

export function updateOnboardingSituation(input: {
  sessionId: string;
  situation: OnboardingSession["situation"];
  goals: GoalType[];
}) {
  const session = findOnboardingSession(input.sessionId);
  if (!session) return null;

  session.situation = input.situation;
  session.goals = input.goals;
  session.status = "collecting";
  session.updatedAt = nowIso();

  const user = findUserById(session.userId);
  if (user) {
    user.goals = input.goals;
    touchProfile(user);
  }

  appendJobEvent({
    jobId: "onboarding",
    userId: session.userId,
    projectId: null,
    type: "onboarding.situation_recorded",
    message: `Situation set to ${input.situation}`,
  });

  return session;
}

export function updateOnboardingCareerImport(input: {
  sessionId: string;
  careerPathId: string;
  linkedinUrl?: string | null;
  resumeFilename?: string | null;
}) {
  const session = findOnboardingSession(input.sessionId);
  if (!session) return null;

  if (!getCareerPath(input.careerPathId)) return null;

  session.careerPathId = input.careerPathId;
  session.linkedinUrl = input.linkedinUrl ?? null;
  session.resumeFilename = input.resumeFilename ?? null;
  session.status = "assessment_pending";
  session.updatedAt = nowIso();

  const user = findUserById(session.userId);
  if (user) {
    user.careerPathId = input.careerPathId;
    touchProfile(user);
  }

  appendJobEvent({
    jobId: "onboarding",
    userId: session.userId,
    projectId: null,
    type: "onboarding.career_imported",
    message: `Career data imported for ${input.careerPathId}.`,
  });

  return session;
}

export function startAssessment(userId: string) {
  const user = findUserById(userId);
  if (!user) return null;

  const assessment: AssessmentAttempt = {
    id: id("asm"),
    userId,
    score: 0,
    startedAt: nowIso(),
    submittedAt: null,
    answers: [],
    recommendedCareerPathIds: [user.careerPathId],
  };
  state.assessments.push(assessment);

  appendJobEvent({
    jobId: "assessment",
    userId,
    projectId: null,
    type: "assessment.started",
    message: `Assessment ${assessment.id} started`,
  });

  return assessment;
}

export function submitAssessment(input: {
  assessmentId: string;
  answers: Array<{ questionId: string; value: number }>;
}) {
  const attempt = state.assessments.find((entry) => entry.id === input.assessmentId);
  if (!attempt) return null;

  const total = input.answers.reduce((sum, answer) => sum + answer.value, 0);
  const score = input.answers.length ? total / input.answers.length / 5 : 0;
  attempt.answers = input.answers;
  attempt.score = Number(score.toFixed(2));
  attempt.submittedAt = nowIso();

  const pivot = Math.floor(total) % CAREER_PATHS.length;
  attempt.recommendedCareerPathIds = [
    CAREER_PATHS[pivot].id,
    CAREER_PATHS[(pivot + 1) % CAREER_PATHS.length].id,
    CAREER_PATHS[(pivot + 2) % CAREER_PATHS.length].id,
  ];

  const user = findUserById(attempt.userId);
  if (user) {
    user.careerPathId = attempt.recommendedCareerPathIds[0];
    user.tokensUsed += 500;
    touchProfile(user);

    const career = getCareerPath(user.careerPathId);
    if (career) {
      for (const module of career.modules.slice(0, 2)) {
        updateSkill(user, module, "in_progress", Math.max(0.2, attempt.score * 0.8), 1);
      }
    }
  }

  appendJobEvent({
    jobId: "assessment",
    userId: attempt.userId,
    projectId: null,
    type: "assessment.submitted",
    message: `Assessment ${attempt.id} submitted with score ${attempt.score}`,
    payload: { recommendedCareerPathIds: attempt.recommendedCareerPathIds },
  });

  return attempt;
}

export function getAssessmentById(assessmentId: string) {
  return state.assessments.find((entry) => entry.id === assessmentId) ?? null;
}

function addBuildLogEntry(input: {
  projectId: string;
  userId: string;
  message: string;
  level: BuildLogEntry["level"];
  metadata?: Record<string, unknown>;
}) {
  const project = state.projects.find((entry) => entry.id === input.projectId);
  if (!project) return null;

  const entry: BuildLogEntry = {
    id: id("log"),
    projectId: input.projectId,
    userId: input.userId,
    message: input.message,
    level: input.level,
    createdAt: nowIso(),
    metadata: input.metadata,
  };

  project.buildLog.push(entry);
  project.updatedAt = nowIso();
  return entry;
}

export function listProjectsByUser(userId: string) {
  return state.projects.filter((entry) => entry.userId === userId);
}

export function findProjectById(projectId: string) {
  return state.projects.find((entry) => entry.id === projectId) ?? null;
}

export function findProjectBySlug(slug: string) {
  return state.projects.find((entry) => entry.slug === slug) ?? null;
}

function uniqueProjectSlug(base: string) {
  const normalized = safeHandle(base) || `project-${Math.random().toString(36).slice(2, 8)}`;
  const slugs = new Set(state.projects.map((entry) => entry.slug));
  if (!slugs.has(normalized)) return normalized;
  let i = 2;
  while (slugs.has(`${normalized}-${i}`)) i += 1;
  return `${normalized}-${i}`;
}

export function createProject(input: {
  userId: string;
  title: string;
  description: string;
  slug?: string;
}) {
  const user = findUserById(input.userId);
  if (!user) return null;

  const project: Project = {
    id: id("prj"),
    userId: user.id,
    slug: input.slug ? uniqueProjectSlug(input.slug) : uniqueProjectSlug(input.title),
    title: input.title,
    description: input.description,
    state: "planned",
    artifacts: [],
    buildLog: [],
    createdAt: nowIso(),
    updatedAt: nowIso(),
  };

  state.projects.push(project);

  addBuildLogEntry({
    projectId: project.id,
    userId: user.id,
    level: "info",
    message: `Project ${project.title} created.`,
  });

  return project;
}

export function enqueueJob(input: {
  type: string;
  payload: Record<string, unknown>;
  userId?: string | null;
  projectId?: string | null;
  maxAttempts?: number;
}): AgentJob {
  const job: AgentJob = {
    id: id("job"),
    type: input.type,
    payload: input.payload,
    userId: input.userId ?? null,
    projectId: input.projectId ?? null,
    status: "queued",
    attempts: 0,
    maxAttempts: input.maxAttempts ?? 3,
    createdAt: nowIso(),
    updatedAt: nowIso(),
    leaseUntil: null,
    lastErrorCode: null,
  };
  state.jobs.push(job);

  appendJobEvent({
    jobId: job.id,
    userId: job.userId,
    projectId: job.projectId,
    type: "job.queued",
    message: `${job.type} queued`,
    payload: job.payload,
  });

  return job;
}

export function appendJobEvent(input: {
  jobId: string;
  userId: string | null;
  projectId: string | null;
  type: string;
  message: string;
  payload?: Record<string, unknown>;
}) {
  const event: AgentJobEvent = {
    id: id("evt"),
    jobId: input.jobId,
    userId: input.userId,
    projectId: input.projectId,
    type: input.type,
    message: input.message,
    payload: input.payload,
    createdAt: nowIso(),
  };
  state.jobEvents.push(event);
  return event;
}

export function listProjectEvents(projectId: string) {
  return state.jobEvents.filter((entry) => entry.projectId === projectId);
}

export function listUserEvents(userId: string) {
  return state.jobEvents.filter((entry) => entry.userId === userId);
}

export function claimJobs(workerId: string, limit = 5): AgentJob[] {
  const claimed: AgentJob[] = [];
  for (const job of state.jobs) {
    if (claimed.length >= limit) break;
    if (job.status !== "queued") continue;
    job.status = "claimed";
    job.attempts += 1;
    job.updatedAt = nowIso();
    job.leaseUntil = new Date(Date.now() + 60_000).toISOString();
    job.payload = { ...job.payload, claimedBy: workerId };
    claimed.push(job);

    appendJobEvent({
      jobId: job.id,
      userId: job.userId,
      projectId: job.projectId,
      type: "job.claimed",
      message: `${job.type} claimed by ${workerId}`,
    });
  }
  return claimed;
}

export function transitionJob(jobId: string, status: AgentJobStatus, errorCode?: string | null) {
  const job = state.jobs.find((entry) => entry.id === jobId);
  if (!job) return null;
  job.status = status;
  job.updatedAt = nowIso();

  if (status === "completed" || status === "failed" || status === "cancelled") {
    job.leaseUntil = null;
  }
  if (errorCode) job.lastErrorCode = errorCode;

  appendJobEvent({
    jobId: job.id,
    userId: job.userId,
    projectId: job.projectId,
    type: `job.${status}`,
    message: errorCode ? `${job.type} ${status} (${errorCode})` : `${job.type} ${status}`,
    payload: errorCode ? { errorCode } : undefined,
  });

  return job;
}

function artifactExtension(kind: ArtifactKind) {
  switch (kind) {
    case "website":
      return "html";
    case "pptx":
      return "pptx";
    case "pdf":
      return "pdf";
    case "resume_docx":
      return "docx";
    case "resume_pdf":
      return "pdf";
    default:
      return "bin";
  }
}

export function processJob(jobId: string, options?: { forceFailCode?: string }) {
  const job = state.jobs.find((entry) => entry.id === jobId);
  if (!job) return null;

  transitionJob(job.id, "running");

  const failCode = options?.forceFailCode ?? (job.payload.forceFailCode as string | undefined);
  if (failCode) {
    transitionJob(job.id, "failed", failCode);
    if (job.projectId && job.userId) {
      addBuildLogEntry({
        projectId: job.projectId,
        userId: job.userId,
        level: "error",
        message: `Job ${job.type} failed with ${failCode}`,
        metadata: { errorCode: failCode },
      });
    }
    return { ok: false, job };
  }

  if (job.type === "project.chat" && job.projectId && job.userId) {
    const message = String(job.payload.message ?? "");
    addBuildLogEntry({
      projectId: job.projectId,
      userId: job.userId,
      level: "info",
      message: `${PLATFORM_NAME} reply generated for: ${message.slice(0, 80)}`,
    });
  }

  if ((job.type === "project.generate_website" || job.type === "project.generate_artifact") && job.projectId && job.userId) {
    const project = findProjectById(job.projectId);
    const user = findUserById(job.userId);
    if (project && user) {
      const kind = (job.payload.kind as ArtifactKind | undefined) ?? "website";
      const artifact = {
        kind,
        url: `/generated/${project.slug}/${kind}-${Date.now()}.${artifactExtension(kind)}`,
        createdAt: nowIso(),
      };
      project.artifacts.push(artifact);
      project.state = project.artifacts.length >= verificationPolicy.builtMinArtifacts ? "built" : "building";
      project.updatedAt = nowIso();

      addBuildLogEntry({
        projectId: project.id,
        userId: user.id,
        level: "success",
        message: `Artifact generated: ${kind}`,
      });

      const career = getCareerPath(user.careerPathId);
      if (career) {
        const targetSkill = career.modules[0] ?? "Applied AI";
        updateSkill(user, targetSkill, "built", verificationPolicy.projectMinScore + 0.1, 1);

        state.verificationEvents.push({
          id: id("ver"),
          userId: user.id,
          projectId: project.id,
          skill: targetSkill,
          eventType: "artifact_generated",
          details: { kind, artifactUrl: artifact.url },
          createdAt: nowIso(),
        });
      }

      user.tokensUsed += 950;
      touchProfile(user);
    }
  }

  transitionJob(job.id, "completed");
  return { ok: true, job };
}

function ensureUserExists(userId: string) {
  return findUserById(userId) ?? findUserById(defaultUserId);
}

export function addProjectChatMessage(input: { projectId: string; userId: string; message: string; forceFailCode?: string }) {
  const project = findProjectById(input.projectId);
  const user = ensureUserExists(input.userId);
  if (!project || !user) return null;

  addBuildLogEntry({
    projectId: project.id,
    userId: user.id,
    level: "info",
    message: `User message: ${input.message}`,
  });

  const job = enqueueJob({
    type: "project.chat",
    userId: user.id,
    projectId: project.id,
    payload: { message: input.message, forceFailCode: input.forceFailCode ?? null },
  });

  const result = processJob(job.id, { forceFailCode: input.forceFailCode });
  return {
    job,
    result,
    reply:
      result && result.ok
        ? `${PLATFORM_NAME}: focus next on ${getCareerPath(user.careerPathId)?.modules[0] ?? "core AI module"}.`
        : null,
  };
}

export function requestArtifactGeneration(input: {
  projectId: string;
  userId: string;
  kind: ArtifactKind;
  forceFailCode?: string;
}) {
  const project = findProjectById(input.projectId);
  if (!project) return null;

  project.state = "building";
  project.updatedAt = nowIso();

  const job = enqueueJob({
    type: input.kind === "website" ? "project.generate_website" : "project.generate_artifact",
    userId: input.userId,
    projectId: input.projectId,
    payload: { kind: input.kind, forceFailCode: input.forceFailCode ?? null },
  });

  const result = processJob(job.id, { forceFailCode: input.forceFailCode });
  return { job, result, project: findProjectById(input.projectId) };
}

export function updateProfile(userId: string, patch: Partial<UserProfile>) {
  const user = findUserById(userId);
  if (!user) return null;

  const allowList: Array<keyof UserProfile> = [
    "name",
    "avatarUrl",
    "headline",
    "bio",
    "careerPathId",
    "tools",
    "socialLinks",
    "goals",
    "acquisition",
  ];

  for (const key of allowList) {
    if (key in patch && patch[key] !== undefined) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (user as any)[key] = patch[key];
    }
  }

  if (patch.handle && patch.handle !== user.handle) {
    user.handle = uniqueHandle(patch.handle);
  }

  touchProfile(user);
  return user;
}

export function publishProfile(userId: string) {
  const user = findUserById(userId);
  if (!user) return null;

  user.published = true;
  touchProfile(user);

  appendJobEvent({
    jobId: "profile",
    userId,
    projectId: null,
    type: "profile.published",
    message: `Profile /u/${user.handle} published`,
  });

  return user;
}

export function listTalent(filters?: {
  role?: string;
  skill?: string;
  tool?: string;
  status?: SkillStatus;
  q?: string;
}) {
  const query = filters?.q?.toLowerCase().trim();
  return state.talent.filter((candidate) => {
    if (filters?.role && candidate.role !== filters.role) return false;
    if (filters?.skill && !candidate.topSkills.includes(filters.skill)) return false;
    if (filters?.tool && !candidate.topTools.includes(filters.tool)) return false;
    if (filters?.status && candidate.status !== filters.status) return false;
    if (query) {
      const haystack = `${candidate.name} ${candidate.role} ${candidate.topSkills.join(" ")} ${candidate.topTools.join(" ")}`.toLowerCase();
      if (!haystack.includes(query)) return false;
    }
    return true;
  });
}

export function getTalentByHandle(handle: string) {
  return state.talent.find((entry) => entry.handle === handle) ?? null;
}

export function createEmployerLead(input: {
  employerName: string;
  employerEmail: string;
  handle: string;
  note: string;
}) {
  const lead: EmployerLead = {
    id: id("lead"),
    employerName: input.employerName,
    employerEmail: input.employerEmail,
    handle: input.handle,
    note: input.note,
    createdAt: nowIso(),
  };
  state.employerLeads.push(lead);
  return lead;
}

export function createSocialDrafts(input: {
  userId: string;
  projectId?: string | null;
  forceFailCode?: string;
}) {
  if (input.forceFailCode) {
    return { ok: false as const, errorCode: input.forceFailCode, drafts: [] as SocialDraft[] };
  }

  const user = findUserById(input.userId);
  if (!user) return { ok: false as const, errorCode: "USER_NOT_FOUND", drafts: [] as SocialDraft[] };

  const project = input.projectId ? findProjectById(input.projectId) : null;
  const publicBase = `http://localhost:6396/u/${user.handle}`;
  const targetUrl = project ? `${publicBase}/projects/${project.slug}` : publicBase;
  const ogUrl = project
    ? `http://localhost:6396/api/og/project/${user.handle}/${project.slug}`
    : `http://localhost:6396/api/og/profile/${user.handle}`;

  const baseText = project
    ? `I shipped ${project.title} with ${PLATFORM_NAME}. Platform Verified build log + artifacts.`
    : `I am building AI-native skills with ${PLATFORM_NAME}. Platform Verified projects and proof.`;

  const linkedinText = `${baseText} ${targetUrl}`;
  const xText = `${baseText} ${targetUrl}`;

  const drafts: SocialDraft[] = [
    {
      id: id("draft"),
      userId: user.id,
      projectId: project?.id ?? null,
      platform: "linkedin",
      text: linkedinText,
      ogUrl,
      shareUrl: `https://www.linkedin.com/feed/?shareActive=true&text=${encodeURIComponent(linkedinText)}`,
      status: "draft",
      createdAt: nowIso(),
      updatedAt: nowIso(),
    },
    {
      id: id("draft"),
      userId: user.id,
      projectId: project?.id ?? null,
      platform: "x",
      text: xText,
      ogUrl,
      shareUrl: `https://twitter.com/intent/tweet?text=${encodeURIComponent(xText)}`,
      status: "draft",
      createdAt: nowIso(),
      updatedAt: nowIso(),
    },
  ];

  state.socialDrafts.push(...drafts);
  return { ok: true as const, drafts };
}

export function listSocialDrafts(userId: string) {
  return state.socialDrafts.filter((entry) => entry.userId === userId);
}

function platformToConnection(platform: SocialPlatform) {
  return platform === "linkedin" ? "linkedin" : "x";
}

export function publishSocialDraft(input: {
  draftId: string;
  mode: PublishMode;
  forceFailCode?: string;
}) {
  const draft = state.socialDrafts.find((entry) => entry.id === input.draftId);
  if (!draft) return { ok: false as const, errorCode: "DRAFT_NOT_FOUND", draft: null };

  if (input.forceFailCode) {
    draft.status = "failed";
    draft.updatedAt = nowIso();
    return { ok: false as const, errorCode: input.forceFailCode, draft };
  }

  if (input.mode === "api") {
    const required = platformToConnection(draft.platform);
    const connection = ensureOAuthConnection(draft.userId, required);
    if (!connection.connected) {
      draft.status = "failed";
      draft.updatedAt = nowIso();
      markOAuthFailure(draft.userId, required, "OAUTH_NOT_CONNECTED");
      return { ok: false as const, errorCode: "OAUTH_NOT_CONNECTED", draft };
    }

    draft.status = "failed";
    draft.updatedAt = nowIso();
    return { ok: false as const, errorCode: "SOCIAL_API_POST_UNAVAILABLE", draft };
  }

  if (input.mode === "composer") {
    draft.updatedAt = nowIso();
    return { ok: true as const, draft, composerUrl: draft.shareUrl };
  }

  return { ok: false as const, errorCode: "INVALID_MODE", draft };
}

export function refreshRelevantNews(options?: { forceFailCode?: string; userId?: string; contextSignals?: string[] }) {
  if (options?.forceFailCode) {
    return { ok: false as const, errorCode: options.forceFailCode, insights: [] as NewsInsight[] };
  }

  const user = options?.userId ? findUserById(options.userId) : null;
  const careerPath = user ? getCareerPath(user.careerPathId) : null;
  const focus = options?.contextSignals?.slice(0, 3) ?? [];

  const generated: NewsInsight[] = [
    {
      id: id("news"),
      title: "Model capability leap: longer-context agents are shipping production eval gates",
      url: "https://openai.com/news/",
      summary:
        "Teams are pairing larger-context models with stricter eval pipelines to reduce regressions before deployment.",
      careerPathIds: [user?.careerPathId ?? "software-engineering", "quality-assurance"],
      publishedAt: nowIso(),
      learnerProfileId: user?.id ?? null,
      source: "OpenAI News",
      category: "capabilities",
      relevanceScore: 84,
      rankingScore: 88,
      impact: "high",
      whyRelevant: careerPath
        ? `Directly impacts ${careerPath.name} execution quality and reliability decisions.`
        : "Directly impacts AI project reliability decisions.",
      recommendedAction: "Add one evaluation checklist for every new model or prompt change this week.",
      contextSignals: focus,
    },
    {
      id: id("news"),
      title: "Tooling shift: workflow automation stacks now bundle built-in AI agents",
      url: "https://www.anthropic.com/news",
      summary:
        "Modern automation platforms are reducing setup time for multi-step AI workflows across GTM, support, and ops.",
      careerPathIds: [user?.careerPathId ?? "operations", "marketing-seo", "sales-revops"],
      publishedAt: nowIso(),
      learnerProfileId: user?.id ?? null,
      source: "Anthropic News",
      category: "tools",
      relevanceScore: 80,
      rankingScore: 84,
      impact: "medium",
      whyRelevant: user?.tools.length
        ? `Matches your current tool stack (${user.tools.slice(0, 3).join(", ")}).`
        : "Improves execution speed for active AI projects.",
      recommendedAction: "Prototype one repetitive workflow with an agent-first tool and compare time saved.",
      contextSignals: focus,
    },
    {
      id: id("news"),
      title: "Workforce trend: AI copilots are changing entry-level role expectations",
      url: "https://www.weforum.org/stories/",
      summary:
        "Companies are updating hiring rubrics toward AI-augmented execution, emphasizing proof-of-work and adaptation speed.",
      careerPathIds: [user?.careerPathId ?? "operations", "customer-support", "product-management"],
      publishedAt: nowIso(),
      learnerProfileId: user?.id ?? null,
      source: "World Economic Forum",
      category: "job_displacement",
      relevanceScore: 86,
      rankingScore: 90,
      impact: "high",
      whyRelevant: user?.goals.length
        ? `Aligned with your goals (${user.goals.slice(0, 2).join(", ")}) and career positioning.`
        : "Important for career resilience and role positioning.",
      recommendedAction: "Ship one public, measurable AI project artifact to strengthen your market signal.",
      contextSignals: focus,
    },
  ];

  const otherRows = state.newsInsights.filter((entry) => entry.learnerProfileId !== (user?.id ?? null));
  state.newsInsights = [...generated, ...otherRows];
  return { ok: true as const, insights: generated };
}

export function listNewsInsights() {
  return state.newsInsights;
}

export function createDailyUpdate(input: { userId: string; forceFailCode?: string }) {
  const user = findUserById(input.userId);
  if (!user) return { ok: false as const, errorCode: "USER_NOT_FOUND", update: null };

  if (input.forceFailCode) {
    const failed: DailyUpdate = {
      id: id("update"),
      userId: input.userId,
      status: "failed",
      summary: "Daily update failed due to provider error.",
      upcomingTasks: [],
      newsIds: [],
      createdAt: nowIso(),
      failureCode: input.forceFailCode,
    };
    state.dailyUpdates.unshift(failed);
    return { ok: false as const, errorCode: input.forceFailCode, update: failed };
  }

  const projects = listProjectsByUser(user.id);
  const recentNews = state.newsInsights
    .filter((entry) => entry.learnerProfileId === user.id || entry.learnerProfileId == null)
    .slice(0, 3);
  const update: DailyUpdate = {
    id: id("update"),
    userId: user.id,
    status: "sent",
    summary: `You have ${projects.length} active projects and ${user.skills.length} tracked skills.`,
    upcomingTasks: [
      "Complete one module checkpoint",
      "Generate one new artifact",
      "Publish one social post draft",
    ],
    newsIds: recentNews.map((entry) => entry.id),
    createdAt: nowIso(),
    failureCode: null,
  };

  state.dailyUpdates.unshift(update);
  return { ok: true as const, update };
}

export function latestDailyUpdate(userId: string) {
  return state.dailyUpdates.find((entry) => entry.userId === userId) ?? null;
}

export function getDashboardSummary(userId: string): DashboardSummary | null {
  const user = findUserById(userId);
  if (!user) return null;

  return {
    user,
    projects: listProjectsByUser(userId),
    pendingJobs: state.jobs.filter((job) => job.userId === userId && ["queued", "claimed", "running"].includes(job.status)),
    latestEvents: listUserEvents(userId).slice(-20),
    moduleRecommendations: getModuleTracksForCareerPath(user.careerPathId),
    dailyUpdate: latestDailyUpdate(userId),
  };
}

export function getEmployerFacets() {
  return getEmployerFilterFacets();
}

export function createVerificationEvent(input: Omit<VerificationEvent, "id" | "createdAt">) {
  const event: VerificationEvent = {
    id: id("ver"),
    createdAt: nowIso(),
    ...input,
  };
  state.verificationEvents.push(event);
  return event;
}

export function listVerificationEvents(userId: string) {
  return state.verificationEvents.filter((entry) => entry.userId === userId);
}

export function applyVerificationForSkill(input: {
  userId: string;
  skill: string;
  score: number;
  evidenceCountDelta?: number;
}) {
  const user = findUserById(input.userId);
  if (!user) return null;

  const requestedStatus: SkillStatus =
    input.score >= verificationPolicy.projectMinScore && (input.evidenceCountDelta ?? 0) + 1 >= verificationPolicy.builtMinArtifacts
      ? "verified"
      : "built";

  updateSkill(user, input.skill, requestedStatus, input.score, input.evidenceCountDelta ?? 1);
  const final = user.skills.find((entry) => entry.skill === input.skill) as UserSkill;

  createVerificationEvent({
    userId: user.id,
    projectId: null,
    skill: input.skill,
    eventType: final.status === "verified" ? "verification_passed" : "module_completed",
    details: { score: input.score, evidenceCount: final.evidenceCount },
  });

  touchProfile(user);
  return final;
}

export function getCatalogData() {
  return {
    careerPaths: CAREER_PATHS,
    moduleTracks: MODULE_TRACKS,
    facets: getEmployerFilterFacets(),
    verificationPolicy,
  };
}

export function generateProfileOgSvg(input: {
  name: string;
  handle: string;
  headline: string;
  status: string;
}) {
  const headline = escapeXml(input.headline);
  const name = escapeXml(input.name);
  const handle = escapeXml(input.handle);
  const status = escapeXml(input.status);

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#0f172a"/>
      <stop offset="100%" stop-color="#111827"/>
    </linearGradient>
  </defs>
  <rect width="1200" height="630" fill="url(#g)"/>
  <rect x="60" y="60" width="1080" height="510" rx="24" fill="rgba(255,255,255,0.06)" stroke="rgba(16,185,129,0.65)"/>
  <text x="100" y="180" font-size="64" font-family="Inter,Arial,sans-serif" fill="#f8fafc" font-weight="700">${name}</text>
  <text x="100" y="240" font-size="34" font-family="Inter,Arial,sans-serif" fill="#34d399">@${handle}</text>
  <text x="100" y="320" font-size="38" font-family="Inter,Arial,sans-serif" fill="#e2e8f0">${headline}</text>
  <text x="100" y="430" font-size="30" font-family="Inter,Arial,sans-serif" fill="#67e8f9">${status}</text>
  <text x="100" y="520" font-size="24" font-family="Inter,Arial,sans-serif" fill="#94a3b8">${PLATFORM_NAME} | System-Verified Proof of Work</text>
</svg>`;
}

export function generateProjectOgSvg(input: {
  title: string;
  handle: string;
  projectSlug: string;
  state: string;
}) {
  const title = escapeXml(input.title);
  const handle = escapeXml(input.handle);
  const projectSlug = escapeXml(input.projectSlug);
  const stateValue = escapeXml(input.state);

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
  <defs>
    <linearGradient id="g2" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#052e2b"/>
      <stop offset="100%" stop-color="#0f172a"/>
    </linearGradient>
  </defs>
  <rect width="1200" height="630" fill="url(#g2)"/>
  <rect x="56" y="56" width="1088" height="518" rx="24" fill="rgba(255,255,255,0.06)" stroke="rgba(6,182,212,0.6)"/>
  <text x="96" y="170" font-size="34" font-family="Inter,Arial,sans-serif" fill="#67e8f9">Project Proof</text>
  <text x="96" y="250" font-size="64" font-family="Inter,Arial,sans-serif" fill="#f8fafc" font-weight="700">${title}</text>
  <text x="96" y="330" font-size="30" font-family="Inter,Arial,sans-serif" fill="#34d399">/${handle}/projects/${projectSlug}</text>
  <text x="96" y="420" font-size="30" font-family="Inter,Arial,sans-serif" fill="#e2e8f0">State: ${stateValue}</text>
  <text x="96" y="510" font-size="24" font-family="Inter,Arial,sans-serif" fill="#cbd5e1">System-Verified Proof of Work | ${PLATFORM_NAME}</text>
</svg>`;
}

function escapeXml(input: string) {
  return input
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}
