"use client";

import { useEffect, useMemo, useState } from "react";

type ProjectRow = {
  id: string;
  slug: string;
  title: string;
  description: string;
  state: string;
  artifacts: Array<{ kind: string; url: string }>;
};

type SummaryResponse = {
  ok: boolean;
  summary?: {
    user: { id: string; handle: string };
    projects: ProjectRow[];
  };
  error?: { message: string };
};

export function ProjectWorkbench() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [projects, setProjects] = useState<ProjectRow[]>([]);
  const [userId, setUserId] = useState("user_test_0001");
  const [selectedProjectId, setSelectedProjectId] = useState<string>("");

  const [title, setTitle] = useState("PROJECT_DELTA_004");
  const [description, setDescription] = useState("An AI Tutor-powered workflow project to generate artifacts and public proof.");

  const selected = useMemo(() => projects.find((entry) => entry.id === selectedProjectId) ?? null, [projects, selectedProjectId]);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/dashboard/summary");
      const data = (await res.json()) as SummaryResponse;
      if (!res.ok || !data.ok || !data.summary) {
        throw new Error(data.error?.message ?? "Unable to load dashboard summary");
      }
      setProjects(data.summary.projects);
      setUserId(data.summary.user.id);
      if (!selectedProjectId && data.summary.projects[0]) {
        setSelectedProjectId(data.summary.projects[0].id);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load projects");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const createProject = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/projects", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ title, description, userId }),
      });
      const data = (await res.json()) as { ok: boolean; project?: ProjectRow; error?: { message: string } };
      if (!res.ok || !data.ok || !data.project) {
        throw new Error(data.error?.message ?? "Unable to create project");
      }
      const createdProject = data.project;
      setProjects((prev) => [...prev, createdProject]);
      setSelectedProjectId(createdProject.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to create project");
    } finally {
      setLoading(false);
    }
  };

  const runGenerator = async (path: string, body?: object) => {
    if (!selected) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/projects/${selected.id}/${path}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body ?? {}),
      });
      const data = (await res.json()) as { ok: boolean; error?: { message: string } };
      if (!res.ok || !data.ok) {
        throw new Error(data.error?.message ?? `Failed to run ${path}`);
      }
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : `Failed to run ${path}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="grid-2" style={{ marginTop: 14 }}>
      <section className="card">
        <h3>Create project</h3>
        <label htmlFor="project-title">Title</label>
        <input id="project-title" className="input" value={title} onChange={(e) => setTitle(e.target.value)} />
        <label htmlFor="project-desc" style={{ marginTop: 10, display: "block" }}>Description</label>
        <textarea id="project-desc" className="input" value={description} onChange={(e) => setDescription(e.target.value)} rows={4} />
        <button type="button" className="btn primary" style={{ marginTop: 12 }} disabled={loading} onClick={createProject}>
          Create Project
        </button>

        <h4 style={{ marginTop: 16 }}>Artifact generation</h4>
        <label htmlFor="selected-project">Project</label>
        <select
          id="selected-project"
          className="input"
          value={selectedProjectId}
          onChange={(e) => setSelectedProjectId(e.target.value)}
        >
          {projects.map((project) => (
            <option key={project.id} value={project.id}>{project.title} ({project.state})</option>
          ))}
        </select>

        <div style={{ marginTop: 10, display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button type="button" className="btn" onClick={() => runGenerator("generate-website")}>Generate Website</button>
          <button type="button" className="btn" onClick={() => runGenerator("generate-artifact", { kind: "pptx" })}>Generate PPT</button>
          <button type="button" className="btn" onClick={() => runGenerator("generate-artifact", { kind: "pdf" })}>Generate PDF</button>
          <button type="button" className="btn" onClick={() => runGenerator("generate-artifact", { kind: "resume_docx" })}>Generate Resume DOCX</button>
          <button type="button" className="btn" onClick={() => runGenerator("generate-artifact", { kind: "resume_pdf" })}>Generate Resume PDF</button>
        </div>

        {error ? <div className="fail-box" style={{ marginTop: 10 }}>{error}</div> : null}
      </section>

      <section className="card">
        <h3>Current project artifacts</h3>
        {selected ? (
          <>
            <p className="lead">{selected.description}</p>
            <p><strong>State:</strong> {selected.state}</p>
            <ul className="list">
              {selected.artifacts.length ? (
                selected.artifacts.map((artifact) => (
                  <li key={`${artifact.kind}-${artifact.url}`}>{artifact.kind} - <code>{artifact.url}</code></li>
                ))
              ) : (
                <li>No artifacts generated yet.</li>
              )}
            </ul>
          </>
        ) : (
          <p>No project selected.</p>
        )}
      </section>
    </div>
  );
}
