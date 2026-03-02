"use client";

import { useEffect, useMemo, useRef, useState } from "react";

type ProjectRow = { id: string; title: string };

type EventRow = {
  id: string;
  type: string;
  message: string;
  createdAt: string;
};

export function ProjectChat() {
  const [projects, setProjects] = useState<ProjectRow[]>([]);
  const [projectId, setProjectId] = useState<string>("");
  const [events, setEvents] = useState<EventRow[]>([]);
  const [message, setMessage] = useState("Help me convert today’s build into a LinkedIn-ready project update.");
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState("idle");
  const sourceRef = useRef<EventSource | null>(null);

  const selectedTitle = useMemo(
    () => projects.find((entry) => entry.id === projectId)?.title ?? "",
    [projects, projectId],
  );

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

  useEffect(() => {
    if (!projectId) return;

    sourceRef.current?.close();
    const source = new EventSource(`/api/projects/${projectId}/events`);
    sourceRef.current = source;
    setStatus("connecting");
    setError(null);

    source.addEventListener("ready", () => setStatus("streaming"));
    source.addEventListener("events", (payload) => {
      try {
        const data = JSON.parse((payload as MessageEvent).data) as { events: EventRow[] };
        setEvents((prev) => [...prev, ...data.events]);
      } catch {
        setError("Unable to decode event payload");
      }
    });
    source.addEventListener("complete", () => {
      setStatus("completed");
      source.close();
    });
    source.onerror = () => {
      setStatus("disconnected");
      setError("Fail state: stream disconnected. Retry by reloading the page.");
      source.close();
    };

    return () => {
      source.close();
    };
  }, [projectId]);

  const send = async () => {
    if (!projectId || !message.trim()) return;
    setError(null);

    const res = await fetch(`/api/projects/${projectId}/chat`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ message }),
    });
    const data = (await res.json()) as { ok: boolean; reply?: string; error?: { message: string } };
    if (!res.ok || !data.ok) {
      setError(data.error?.message ?? "Unable to send message");
      return;
    }

    if (data.reply) {
      const reply = data.reply;
      setEvents((prev) => [
        ...prev,
        {
          id: `local_${Date.now()}`,
          type: "chat.reply",
          message: reply,
          createdAt: new Date().toISOString(),
        },
      ]);
    }

    setMessage("");
  };

  return (
    <section className="panel" style={{ marginTop: 14 }}>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
        <select className="input" style={{ maxWidth: 340 }} value={projectId} onChange={(e) => setProjectId(e.target.value)}>
          {projects.map((project) => (
            <option key={project.id} value={project.id}>{project.title}</option>
          ))}
        </select>
        <span className="tag">Stream: {status}</span>
      </div>

      <p className="lead">Project: {selectedTitle || "No project selected"}</p>

      <div className="card" style={{ maxHeight: 300, overflow: "auto", marginTop: 10 }}>
        {events.length ? (
          events.map((event) => (
            <article key={event.id} style={{ marginBottom: 10 }}>
              <strong>{event.type}</strong>
              <p style={{ margin: "4px 0" }}>{event.message}</p>
              <small>{new Date(event.createdAt).toLocaleString()}</small>
            </article>
          ))
        ) : (
          <p>No events yet.</p>
        )}
      </div>

      <div style={{ marginTop: 10 }}>
        <label htmlFor="chat-message">Message to AI Tutor</label>
        <textarea id="chat-message" className="input" rows={3} value={message} onChange={(e) => setMessage(e.target.value)} />
        <button type="button" className="btn primary" style={{ marginTop: 8 }} onClick={send}>Send</button>
      </div>

      {error ? <div className="fail-box" style={{ marginTop: 10 }}>{error}</div> : null}
    </section>
  );
}
