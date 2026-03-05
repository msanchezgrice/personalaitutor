"use client";

import { useMemo, useState } from "react";
import type { GoalType, SituationStatus } from "@aitutor/shared";
import { CAREER_PATHS } from "@aitutor/shared";
import {
  fbOnboardingStart,
  fbQuizStart,
  fbQuizComplete,
  fbOnboardingComplete,
} from "@/lib/fb-pixel";
import { trackAdLead } from "@/lib/ad-conversions";

type OnboardingStartResponse = {
  ok: true;
  user: { id: string; handle: string; name: string };
  session: { id: string; userId: string };
};

type AssessmentResponse = {
  ok: true;
  assessment: { id: string; score: number; recommendedCareerPathIds: string[] };
};

const situationOptions: Array<{ value: SituationStatus; label: string }> = [
  { value: "employed", label: "Employed" },
  { value: "unemployed", label: "Unemployed" },
  { value: "student", label: "Student" },
  { value: "founder", label: "Founder" },
  { value: "freelancer", label: "Freelancer" },
  { value: "career_switcher", label: "Career switcher" },
];

const goalOptions: Array<{ value: GoalType; label: string }> = [
  { value: "build_business", label: "Learn to build a business" },
  { value: "upskill_current_job", label: "Get better at my current job" },
  { value: "showcase_for_job", label: "Showcase AI skills for hiring" },
  { value: "learn_foundations", label: "Learn core AI foundations" },
  { value: "ship_ai_projects", label: "Ship portfolio projects" },
];

const quizQuestions = [
  "I can explain when to use RAG vs fine-tuning.",
  "I can automate repetitive work using AI tools.",
  "I can design prompts and evals for quality outcomes.",
  "I can ship a small AI feature to production.",
  "I can explain the business value of an AI workflow.",
];

