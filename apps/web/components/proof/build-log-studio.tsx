"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { BuildLogDraft, BuildLogPost } from "@aitutor/shared";
import { BUILD_LOG_BODY_MAX, BUILD_LOG_TITLE_MAX } from "@aitutor/shared";
import { captureAnalyticsEvent } from "@/lib/analytics";
import { BuildLogMarkdown } from "@/lib/build-log/markdown";
import { formatBuildLogLongDate } from "@/lib/build-log/format";
import {
  BUILD_LOG_NOTES_MAX_CHARS,
  BUILD_LOG_NOTES_MIN_CHARS,
  BUILD_LOG_PUBLISH_MIN_BODY_CHARS,
  BUILD_LOG_SUMMARY_MAX,
} from "@/lib/build-log/limits";
import prose from "./build-log-prose.module.css";
import styles from "./build-log-studio.module.css";

export type BuildLogStudioPost = BuildLogPost & { path: string };

export type BuildLogStudioProps = {
  initialPosts: BuildLogStudioPost[];
  profile: { handle: string; name: string; published: boolean };
  suggestion: { title: string; summary: string | null; newTitle: string | null } | null;
  /** Absolute site origin, e.g. https://www.myaiskilltutor.com (for share links). */
  siteUrl: string;
  /** Load straight into the editor (fixture rendering and deep links). */
  initialView?: { kind: "list" } | { kind: "edit"; id: string } | { kind: "new"; title?: string };
};

type Fields = { title: string; summary: string; bodyMarkdown: string };
type SaveState =
  | { kind: "idle" }
  | { kind: "dirty" }
  | { kind: "saving" }
  | { kind: "saved"; at: string }
  | { kind: "error"; message: string };
type DraftState =
  | { kind: "idle" }
  | { kind: "running"; startedAt: number }
  | { kind: "review"; draft: BuildLogDraft }
  | { kind: "error"; message: string };

type ApiError = { code: string; message: string; recoveryAction?: string };
type ApiResult<T> = ({ ok: true } & T) | { ok: false; error: ApiError };

const AUTOSAVE_MS = 1500;

async function callApi<T>(url: string, init?: { method?: string; body?: unknown }): Promise<ApiResult<T>> {
  try {
    const response = await fetch(url, {
      method: init?.method ?? "GET",
      headers: init?.body !== undefined ? { "content-type": "application/json" } : undefined,
      body: init?.body !== undefined ? JSON.stringify(init.body) : undefined,
      credentials: "same-origin",
    });
    const data = (await response.json().catch(() => null)) as ApiResult<T> | null;
    if (!data) return { ok: false, error: { code: "BAD_RESPONSE", message: `The server answered ${response.status}.` } };
    return data;
  } catch {
    return { ok: false, error: { code: "NETWORK", message: "No connection. Check your network and try again." } };
  }
}

function errorSentence(error: ApiError): string {
  switch (error.code) {
    case "SUBSCRIPTION_REQUIRED":
      return "Your Career Builder trial or plan has ended. Restart it to keep writing.";
    case "UNAUTHENTICATED":
      return "You were signed out. Sign in again and retry.";
    case "OPENAI_CONFIG_MISSING":
      return "Drafting is not available right now. Write the post yourself, or try again later.";
    case "BUILD_LOG_DRAFT_FAILED":
      return `We could not draft your post. ${error.recoveryAction ?? "Try again in a minute."}`;
    case "BUILD_LOG_POST_NOT_FOUND":
      return "This post no longer exists.";
    default:
      return error.message || "Something went wrong. Try again.";
  }
}

function timeLabel(iso: string) {
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? "" : date.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
}

function sameFields(a: Fields, b: Fields) {
  return a.title === b.title && a.summary === b.summary && a.bodyMarkdown === b.bodyMarkdown;
}

