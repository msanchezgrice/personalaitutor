"use client";

import { useEffect, useState } from "react";

type Draft = {
  id: string;
  platform: "linkedin" | "x";
  text: string;
  ogUrl: string;
  shareUrl: string;
  status: "draft" | "published" | "failed";
};

export function SocialDrafts() {
  const [projects, setProjects] = useState<Array<{ id: string; title: string }>>([]);
  const [projectId, setProjectId] = useState<string>("");
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const load = async () => {
      const res = await fetch("/api/dashboard/summary");
      const data = (await res.json()) as {
        ok: boolean;
        summary?: { projects: Array<{ id: string; title: string }> };
      };
      if (res.ok && data.ok && data.summary) {
        setProjects(data.summary.projects);
        if (data.summary.projects[0]) {
          setProjectId(data.summary.projects[0].id);
        }
      }
    };
    void load();
  }, []);

  const generateDrafts = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/social/drafts/generate", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ projectId: projectId || null }),
      });
      const data = (await res.json()) as { ok: boolean; drafts?: Draft[]; error?: { message: string } };
      if (!res.ok || !data.ok || !data.drafts) {
        throw new Error(data.error?.message ?? "Unable to generate drafts");
      }
      setDrafts(data.drafts);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to generate drafts");
    } finally {
      setLoading(false);
    }
  };

  const publish = async (draftId: string, mode: "api" | "composer") => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/social/drafts/${draftId}/publish?mode=${mode}`, {
        method: "POST",
      });
      const data = (await res.json()) as {
        ok: boolean;
        draft?: Draft;
        composerUrl?: string;
        publishedUrl?: string;
        error?: { message: string };
      };
      if (!res.ok || !data.ok || !data.draft) {
        throw new Error(data.error?.message ?? "Unable to publish draft");
      }
      setDrafts((prev) => prev.map((entry) => (entry.id === data.draft?.id ? data.draft : entry)));
      if (mode === "composer" && data.composerUrl) {
        window.open(data.composerUrl, "_blank", "noopener,noreferrer");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to publish draft");
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="panel" style={{ marginTop: 14 }}>
      <h3>Generate and publish LinkedIn + X drafts</h3>
      <p className="lead">Supports direct API publish and native composer link mode with OG metadata targets.</p>

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", marginTop: 10 }}>
        <select className="input" style={{ maxWidth: 340 }} value={projectId} onChange={(e) => setProjectId(e.target.value)}>
          <option value="">Profile-level update</option>
          {projects.map((project) => (
            <option key={project.id} value={project.id}>{project.title}</option>
          ))}
        </select>
        <button type="button" className="btn primary" disabled={loading} onClick={generateDrafts}>Generate Drafts</button>
        <a className="btn" href="/api/auth/linkedin/start?redirect=1">Connect LinkedIn</a>
        <a className="btn" href="/api/auth/x/start?redirect=1">Connect X</a>
      </div>

      {drafts.length ? (
        <div className="grid-2" style={{ marginTop: 12 }}>
          {drafts.map((draft) => (
            <article className="card" key={draft.id}>
              <strong>{draft.platform.toUpperCase()}</strong>
              <p style={{ whiteSpace: "pre-wrap" }}>{draft.text}</p>
              <p><strong>OG:</strong> <code>{draft.ogUrl}</code></p>
              <p><strong>Status:</strong> {draft.status}</p>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <button type="button" className="btn" disabled={loading} onClick={() => publish(draft.id, "api")}>Publish via API</button>
                <button type="button" className="btn" disabled={loading} onClick={() => publish(draft.id, "composer")}>Open Native Composer</button>
              </div>
            </article>
          ))}
        </div>
      ) : null}

      {error ? (
        <div className="fail-box" style={{ marginTop: 10 }}>
          {error}. If this is an OAuth error, reconnect and retry publishing.
        </div>
      ) : null}
    </section>
  );
}
