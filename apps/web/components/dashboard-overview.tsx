"use client";

import { useEffect, useState } from "react";

type Summary = {
  user: { name: string; handle: string; tokensUsed: number; goals: string[] };
  projects: Array<{ id: string; title: string; state: string }>;
  latestEvents: Array<{ id: string; type: string; message: string; createdAt: string }>;
  moduleRecommendations: Array<{ id: string; title: string }>;
};

export function DashboardOverview() {
  const [summary, setSummary] = useState<Summary | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      const res = await fetch("/api/dashboard/summary");
      const data = (await res.json()) as { ok: boolean; summary?: Summary; error?: { message: string } };
      if (!res.ok || !data.ok || !data.summary) {
        setError(data.error?.message ?? "Unable to load dashboard summary");
        return;
      }
      setSummary(data.summary);
    };
    void load();
  }, []);

  if (error) {
    return <div className="fail-box" style={{ marginTop: 12 }}>{error}</div>;
  }

  if (!summary) {
    return <div className="panel" style={{ marginTop: 12 }}>Loading dashboard summary...</div>;
  }

  return (
    <section className="panel" style={{ marginTop: 14 }}>
      <h3>{summary.user.name} (@{summary.user.handle})</h3>
      <p className="lead">Tokens used: {summary.user.tokensUsed}</p>
      <div className="grid-3" style={{ marginTop: 12 }}>
        <article className="card">
          <strong>Projects</strong>
          <ul className="list">
            {summary.projects.map((project) => (
              <li key={project.id}>{project.title} ({project.state})</li>
            ))}
          </ul>
        </article>
        <article className="card">
          <strong>Recommended modules</strong>
          <ul className="list">
            {summary.moduleRecommendations.slice(0, 5).map((module) => (
              <li key={module.id}>{module.title}</li>
            ))}
          </ul>
        </article>
        <article className="card">
          <strong>Latest events</strong>
          <ul className="list">
            {summary.latestEvents.slice(-5).map((event) => (
              <li key={event.id}>{event.type}: {event.message}</li>
            ))}
          </ul>
        </article>
      </div>
    </section>
  );
}