function fieldsOf(post: Pick<BuildLogPost, "title" | "summary" | "bodyMarkdown"> | null): Fields {
  return { title: post?.title ?? "", summary: post?.summary ?? "", bodyMarkdown: post?.bodyMarkdown ?? "" };
}

function statusLabel(post: BuildLogPost, profilePublished: boolean) {
  if (post.status !== "published") return { text: "Draft", live: false };
  return profilePublished ? { text: "Live", live: true } : { text: "Published, site not live", live: false };
}

export function BuildLogStudio({ initialPosts, profile, suggestion, siteUrl, initialView }: BuildLogStudioProps) {
  const [posts, setPosts] = useState<BuildLogStudioPost[]>(initialPosts);
  const [view, setView] = useState<NonNullable<BuildLogStudioProps["initialView"]>>(initialView ?? { kind: "list" });
  const [notice, setNotice] = useState<string | null>(null);
  // One editor session per "open": saving a new post must not remount the editor.
  const [session, setSession] = useState(0);

  const openNew = (title?: string) => {
    setNotice(null);
    setSession((value) => value + 1);
    setView({ kind: "new", title });
  };
  const openPost = (id: string) => {
    setNotice(null);
    setSession((value) => value + 1);
    setView({ kind: "edit", id });
  };

  const upsertLocal = useCallback((post: BuildLogStudioPost) => {
    setPosts((current) => {
      const without = current.filter((entry) => entry.id !== post.id);
      return [post, ...without].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    });
  }, []);

  const removeLocal = useCallback((id: string) => {
    setPosts((current) => current.filter((entry) => entry.id !== id));
  }, []);

  const activePost = view.kind === "edit" ? posts.find((post) => post.id === view.id) ?? null : null;

  return (
    <div className={styles.studio}>
      {!profile.published ? (
        <p className={`rm-alert ${styles.siteNote}`} data-testid="build-log-site-unpublished">
          Your site is not published yet. Posts you publish go public once your site is.{" "}
          <a href="/dashboard/proof/site">Publish your site</a>
        </p>
      ) : null}
      {notice ? (
        <p className="rm-alert rm-alert--success" role="status">
          {notice}
        </p>
      ) : null}

      {view.kind === "list" ? (
        <PostList
          posts={posts}
          profilePublished={profile.published}
          suggestion={suggestion}
          onNew={openNew}
          onOpen={openPost}
        />
      ) : (
        <PostEditor
          key={session}
          post={activePost}
          initialTitle={view.kind === "new" ? view.title ?? "" : ""}
          profile={profile}
          suggestion={suggestion}
          siteUrl={siteUrl}
          onBack={() => setView({ kind: "list" })}
          onSaved={(post) => {
            upsertLocal(post);
            if (view.kind === "new") setView({ kind: "edit", id: post.id });
          }}
          onDeleted={(id) => {
            removeLocal(id);
            setNotice("Post deleted.");
            setView({ kind: "list" });
          }}
        />
      )}
    </div>
  );
}

