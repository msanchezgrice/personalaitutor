"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ASSESSMENT_QUIZ_QUESTIONS } from "@/lib/assessment-quiz";
import { captureAnalyticsEvent, getOrCreateFunnelVisitorId } from "@/lib/analytics";

/**
 * Anonymous assessment flow — no account required. Role + goals + quiz run
 * before any gate; email is captured at the end to deliver the report.
 * Persisted server-side via /api/assessment/anonymous/* keyed by an
 * unguessable session token.
 */

type Step = "role" | "goals" | "quiz" | "generating" | "email";

const ASSESSMENT_FUNNEL = "anonymous_assessment";

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
  { value: "qa", label: "Quality Assurance", path: "quality-assurance" },
  { value: "other", label: "Other", path: "operations" },
] as const;

const yearsExperienceOptions = [
  { value: "0-1", label: "Less than 1 year" },
  { value: "1-3", label: "1-3 years" },
  { value: "3-5", label: "3-5 years" },
  { value: "5-10", label: "5-10 years" },
  { value: "10+", label: "10+ years" },
] as const;

const companySizeOptions = [
  { value: "", label: "Company size (optional)" },
  { value: "startup", label: "Startup (1-50)" },
  { value: "small", label: "Small (51-200)" },
  { value: "medium", label: "Medium (201-1000)" },
  { value: "large", label: "Large (1000+)" },
] as const;

const situationOptions = [
  { value: "employed", label: "Employed" },
  { value: "unemployed", label: "Unemployed" },
  { value: "student", label: "Student" },
  { value: "founder", label: "Founder" },
  { value: "freelancer", label: "Freelancer" },
  { value: "career_switcher", label: "Career Switcher" },
] as const;

const goalOptions = [
  { value: "upskill_current_job", label: "Upskill for current job" },
  { value: "find_new_role", label: "Find a new role" },
  { value: "showcase_for_job", label: "Showcase skills for a new role" },
  { value: "ship_ai_projects", label: "Ship AI projects" },
  { value: "build_business", label: "Build a business" },
  { value: "learn_foundations", label: "Learn foundations" },
] as const;

const generatingSteps = [
  "Reading your role and goals",
  "Scoring your answers against your role's market",
  "Ranking your skill gaps by market impact",
  "Drafting your 30-day plan",
  "Finalizing your AI-readiness score",
];

type StartPayload = {
  ok: boolean;
  sessionToken?: string;
  assessment?: { id: string };
  error?: { message?: string };
};

type SubmitPayload = {
  ok: boolean;
  score?: number;
  reportPath?: string;
  assessment?: { id: string };
  error?: { message?: string };
};

type EmailPayload = {
  ok: boolean;
  emailed?: boolean;
  reportPath?: string;
  error?: { message?: string };
};

async function postJson<T>(url: string, body: Record<string, unknown>): Promise<T> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json", "cache-control": "no-store" },
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