export function OnboardingWizard() {
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [name, setName] = useState("TEST_USER_ONBOARDING");
  const [handleBase, setHandleBase] = useState("test-user");
  const [careerPathId, setCareerPathId] = useState(CAREER_PATHS[0].id);
  const [situation, setSituation] = useState<SituationStatus>("employed");
  const [selectedGoals, setSelectedGoals] = useState<GoalType[]>(["upskill_current_job"]);
  const [linkedinUrl, setLinkedinUrl] = useState("https://www.linkedin.com/in/test-user");
  const [resumeFilename, setResumeFilename] = useState("resume_test_user.pdf");
  const [quizValues, setQuizValues] = useState<number[]>([2, 2, 2, 2, 2]);

  const [sessionId, setSessionId] = useState<string | null>(null);
  const [user, setUser] = useState<{ id: string; handle: string; name: string } | null>(null);
  const [assessmentId, setAssessmentId] = useState<string | null>(null);
  const [assessmentResult, setAssessmentResult] = useState<AssessmentResponse["assessment"] | null>(null);

  const canContinueGoals = selectedGoals.length > 0;

  const recommendedPathNames = useMemo(() => {
    if (!assessmentResult) return [];
    return assessmentResult.recommendedCareerPathIds
      .map((id) => CAREER_PATHS.find((entry) => entry.id === id)?.name)
      .filter(Boolean) as string[];
  }, [assessmentResult]);

  const toggleGoal = (goal: GoalType) => {
    setSelectedGoals((prev) =>
      prev.includes(goal) ? prev.filter((entry) => entry !== goal) : [...prev, goal],
    );
  };

  const startOnboarding = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/onboarding/start", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name, handleBase, careerPathId }),
      });
      const data = (await res.json()) as OnboardingStartResponse | { ok: false; error: { message: string } };
      if (!res.ok || !data.ok) {
        throw new Error(data && "error" in data ? data.error.message : "Unable to start onboarding session");
      }
      setSessionId(data.session.id);
      setUser(data.user);
      fbOnboardingStart();
      setStep(2);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to start onboarding session");
    } finally {
      setLoading(false);
    }
  };

  const saveSituation = async () => {
    if (!sessionId || !canContinueGoals) return;

    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/onboarding/situation", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ sessionId, situation, goals: selectedGoals }),
      });
      const data = (await res.json()) as { ok: boolean; error?: { message: string } };
      if (!res.ok || !data.ok) {
        throw new Error(data.error?.message ?? "Unable to save situation");
      }
      setStep(3);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to save situation");
    } finally {
      setLoading(false);
    }
  };

  const saveCareerImport = async () => {
    if (!sessionId) return;

    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/onboarding/career-import", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          sessionId,
          careerPathId,
          linkedinUrl,
          resumeFilename,
        }),
      });
      const data = (await res.json()) as { ok: boolean; error?: { message: string } };
      if (!res.ok || !data.ok) {
        throw new Error(data.error?.message ?? "Unable to import career data");
      }

      const assessmentStart = await fetch("/api/assessment/start", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ sessionId }),
      });
      const assessment = (await assessmentStart.json()) as { ok: boolean; assessment?: { id: string }; error?: { message: string } };
      if (!assessmentStart.ok || !assessment.ok || !assessment.assessment) {
        throw new Error(assessment.error?.message ?? "Unable to start assessment");
      }

      setAssessmentId(assessment.assessment.id);
      fbQuizStart();
      setStep(4);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to complete career import step");
    } finally {
      setLoading(false);
    }
  };

  const submitQuiz = async () => {
    if (!assessmentId) return;

    setLoading(true);
    setError(null);
    try {
      const answers = quizValues.map((value, index) => ({ questionId: `q_${index + 1}`, value }));
      const res = await fetch("/api/assessment/submit", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ assessmentId, answers }),
      });
      const data = (await res.json()) as AssessmentResponse | { ok: false; error: { message: string } };
      if (!res.ok || !data.ok) {
        throw new Error(data && "error" in data ? data.error.message : "Unable to submit assessment");
      }
      setAssessmentResult(data.assessment);
      fbQuizComplete(data.assessment.score, data.assessment.recommendedCareerPathIds);
      trackAdLead({
        score: data.assessment.score,
        sessionId,
        source: "legacy_onboarding_wizard",
      });
      fbOnboardingComplete();
      setStep(5);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to submit assessment");
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="panel" style={{ marginTop: 16 }}>
      <h3>Step {step} of 5</h3>
      {error ? <div className="fail-box" style={{ marginTop: 10 }}>{error}</div> : null}

      {step === 1 ? (
        <div className="grid-2" style={{ marginTop: 12 }}>
          <article className="card">
            <label htmlFor="name">Display name</label>
            <input id="name" className="input" value={name} onChange={(e) => setName(e.target.value)} />
            <label htmlFor="handleBase" style={{ marginTop: 10, display: "block" }}>Public handle base</label>
            <input id="handleBase" className="input" value={handleBase} onChange={(e) => setHandleBase(e.target.value)} />
            <label htmlFor="careerPath" style={{ marginTop: 10, display: "block" }}>Career path</label>
            <select id="careerPath" className="input" value={careerPathId} onChange={(e) => setCareerPathId(e.target.value)}>
              {CAREER_PATHS.map((path) => (
                <option key={path.id} value={path.id}>{path.name} - {path.coreSkillDomain}</option>
              ))}
            </select>
            <button type="button" className="btn primary" style={{ marginTop: 12 }} disabled={loading} onClick={startOnboarding}>
              {loading ? "Starting..." : "Start Onboarding"}
            </button>
          </article>
          <article className="card">
            <h4>How this creates your dashboard</h4>
            <ul className="list">
              <li>Creates a new learner profile and unique URL handle.</li>
              <li>Initializes onboarding session state and API audit events.</li>
              <li>Loads matrix-driven module recommendations for your track.</li>
            </ul>
          </article>
        </div>
      ) : null}

      {step === 2 ? (
        <div className="grid-2" style={{ marginTop: 12 }}>
          <article className="card">
            <label htmlFor="situation">Current situation</label>
            <select id="situation" className="input" value={situation} onChange={(e) => setSituation(e.target.value as SituationStatus)}>
              {situationOptions.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
            <p className="lead">What are your goals?</p>
            <div style={{ display: "grid", gap: 8 }}>
              {goalOptions.map((goal) => (
                <label key={goal.value} style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  <input
                    type="checkbox"
                    checked={selectedGoals.includes(goal.value)}
                    onChange={() => toggleGoal(goal.value)}
                  />
                  <span>{goal.label}</span>
                </label>
              ))}
            </div>
            <button
              type="button"
              className="btn primary"
              style={{ marginTop: 12 }}
              disabled={!canContinueGoals || loading}
              onClick={saveSituation}
            >
              {loading ? "Saving..." : "Save and Continue"}
            </button>
          </article>
          <article className="card">
            <h4>Session</h4>
            <p><strong>Session ID:</strong> {sessionId}</p>
            <p><strong>User:</strong> {user?.name}</p>
            <p><strong>Handle:</strong> {user?.handle}</p>
          </article>
        </div>
      ) : null}

      {step === 3 ? (
        <div className="grid-2" style={{ marginTop: 12 }}>
          <article className="card">
            <label htmlFor="linkedin">LinkedIn profile URL</label>
            <input id="linkedin" className="input" value={linkedinUrl} onChange={(e) => setLinkedinUrl(e.target.value)} />
            <label htmlFor="resume" style={{ marginTop: 10, display: "block" }}>Resume filename</label>
            <input id="resume" className="input" value={resumeFilename} onChange={(e) => setResumeFilename(e.target.value)} />
            <label htmlFor="career" style={{ marginTop: 10, display: "block" }}>Career path</label>
            <select id="career" className="input" value={careerPathId} onChange={(e) => setCareerPathId(e.target.value)}>
              {CAREER_PATHS.map((path) => (
                <option key={path.id} value={path.id}>{path.name}</option>
              ))}
            </select>
            <button type="button" className="btn primary" style={{ marginTop: 12 }} disabled={loading} onClick={saveCareerImport}>
              {loading ? "Importing..." : "Import and Start Assessment"}
            </button>
            <div style={{ marginTop: 10, display: "flex", gap: 8, flexWrap: "wrap" }}>
              <a className="btn" href="/api/auth/linkedin/start?redirect=1">Connect LinkedIn</a>
              <a className="btn" href="/assessment" target="_blank" rel="noreferrer">Open Full Assessment</a>
            </div>
          </article>
          <article className="card">
            <p>Importer flow aligns with your requested LinkedIn/resume onboarding.</p>
            <div className="success-box" style={{ marginTop: 10 }}>
              This step sets your career path and starts the assessment attempt.
            </div>
          </article>
        </div>
      ) : null}

      {step === 4 ? (
        <div className="grid-2" style={{ marginTop: 12 }}>
          <article className="card">
            <p className="lead">Rate your confidence (0 to 5)</p>
            {quizQuestions.map((question, index) => (
              <div key={question} style={{ marginBottom: 12 }}>
                <label>{question}</label>
                <input
                  className="input"
                  type="range"
                  min={0}
                  max={5}
                  value={quizValues[index]}
                  onChange={(e) => {
                    const next = [...quizValues];
                    next[index] = Number(e.target.value);
                    setQuizValues(next);
                  }}
                />
                <small>Selected: {quizValues[index]}</small>
              </div>
            ))}
            <button type="button" className="btn primary" disabled={loading} onClick={submitQuiz}>
              {loading ? "Submitting..." : "Submit Assessment"}
            </button>
          </article>
          <article className="card">
            <p><strong>Assessment ID:</strong> {assessmentId}</p>
            <p>Your My AI Skill Tutor agent will use this score to generate module recommendations and dashboard focus.</p>
          </article>
        </div>
      ) : null}

      {step === 5 ? (
        <div style={{ marginTop: 12 }}>
          <div className="success-box">
            Assessment completed for {user?.name}. Score: {assessmentResult?.score}. Dashboard generated.
          </div>
          <div className="panel" style={{ marginTop: 12 }}>
            <h4>Recommended paths</h4>
            <ul className="list">
              {recommendedPathNames.map((name) => (
                <li key={name}>{name}</li>
              ))}
            </ul>
            <div style={{ marginTop: 12, display: "flex", gap: 8, flexWrap: "wrap" }}>
              <a className="btn primary" href="/dashboard">Open Dashboard</a>
              <a className="btn" href={user ? `/u/${user.handle}` : "/dashboard/profile"}>Open Public Profile</a>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