function PostList({
  posts,
  profilePublished,
  suggestion,
  onNew,
  onOpen,
}: {
  posts: BuildLogStudioPost[];
  profilePublished: boolean;
  suggestion: BuildLogStudioProps["suggestion"];
  onNew: (title?: string) => void;
  onOpen: (id: string) => void;
}) {
  const suggestionUsed = suggestion ? posts.some((post) => post.title.trim().toLowerCase() === suggestion.title.trim().toLowerCase()) : true;
  return (
    <div className="rm-stack" style={{ gap: 24 }}>
      <div className={styles.listHead}>
        <div className="rm-stack" style={{ gap: 6 }}>
          <h2 className="rm-h3">Your posts</h2>
          <p className="rm-small">Short posts about what you built: what it is, how you made it, what broke, what is next.</p>
        </div>
        <button type="button" className="rm-btn rm-btn--primary" onClick={() => onNew()} data-testid="build-log-new">
          New post
        </button>
      </div>

      {suggestion && !suggestionUsed ? (
        <div className={`rm-card ${styles.suggestion}`} data-testid="build-log-suggestion">
          <p className="rm-kicker">Suggested first post, from your career map</p>
          <p className="rm-h4">{suggestion.title}</p>
          {suggestion.summary ? <p className="rm-p">{suggestion.summary}</p> : null}
          <div>
            <button type="button" className="rm-btn rm-btn--secondary rm-btn--sm" onClick={() => onNew(suggestion.title)}>
              Start this post
            </button>
          </div>
        </div>
      ) : null}

      {posts.length === 0 ? (
        <div className={`rm-card ${styles.empty}`}>
          <p className="rm-h4">No posts yet</p>
          <p className="rm-p">
            Paste your rough notes from this week and the tutor drafts a post from them. You review every word before it goes anywhere.
          </p>
        </div>
      ) : (
        <ul className={styles.postList} data-testid="build-log-post-list">
          {posts.map((post) => {
            const status = statusLabel(post, profilePublished);
            return (
              <li key={post.id}>
                <button type="button" className={styles.postRow} onClick={() => onOpen(post.id)}>
                  <span className={styles.postTitle}>{post.title}</span>
                  <span className={styles.postMeta}>
                    <span className={`${styles.badge} ${status.live ? styles.badgeLive : ""}`}>{status.text}</span>
                    <span>
                      {post.publishedAt ? `Published ${formatBuildLogLongDate(post.publishedAt)}` : `Started ${formatBuildLogLongDate(post.createdAt)}`}
                    </span>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function PostEditor({
  post,
  initialTitle,
  profile,
  suggestion,
  siteUrl,
  onBack,
  onSaved,
  onDeleted,
}: {
  post: BuildLogStudioPost | null;
  initialTitle: string;
  profile: BuildLogStudioProps["profile"];
  suggestion: BuildLogStudioProps["suggestion"];
  siteUrl: string;
  onBack: () => void;
  onSaved: (post: BuildLogStudioPost) => void;
  onDeleted: (id: string) => void;
}) {
  const [fields, setFields] = useState<Fields>(() => (post ? fieldsOf(post) : { title: initialTitle, summary: "", bodyMarkdown: "" }));
  const savedRef = useRef<Fields>(post ? fieldsOf(post) : { title: "", summary: "", bodyMarkdown: "" });
  const postRef = useRef<BuildLogStudioPost | null>(post);
  const [save, setSave] = useState<SaveState>(post ? { kind: "saved", at: post.updatedAt } : { kind: "idle" });
  const [publishing, setPublishing] = useState(false);
  const [actionMessage, setActionMessage] = useState<{ tone: "error" | "success"; text: string } | null>(null);
  const [deleting, setDeleting] = useState(false);
  const inFlight = useRef<Promise<BuildLogStudioPost | null> | null>(null);

  useEffect(() => {
    postRef.current = post;
  }, [post]);

  const dirty = !sameFields(fields, savedRef.current);
  const current = post;

  const persist = useCallback(async (): Promise<BuildLogStudioPost | null> => {
    if (inFlight.current) await inFlight.current;
    const snapshot = fields;
    if (!snapshot.title.trim()) {
      setSave({ kind: "error", message: "Add a title to save." });
      return null;
    }
    const existing = postRef.current;
    if (existing && sameFields(snapshot, savedRef.current)) return existing;
    setSave({ kind: "saving" });
    const run = (async () => {
      const result = existing
        ? await callApi<{ post: BuildLogStudioPost }>(`/api/build-log/${existing.id}`, { method: "PATCH", body: snapshot })
        : await callApi<{ post: BuildLogStudioPost }>("/api/build-log", { method: "POST", body: snapshot });
      if (!result.ok) {
        setSave({ kind: "error", message: errorSentence(result.error) });
        return null;
      }
      savedRef.current = fieldsOf(result.post);
      postRef.current = result.post;
      setSave({ kind: "saved", at: result.post.updatedAt });
      onSaved(result.post);
      return result.post;
    })();
    inFlight.current = run;
    try {
      return await run;
    } finally {
      inFlight.current = null;
    }
  }, [fields, onSaved]);

  // Autosave once the post exists; a new post is created by the first explicit save.
  useEffect(() => {
    if (!postRef.current || !dirty || !fields.title.trim()) return;
    const timer = window.setTimeout(() => {
      void persist();
    }, AUTOSAVE_MS);
    return () => window.clearTimeout(timer);
  }, [dirty, fields, persist]);

  useEffect(() => {
    if (dirty && save.kind !== "saving" && save.kind !== "error") setSave({ kind: "dirty" });
  }, [dirty, save.kind]);

  // Warn before leaving with unsaved edits.
  useEffect(() => {
    if (!dirty) return;
    const handler = (event: BeforeUnloadEvent) => {
      event.preventDefault();
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [dirty]);

  const update = (key: keyof Fields) => (event: { target: { value: string } }) => {
    const value = event.target.value;
    setFields((prev) => ({ ...prev, [key]: value }));
  };

  const absoluteUrl = current ? `${siteUrl}${current.path}` : null;
  const isLive = Boolean(current && current.status === "published" && profile.published);
  const publishBlocker =
    fields.title.trim().length < 3
      ? "Add a title before you publish."
      : fields.bodyMarkdown.trim().length < BUILD_LOG_PUBLISH_MIN_BODY_CHARS
        ? "Write a few sentences before you publish."
        : null;

  const togglePublish = async () => {
    setActionMessage(null);
    const wantPublished = !(current && current.status === "published");
    if (wantPublished && publishBlocker) {
      setActionMessage({ tone: "error", text: publishBlocker });
      return;
    }
    setPublishing(true);
    try {
      const saved = await persist();
      if (!saved) return;
      const result = await callApi<{ post: BuildLogStudioPost; profilePublished: boolean; live: boolean }>(
        `/api/build-log/${saved.id}/publish`,
        { method: "POST", body: { published: wantPublished } },
      );
      if (!result.ok) {
        setActionMessage({ tone: "error", text: errorSentence(result.error) });
        return;
      }
      postRef.current = result.post;
      onSaved(result.post);
      if (wantPublished) {
        captureAnalyticsEvent("build_log_published", {
          post_id: result.post.id,
          profile_published: result.profilePublished,
          first_publish: saved.publishedAt === null,
        });
        setActionMessage({
          tone: "success",
          text: result.live ? "Published. Your post is live." : "Published. It goes public once your site is published.",
        });
      } else {
        setActionMessage({ tone: "success", text: "Unpublished. The post is a draft again and its link no longer works." });
      }
    } finally {
      setPublishing(false);
    }
  };

  const remove = async () => {
    if (!current) {
      onBack();
      return;
    }
    if (!window.confirm(`Delete "${current.title}"? This cannot be undone.`)) return;
    setDeleting(true);
    const result = await callApi<{ deleted: boolean }>(`/api/build-log/${current.id}`, { method: "DELETE" });
    setDeleting(false);
    if (!result.ok) {
      setActionMessage({ tone: "error", text: errorSentence(result.error) });
      return;
    }
    savedRef.current = fields;
    onDeleted(current.id);
  };

  const copyLink = async () => {
    if (!absoluteUrl) return;
    try {
      await navigator.clipboard.writeText(absoluteUrl);
      setActionMessage({ tone: "success", text: "Link copied." });
    } catch {
      setActionMessage({ tone: "error", text: `Copy failed. The link is ${absoluteUrl}` });
    }
  };

  const applyDraft = (draft: BuildLogDraft) => {
    setFields({ title: draft.title, summary: draft.summary, bodyMarkdown: draft.bodyMarkdown });
    setSave({ kind: "dirty" });
  };

  const saveLabel = (() => {
    switch (save.kind) {
      case "saving":
        return "Saving…";
      case "saved":
        return dirty ? "Unsaved changes" : `Saved ${timeLabel(save.at)}`;
      case "dirty":
        return postRef.current ? "Unsaved changes, saving soon" : "Not saved yet";
      case "error":
        return save.message;
      default:
        return dirty ? "Not saved yet" : "Nothing to save yet";
    }
  })();

  const status = current ? statusLabel(current, profile.published) : { text: "New draft", live: false };

  return (
    <div className="rm-stack" style={{ gap: 24 }} data-testid="build-log-editor">
      <div className={styles.editorHead}>
        <button type="button" className={styles.backLink} onClick={onBack}>
          <span aria-hidden="true">←</span> All posts
        </button>
        <span className={`${styles.badge} ${status.live ? styles.badgeLive : ""}`}>{status.text}</span>
        <span
          className={`${styles.saveState} ${save.kind === "error" ? styles.saveError : ""}`}
          role="status"
          aria-live="polite"
          data-testid="build-log-save-state"
        >
          {saveLabel}
        </span>
      </div>

      <NotesDrafter currentTitle={fields.title} onUse={applyDraft} />

      <div className={styles.editorGrid}>
        <div className={`rm-card ${styles.form}`}>
          <div>
            <label className="rm-label" htmlFor="build-log-title">
              Title
            </label>
            <input
              id="build-log-title"
              className="rm-input"
              value={fields.title}
              maxLength={BUILD_LOG_TITLE_MAX}
              onChange={update("title")}
              placeholder={suggestion?.title ?? "I turned our launch checklist into one agent workflow"}
            />
            {suggestion && !fields.title.trim() ? (
              <p className="rm-field-hint">
                Suggested by your map:{" "}
                <button type="button" className={styles.inlineButton} onClick={() => setFields((prev) => ({ ...prev, title: suggestion.title }))}>
                  {suggestion.title}
                </button>
              </p>
            ) : null}
            {current?.publishedAt ? (
              <p className="rm-field-hint">The link stays the same if you change the title.</p>
            ) : null}
          </div>
          <div>
            <label className="rm-label" htmlFor="build-log-summary">
              Summary
            </label>
            <textarea
              id="build-log-summary"
              className="rm-textarea"
              style={{ minHeight: 80 }}
              value={fields.summary}
              maxLength={BUILD_LOG_SUMMARY_MAX}
              onChange={update("summary")}
              placeholder="One sentence: what this post is about."
            />
            <p className="rm-field-hint">
              {fields.summary.length}/{BUILD_LOG_SUMMARY_MAX}. Shown under the title and in link previews.
            </p>
          </div>
          <div>
            <label className="rm-label" htmlFor="build-log-body">
              Post
            </label>
            <textarea
              id="build-log-body"
              className={`rm-textarea ${styles.bodyInput}`}
              value={fields.bodyMarkdown}
              maxLength={BUILD_LOG_BODY_MAX}
              onChange={update("bodyMarkdown")}
              placeholder={"What I built\n\n## How I built it\n- Step one\n- Step two\n\n## What broke\n\n## What I would do next"}
            />
            <p className="rm-field-hint">
              Markdown: blank line between paragraphs, ## for headings, - for lists, **bold**, *italic*, `code`, [links](https://...).
            </p>
          </div>
          <div className={styles.actions}>
            <button type="button" className="rm-btn rm-btn--secondary" onClick={() => void persist()} disabled={save.kind === "saving" || (!dirty && Boolean(postRef.current))}>
              {postRef.current ? "Save" : "Save draft"}
            </button>
            <button
              type="button"
              className="rm-btn rm-btn--primary"
              onClick={() => void togglePublish()}
              disabled={publishing}
              data-testid="build-log-publish"
            >
              {publishing ? "Working…" : current?.status === "published" ? "Unpublish" : "Publish"}
            </button>
            <button type="button" className={`rm-btn rm-btn--secondary ${styles.danger}`} onClick={() => void remove()} disabled={deleting}>
              {deleting ? "Deleting…" : current ? "Delete" : "Discard"}
            </button>
          </div>
          {actionMessage ? (
            <p className={`rm-alert ${actionMessage.tone === "error" ? "rm-alert--error" : "rm-alert--success"}`} role="status">
              {actionMessage.text}
            </p>
          ) : null}
          {current ? (
            <div className={styles.share}>
              {isLive && absoluteUrl ? (
                <>
                  <button type="button" className="rm-btn rm-btn--secondary rm-btn--sm" onClick={() => void copyLink()}>
                    Copy public link
                  </button>
                  <a
                    className="rm-btn rm-btn--secondary rm-btn--sm"
                    href={`https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(absoluteUrl)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    data-testid="build-log-share-linkedin"
                  >
                    Share on LinkedIn
                  </a>
                  <a className="rm-btn rm-btn--secondary rm-btn--sm" href={current.path} target="_blank" rel="noopener">
                    View post
                  </a>
                </>
              ) : (
                <>
                  <a className="rm-btn rm-btn--secondary rm-btn--sm" href={current.path} target="_blank" rel="noopener">
                    Preview page
                  </a>
                  <span className="rm-small">
                    {current.status === "published"
                      ? "Sharing opens up once your site is published."
                      : "Publish to get a link you can share."}
                  </span>
                </>
              )}
            </div>
          ) : null}
        </div>

        <section className={`rm-card ${styles.preview}`} aria-label="Preview">
          <p className="rm-kicker rm-kicker--muted">Preview</p>
          <h2 className={`rm-h3 ${styles.previewTitle}`}>{fields.title.trim() || "Your title"}</h2>
          {fields.summary.trim() ? <p className={styles.previewSummary}>{fields.summary}</p> : null}
          {fields.bodyMarkdown.trim() ? (
            <BuildLogMarkdown markdown={fields.bodyMarkdown} className={`${prose.prose} ${prose.compact}`} />
          ) : (
            <p className="rm-small">Your post shows up here as you write.</p>
          )}
        </section>
      </div>
    </div>
  );
}

function NotesDrafter({ currentTitle, onUse }: { currentTitle: string; onUse: (draft: BuildLogDraft) => void }) {
  const [open, setOpen] = useState(false);
  const [notes, setNotes] = useState("");
  const [state, setState] = useState<DraftState>({ kind: "idle" });
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    if (state.kind !== "running") return;
    const timer = window.setInterval(() => setElapsed(Math.round((Date.now() - state.startedAt) / 1000)), 500);
    return () => window.clearInterval(timer);
  }, [state]);

  const tooShort = notes.trim().length < BUILD_LOG_NOTES_MIN_CHARS;
  const run = async () => {
    if (tooShort) return;
    setElapsed(0);
    setState({ kind: "running", startedAt: Date.now() });
    const result = await callApi<{ draft: BuildLogDraft }>("/api/build-log/draft", {
      method: "POST",
      body: { notes, title: currentTitle.trim() || undefined },
    });
    if (!result.ok) {
      setState({ kind: "error", message: errorSentence(result.error) });
      return;
    }
    setState({ kind: "review", draft: result.draft });
  };

  const phase = useMemo(() => {
    if (elapsed < 4) return "Reading your notes";
    if (elapsed < 12) return "Writing the post in your words";
    if (elapsed < 30) return "Checking it only says what your notes say";
    return "Still working. Long notes take a little longer";
  }, [elapsed]);

  if (!open) {
    return (
      <div className={`rm-card ${styles.drafter}`}>
        <div className={styles.drafterClosed}>
          <div className="rm-stack" style={{ gap: 4 }}>
            <p className="rm-h4">Draft from my notes</p>
            <p className="rm-small">Paste rough notes. The tutor turns them into a post using only what you wrote.</p>
          </div>
          <button type="button" className="rm-btn rm-btn--secondary rm-btn--sm" onClick={() => setOpen(true)} data-testid="build-log-open-drafter">
            Paste notes
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={`rm-card ${styles.drafter}`} data-testid="build-log-drafter">
      <div className="rm-stack" style={{ gap: 4 }}>
        <p className="rm-h4">Draft from my notes</p>
        <p className="rm-small">
          What you built, how, what broke, what is next. Bullet points are fine. Nothing is saved until you choose to use the draft.
        </p>
      </div>
      {state.kind === "review" ? (
        <div className="rm-stack" style={{ gap: 14 }} data-testid="build-log-draft-review">
          <div className={styles.reviewBox}>
            <p className="rm-h4">{state.draft.title}</p>
            <p className={styles.previewSummary}>{state.draft.summary}</p>
            <BuildLogMarkdown markdown={state.draft.bodyMarkdown} className={`${prose.prose} ${prose.compact}`} />
          </div>
          <p className="rm-small">Read it first. If anything is not true, fix it before you publish.</p>
          <div className={styles.actions}>
            <button
              type="button"
              className="rm-btn rm-btn--primary rm-btn--sm"
              onClick={() => {
                onUse(state.draft);
                setState({ kind: "idle" });
                setOpen(false);
              }}
            >
              Use this draft
            </button>
            <button type="button" className="rm-btn rm-btn--secondary rm-btn--sm" onClick={() => void run()}>
              Try again
            </button>
            <button type="button" className="rm-btn rm-btn--secondary rm-btn--sm" onClick={() => setState({ kind: "idle" })}>
              Discard
            </button>
          </div>
          <p className="rm-small">Using the draft replaces the title, summary and post in the editor.</p>
        </div>
      ) : (
        <>
          <div>
            <label className="rm-label" htmlFor="build-log-notes">
              Your notes
            </label>
            <textarea
              id="build-log-notes"
              className="rm-textarea"
              style={{ minHeight: 160 }}
              value={notes}
              maxLength={BUILD_LOG_NOTES_MAX_CHARS}
              onChange={(event) => setNotes(event.target.value)}
              disabled={state.kind === "running"}
              placeholder={"- built a workflow that turns our launch brief into a checklist\n- used ChatGPT + a Google Sheet\n- it kept skipping the localisation step\n- next: add a review step before it emails anyone"}
            />
            <p className="rm-field-hint">
              {notes.length.toLocaleString("en-US")}/{BUILD_LOG_NOTES_MAX_CHARS.toLocaleString("en-US")}
              {tooShort ? ` · at least ${BUILD_LOG_NOTES_MIN_CHARS} characters` : ""}
            </p>
          </div>
          {state.kind === "running" ? (
            <div className={styles.progress} role="status" aria-live="polite" data-testid="build-log-drafting">
              <span className={styles.progressBar} aria-hidden="true">
                <span />
              </span>
              <span>
                {phase}… {elapsed}s
              </span>
            </div>
          ) : null}
          {state.kind === "error" ? (
            <p className="rm-alert rm-alert--error" role="alert">
              {state.message}
            </p>
          ) : null}
          <div className={styles.actions}>
            <button
              type="button"
              className="rm-btn rm-btn--primary rm-btn--sm"
              onClick={() => void run()}
              disabled={tooShort || state.kind === "running"}
              data-testid="build-log-run-draft"
            >
              {state.kind === "running" ? "Drafting…" : state.kind === "error" ? "Try again" : "Draft my post"}
            </button>
            <button
              type="button"
              className="rm-btn rm-btn--secondary rm-btn--sm"
              onClick={() => setOpen(false)}
              disabled={state.kind === "running"}
            >
              Close
            </button>
          </div>
        </>
      )}
    </div>
  );
}