export function AnonymousAssessment() {
  const [step, setStep] = useState<Step>("role");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [generatingIndex, setGeneratingIndex] = useState(0);

  const [sessionToken, setSessionToken] = useState<string | null>(null);
  const [assessmentId, setAssessmentId] = useState<string | null>(null);

  const [careerCategory, setCareerCategory] = useState<(typeof careerCategoryOptions)[number]["value"]>("product-manager");
  const [jobTitle, setJobTitle] = useState("");
  const [yearsExperience, setYearsExperience] = useState<(typeof yearsExperienceOptions)[number]["value"]>("3-5");
  const [companySize, setCompanySize] = useState("");
  const [situation, setSituation] = useState<(typeof situationOptions)[number]["value"]>("employed");
  const [goals, setGoals] = useState<string[]>(["upskill_current_job"]);
  const [aiComfort, setAiComfort] = useState(3);
  const [linkedinUrl, setLinkedinUrl] = useState("");
  const [resumeText, setResumeText] = useState("");
  const [answers, setAnswers] = useState<Record<string, number>>({});

  const [score, setScore] = useState<number | null>(null);
  const [reportPath, setReportPath] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const [emailBusy, setEmailBusy] = useState(false);

  const startedFired = useRef(false);
  const startRequested = useRef(false);

  const selectedCareer = useMemo(
    () => careerCategoryOptions.find((entry) => entry.value === careerCategory) ?? careerCategoryOptions[0],
    [careerCategory],
  );

  const analyticsContext = useMemo(
    () => ({
      funnel: ASSESSMENT_FUNNEL,
      anonymous_assessment_id: assessmentId,
      career_category: careerCategory,
      career_path_id: selectedCareer.path,
      years_experience: yearsExperience,
      situation,
      goals_count: goals.length,
      ai_comfort: aiComfort,
    }),
    [aiComfort, assessmentId, careerCategory, goals.length, selectedCareer.path, situation, yearsExperience],
  );

  const ensureSession = async (): Promise<string> => {
    if (sessionToken) return sessionToken;
    const payload = await postJson<StartPayload>("/api/assessment/anonymous/start", {
      careerPathId: selectedCareer.path,
      visitorId: getOrCreateFunnelVisitorId(),
    });
    if (!payload.sessionToken) {
      throw new Error("Unable to start the assessment");
    }
    setSessionToken(payload.sessionToken);
    if (payload.assessment?.id) setAssessmentId(payload.assessment.id);
    return payload.sessionToken;
  };

  useEffect(() => {
    if (startedFired.current) return;
    startedFired.current = true;
    captureAnalyticsEvent("anonymous_assessment_started", {
      funnel: ASSESSMENT_FUNNEL,
      step: "role",
    });
  }, []);

  useEffect(() => {
    if (startRequested.current || sessionToken) return;
    startRequested.current = true;
    void ensureSession().catch(() => {
      startRequested.current = false;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (step !== "generating") return;
    const timer = window.setInterval(() => {
      setGeneratingIndex((prev) => (prev + 1) % generatingSteps.length);
    }, 2200);
    return () => window.clearInterval(timer);
  }, [step]);

  const toggleGoal = (goal: string) => {
    setGoals((prev) => (prev.includes(goal) ? prev.filter((entry) => entry !== goal) : [...prev, goal]));
  };

  const setAnswer = (questionId: string, value: number) => {
    setAnswers((prev) => ({ ...prev, [questionId]: value }));
  };

  const answeredCount = ASSESSMENT_QUIZ_QUESTIONS.filter((question) => answers[question.id] !== undefined).length;

  const validateGoalsStep = () => {
    if (!goals.length) return "Select at least one goal.";
    if (linkedinUrl.trim()) {
      try {
        const parsed = new URL(linkedinUrl.trim());
        if (!parsed.hostname.includes("linkedin.com")) return "LinkedIn URL must be on linkedin.com.";
      } catch {
        return "LinkedIn URL format is invalid.";
      }
    }
    return null;
  };

  const runAnalysis = async () => {
    setError(null);
    if (answeredCount < ASSESSMENT_QUIZ_QUESTIONS.length) {
      setError("Answer all five questions to get an accurate score.");
      return;
    }
    setStep("generating");
    setBusy(true);
    try {
      const token = await ensureSession();
      const payload = await postJson<SubmitPayload>("/api/assessment/anonymous/submit", {
        sessionToken: token,
        careerPathId: selectedCareer.path,
        careerCategoryLabel: selectedCareer.label,
        jobTitle: jobTitle.trim() || undefined,
        yearsExperience,
        companySize: companySize || null,
        situation,
        goals,
        aiComfort,
        linkedinUrl: linkedinUrl.trim() || null,
        resumeText: resumeText.trim() || null,
        answers: ASSESSMENT_QUIZ_QUESTIONS.map((question) => ({
          questionId: question.id,
          value: answers[question.id] ?? 0,
        })),
      });

      const nextScore = typeof payload.score === "number" ? payload.score : null;
      setScore(nextScore);
      setReportPath(payload.reportPath ?? null);
      captureAnalyticsEvent("anonymous_assessment_completed", {
        ...analyticsContext,
        score: nextScore,
      });
      setStep("email");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to generate your report");
      setStep("quiz");
    } finally {
      setBusy(false);
    }
  };

  const submitEmail = async () => {
    setError(null);
    if (!sessionToken) {
      setError("Your session expired. Restart the assessment.");
      return;
    }
    setEmailBusy(true);
    try {
      const payload = await postJson<EmailPayload>("/api/assessment/anonymous/email", {
        sessionToken,
        email: email.trim(),
      });
      captureAnalyticsEvent("assessment_email_captured", {
        ...analyticsContext,
        emailed: Boolean(payload.emailed),
        score,
      });
      window.location.href = payload.reportPath ?? reportPath ?? "/assessment/";
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to save your email");
      setEmailBusy(false);
    }
  };

  const stepIndex = step === "role" ? 1 : step === "goals" ? 2 : step === "quiz" ? 3 : step === "generating" ? 4 : 5;
  const progressPercent = stepIndex * 20;

  const inputClass =
    "w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-white placeholder:text-gray-500 focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 transition-colors";
  const labelClass = "block text-sm font-medium mb-2 text-gray-300";

  return (
    <div className="relative min-h-screen bg-[#0b0f19] text-gray-200 overflow-x-hidden px-4 py-10 md:px-6">
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-[420px]"
        style={{ background: "radial-gradient(ellipse at top, rgba(16,185,129,0.12), transparent 60%)" }}
      />
      <div className="relative max-w-3xl mx-auto">
        <div className="text-center mb-8">
          <a href="/" className="inline-flex items-center gap-3 mb-2">
            <img src="/assets/branding/brand_brain_icon.svg" alt="My AI Skill Tutor" className="h-10 w-10 object-contain" />
            <span className="font-[Outfit] font-bold text-3xl tracking-tight text-white">My AI Skill Tutor</span>
          </a>
          <p className="text-sm text-gray-400">
            Free AI-readiness assessment · No account required · ~2 minutes
          </p>
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-8 md:p-10 shadow-2xl backdrop-blur">
          <div className="flex items-center justify-between mb-5">
            <h1 className="text-2xl md:text-3xl font-[Outfit] font-semibold text-white">
              {step === "role" && "Your Role"}
              {step === "goals" && "Goals & Context"}
              {step === "quiz" && "Your AI Habits"}
              {step === "generating" && "Building Your Report"}
              {step === "email" && "Your Score Is Ready"}
            </h1>
            <span className="text-xs uppercase tracking-[0.18em] text-emerald-400 font-semibold">Step {stepIndex}/5</span>
          </div>

          <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden mb-8">
            <div
              className="h-full bg-gradient-to-r from-emerald-500 to-cyan-400 rounded-full transition-all duration-500"
              style={{ width: `${progressPercent}%` }}
            />
          </div>

          {error ? (
            <div className="mb-6 rounded-xl border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-300">
              {error}
            </div>
          ) : null}

          {step === "role" ? (
            <div className="space-y-5">
              <div>
                <label className={labelClass}>Career Category</label>
                <select
                  value={careerCategory}
                  onChange={(event) => setCareerCategory(event.target.value as (typeof careerCategoryOptions)[number]["value"])}
                  className={inputClass}
                >
                  {careerCategoryOptions.map((option) => (
                    <option key={option.value} value={option.value} className="bg-[#0b0f19]">
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className={labelClass}>Job Title (optional)</label>
                <input
                  type="text"
                  value={jobTitle}
                  onChange={(event) => setJobTitle(event.target.value)}
                  placeholder="e.g., Senior Product Manager"
                  className={inputClass}
                />
              </div>
              <div className="grid gap-5 sm:grid-cols-2">
                <div>
                  <label className={labelClass}>Years of Experience</label>
                  <select
                    value={yearsExperience}
                    onChange={(event) => setYearsExperience(event.target.value as (typeof yearsExperienceOptions)[number]["value"])}
                    className={inputClass}
                  >
                    {yearsExperienceOptions.map((option) => (
                      <option key={option.value} value={option.value} className="bg-[#0b0f19]">
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className={labelClass}>Company Size</label>
                  <select value={companySize} onChange={(event) => setCompanySize(event.target.value)} className={inputClass}>
                    {companySizeOptions.map((option) => (
                      <option key={option.value || "none"} value={option.value} className="bg-[#0b0f19]">
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div>
                <label className={labelClass}>Current Situation</label>
                <select
                  value={situation}
                  onChange={(event) => setSituation(event.target.value as (typeof situationOptions)[number]["value"])}
                  className={inputClass}
                >
                  {situationOptions.map((option) => (
                    <option key={option.value} value={option.value} className="bg-[#0b0f19]">
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          ) : null}

          {step === "goals" ? (
            <div className="space-y-6">
              <div>
                <label className={labelClass}>What are you here to do?</label>
                <div className="grid gap-2 sm:grid-cols-2">
                  {goalOptions.map((goal) => {
                    const checked = goals.includes(goal.value);
                    return (
                      <label
                        key={goal.value}
                        className={`rounded-xl border px-3 py-2.5 text-sm cursor-pointer transition-colors ${
                          checked
                            ? "border-emerald-400/60 bg-emerald-500/10 text-emerald-300"
                            : "border-white/10 bg-white/5 text-gray-300 hover:border-emerald-400/40"
                        }`}
                      >
                        <input
                          type="checkbox"
                          className="mr-2 align-middle accent-emerald-500"
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
                <label className={labelClass}>How comfortable are you with AI tools today?</label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { value: 2, label: "Beginner" },
                    { value: 3, label: "Intermediate" },
                    { value: 5, label: "Advanced" },
                  ].map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => setAiComfort(option.value)}
                      className={`rounded-xl border px-3 py-2.5 text-sm transition-colors ${
                        aiComfort === option.value
                          ? "border-emerald-400/60 bg-emerald-500/10 text-emerald-300"
                          : "border-white/10 bg-white/5 text-gray-300 hover:border-emerald-400/40"
                      }`}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className={labelClass}>LinkedIn Profile (optional)</label>
                <input
                  type="url"
                  value={linkedinUrl}
                  onChange={(event) => setLinkedinUrl(event.target.value)}
                  placeholder="https://linkedin.com/in/your-profile"
                  className={inputClass}
                />
              </div>
              <div>
                <label className={labelClass}>Paste your resume or LinkedIn summary (optional — sharpens your report)</label>
                <textarea
                  value={resumeText}
                  onChange={(event) => setResumeText(event.target.value)}
                  rows={4}
                  placeholder="A few lines about what you do, what you've shipped, and the tools you use..."
                  className={inputClass}
                />
              </div>
            </div>
          ) : null}

          {step === "quiz" ? (
            <div className="space-y-7">
              {ASSESSMENT_QUIZ_QUESTIONS.map((question, index) => (
                <div key={question.id}>
                  <p className="mb-3 text-[15px] text-white">
                    <span className="mr-2 text-emerald-400 font-semibold">{index + 1}.</span>
                    {question.question}
                  </p>
                  <div className="grid grid-cols-5 gap-2">
                    {[1, 2, 3, 4, 5].map((value) => (
                      <button
                        key={value}
                        type="button"
                        onClick={() => setAnswer(question.id, value)}
                        className={`rounded-lg border py-2 text-sm font-medium transition-colors ${
                          answers[question.id] === value
                            ? "border-emerald-400/70 bg-emerald-500/15 text-emerald-300"
                            : "border-white/10 bg-white/5 text-gray-400 hover:border-emerald-400/40"
                        }`}
                      >
                        {value}
                      </button>
                    ))}
                  </div>
                  <div className="mt-1.5 flex justify-between text-[11px] text-gray-500">
                    <span>{question.lowLabel}</span>
                    <span>{question.highLabel}</span>
                  </div>
                </div>
              ))}
            </div>
          ) : null}

          {step === "generating" ? (
            <div className="py-12 text-center">
              <div className="mx-auto mb-6 h-16 w-16 rounded-full border-4 border-emerald-500 border-t-transparent animate-spin" />
              <h2 className="text-2xl font-[Outfit] font-semibold text-white mb-5">Analyzing your answers…</h2>
              <div className="max-w-md mx-auto rounded-2xl border border-emerald-500/30 bg-emerald-500/5 px-5 py-4 text-sm text-emerald-200">
                {generatingSteps[generatingIndex]}
              </div>
              <p className="mt-4 text-xs text-gray-500">This usually takes 15-30 seconds.</p>
            </div>
          ) : null}

          {step === "email" ? (
            <div className="space-y-7">
              <div className="text-center">
                <div className="mx-auto relative h-36 w-36 mb-4">
                  <div
                    className="h-full w-full rounded-full"
                    style={{
                      background: `conic-gradient(#10b981 ${(score ?? 0) * 3.6}deg, rgba(255,255,255,0.08) 0deg)`,
                    }}
                  />
                  <div className="absolute inset-3 rounded-full bg-[#0d1322] flex flex-col items-center justify-center">
                    <span className="text-5xl font-bold text-emerald-400">{score ?? "–"}</span>
                    <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-gray-400 mt-1">
                      AI-Readiness
                    </span>
                  </div>
                </div>
                <h2 className="text-2xl font-[Outfit] font-semibold text-white">
                  Your AI-readiness score is {score ?? "ready"}.
                </h2>
                <p className="mt-2 text-sm text-gray-400 max-w-md mx-auto">
                  Your full report — strengths, skill gaps ranked by market impact, and a 30-day plan — is ready.
                  Enter your email and we&apos;ll send you the link so you can come back to it any time.
                </p>
              </div>
              <form
                onSubmit={(event) => {
                  event.preventDefault();
                  void submitEmail();
                }}
                className="mx-auto flex max-w-md flex-col gap-3 sm:flex-row"
              >
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="you@work-email.com"
                  className={inputClass}
                />
                <button
                  type="submit"
                  disabled={emailBusy}
                  className="whitespace-nowrap rounded-xl bg-emerald-500 px-6 py-3 text-sm font-semibold text-white transition hover:bg-emerald-400 disabled:opacity-60"
                >
                  {emailBusy ? "Opening…" : "See Your Full Report"}
                </button>
              </form>
              <p className="text-center text-xs text-gray-500">
                No spam — one email with your report link. Creating an account is optional.
              </p>
            </div>
          ) : null}

          {step === "role" || step === "goals" || step === "quiz" ? (
            <div className="mt-9 flex items-center justify-between border-t border-white/10 pt-6">
              <button
                type="button"
                className="rounded-xl border border-white/10 bg-white/5 px-5 py-2.5 text-sm text-gray-300 transition hover:border-white/25 disabled:opacity-40"
                onClick={() => {
                  setError(null);
                  setStep((prev) => (prev === "quiz" ? "goals" : "role"));
                }}
                disabled={busy || step === "role"}
              >
                Back
              </button>
              {step !== "quiz" ? (
                <button
                  type="button"
                  className="rounded-xl bg-emerald-500 px-7 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-400 disabled:opacity-60"
                  onClick={() => {
                    setError(null);
                    if (step === "goals") {
                      const validation = validateGoalsStep();
                      if (validation) {
                        setError(validation);
                        return;
                      }
                    }
                    setStep((prev) => (prev === "role" ? "goals" : "quiz"));
                  }}
                  disabled={busy}
                >
                  Continue →
                </button>
              ) : (
                <button
                  type="button"
                  className="rounded-xl bg-emerald-500 px-7 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-400 disabled:opacity-60"
                  onClick={() => void runAnalysis()}
                  disabled={busy || answeredCount < ASSESSMENT_QUIZ_QUESTIONS.length}
                >
                  {busy ? "Analyzing…" : "Get My Score"}
                </button>
              )}
            </div>
          ) : null}
        </div>

        <p className="mt-6 text-center text-xs text-gray-500">
          Already have an account?{" "}
          <a href="/sign-in?redirect_url=/dashboard/" className="text-emerald-400 hover:text-emerald-300">
            Sign in
          </a>
        </p>
      </div>
    </div>
  );
}
