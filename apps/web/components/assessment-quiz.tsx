"use client";

import { useState } from "react";
import { fbQuizStart, fbQuizComplete } from "@/lib/fb-pixel";
import { trackAdLead } from "@/lib/ad-conversions";

const questions = [
  "I can choose the right model for a business task.",
  "I can write prompts that reliably produce structured output.",
  "I can integrate an AI API into a simple workflow.",
  "I can evaluate model output quality and define thresholds.",
  "I can communicate AI project impact with metrics.",
];

export function AssessmentQuiz() {
  const [assessmentId, setAssessmentId] = useState<string | null>(null);
  const [values, setValues] = useState<number[]>([2, 2, 2, 2, 2]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ score: number; recommendedCareerPathIds: string[] } | null>(null);

  const start = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/assessment/start", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({}),
      });
      const data = (await res.json()) as { ok: boolean; assessment?: { id: string }; error?: { message: string } };
      if (!res.ok || !data.ok || !data.assessment) {
        throw new Error(data.error?.message ?? "Unable to start assessment");
      }
      setAssessmentId(data.assessment.id);
      fbQuizStart();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to start assessment");
    } finally {
      setLoading(false);
    }
  };

  const submit = async () => {
    if (!assessmentId) return;

    setLoading(true);
    setError(null);
    try {
      const answers = values.map((value, index) => ({ questionId: `assessment_q_${index + 1}`, value }));
      const res = await fetch("/api/assessment/submit", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ assessmentId, answers }),
      });
      const data = (await res.json()) as {
        ok: boolean;
        assessment?: { score: number; recommendedCareerPathIds: string[] };
        error?: { message: string };
      };
      if (!res.ok || !data.ok || !data.assessment) {
        throw new Error(data.error?.message ?? "Unable to submit assessment");
      }

      setResult({
        score: data.assessment.score,
        recommendedCareerPathIds: data.assessment.recommendedCareerPathIds,
      });
      fbQuizComplete(data.assessment.score, data.assessment.recommendedCareerPathIds);
      trackAdLead({
        score: data.assessment.score,
        source: "assessment_quiz_component",
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to submit assessment");
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="panel" style={{ marginTop: 16 }}>
      <h3>AI Capability Assessment</h3>
      <p className="lead">Internal assessment flow used by onboarding and module recommendation logic.</p>
      <div style={{ marginTop: 10, display: "flex", gap: 8, flexWrap: "wrap" }}>
        <button type="button" className="btn" onClick={start} disabled={loading}>Start Attempt</button>
        <button type="button" className="btn primary" onClick={submit} disabled={loading || !assessmentId}>Submit Attempt</button>
        {assessmentId ? <span className="tag">Attempt: {assessmentId}</span> : null}
      </div>

      <div style={{ marginTop: 14 }}>
        {questions.map((question, index) => (
          <div key={question} style={{ marginBottom: 12 }}>
            <label>{question}</label>
            <input
              className="input"
              type="range"
              min={0}
              max={5}
              value={values[index]}
              onChange={(e) => {
                const next = [...values];
                next[index] = Number(e.target.value);
                setValues(next);
              }}
            />
            <small>Score: {values[index]}</small>
          </div>
        ))}
      </div>

      {error ? <div className="fail-box">{error}</div> : null}
      {result ? (
        <div className="success-box">
          Score: {result.score}. Recommended paths: {result.recommendedCareerPathIds.join(", ")}.
        </div>
      ) : null}
    </section>
  );
}
