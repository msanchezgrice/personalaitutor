"use client";

import { useState } from "react";

type Insight = {
  id: string;
  title: string;
  url: string;
  summary: string;
};

type DailyUpdate = {
  id: string;
  status: "sent" | "failed";
  summary: string;
  upcomingTasks: string[];
  createdAt: string;
  failureCode: string | null;
};

export function UpdatesConsole() {
  const [insights, setInsights] = useState<Insight[]>([]);
  const [update, setUpdate] = useState<DailyUpdate | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const refreshNews = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/scheduler/news-refresh", { method: "POST" });
      const data = (await res.json()) as { ok: boolean; insights?: Insight[]; error?: { message: string } };
      if (!res.ok || !data.ok || !data.insights) {
        throw new Error(data.error?.message ?? "Unable to refresh relevant AI news");
      }
      setInsights(data.insights);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to refresh relevant AI news");
    } finally {
      setLoading(false);
    }
  };

  const sendDailyUpdate = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/scheduler/daily-update", { method: "POST" });
      const data = (await res.json()) as { ok: boolean; update?: DailyUpdate; error?: { message: string } };
      if (!res.ok || !data.ok || !data.update) {
        throw new Error(data.error?.message ?? "Unable to send daily update");
      }
      setUpdate(data.update);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to send daily update");
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="panel" style={{ marginTop: 14 }}>
      <h3>Daily updates + relevant AI news module</h3>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 10 }}>
        <button type="button" className="btn" disabled={loading} onClick={refreshNews}>Refresh News</button>
        <button type="button" className="btn primary" disabled={loading} onClick={sendDailyUpdate}>Send Daily Update</button>
        <a className="btn" href="/emails/daily-update" target="_blank" rel="noreferrer">Preview Daily Email</a>
        <a className="btn" href="/emails/fail-state-alert" target="_blank" rel="noreferrer">Preview Fail-State Email</a>
      </div>

      {insights.length ? (
        <div className="card" style={{ marginTop: 12 }}>
          <strong>Relevant news</strong>
          <ul className="list">
            {insights.map((insight) => (
              <li key={insight.id}>
                <a href={insight.url} target="_blank" rel="noreferrer">{insight.title}</a>: {insight.summary}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {update ? (
        <div className={update.status === "sent" ? "success-box" : "fail-box"} style={{ marginTop: 12 }}>
          <p><strong>Status:</strong> {update.status}</p>
          <p>{update.summary}</p>
          {update.upcomingTasks.length ? (
            <ul className="list">
              {update.upcomingTasks.map((task) => (
                <li key={task}>{task}</li>
              ))}
            </ul>
          ) : null}
          {update.failureCode ? <p><strong>Failure code:</strong> {update.failureCode}</p> : null}
        </div>
      ) : null}

      {error ? <div className="fail-box" style={{ marginTop: 10 }}>{error}</div> : null}
    </section>
  );
}
