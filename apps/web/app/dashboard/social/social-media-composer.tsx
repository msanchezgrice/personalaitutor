"use client";

import { useState } from "react";

type SocialMediaComposerProps = {
  userId: string;
  projectId: string | null;
  userName: string;
  userHeadline: string;
  initialLinkedin: string;
  initialTweet: string;
  initialContext: string;
  initialSource: "llm" | "fallback";
};

type SocialIdeasResponse = {
  ok: boolean;
  ideas?: {
    linkedin: string;
    x: string;
    contextLabel: string;
    targetUrl: string;
  };
  source?: "llm" | "fallback";
  error?: {
    message?: string;
  };
};

type SocialDraftsResponse = {
  ok: boolean;
  drafts?: Array<{
    platform: "linkedin" | "x";
    text: string;
  }>;
  error?: {
    message?: string;
  };
};

function normalizeDraft(value: string) {
  return String(value || "")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function shareUrl(platform: "linkedin" | "x", text: string) {
  return platform === "linkedin"
    ? `https://www.linkedin.com/feed/?shareActive=true&text=${encodeURIComponent(text)}`
    : `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}`;
}

async function postJson<T>(url: string, body: Record<string, unknown>) {
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "cache-control": "no-store",
    },
    credentials: "same-origin",
    body: JSON.stringify(body),
  });

  const data = (await response.json().catch(() => ({}))) as T & {
    ok?: boolean;
    error?: { message?: string };
  };

  if (!response.ok || !data.ok) {
    throw new Error(data.error?.message || "Request failed");
  }

  return data;
}

export function SocialMediaComposer(props: SocialMediaComposerProps) {
  const [linkedinDraft, setLinkedinDraft] = useState(normalizeDraft(props.initialLinkedin));
  const [tweetDraft, setTweetDraft] = useState(normalizeDraft(props.initialTweet));
  const [contextLabel, setContextLabel] = useState(props.initialContext);
  const [sourceLabel, setSourceLabel] = useState(
    props.initialSource === "llm" ? "Personalized with user memory" : "Generated from profile context",
  );
  const [editingLinkedin, setEditingLinkedin] = useState(false);
  const [editingTweet, setEditingTweet] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [status, setStatus] = useState("");
  const [statusError, setStatusError] = useState(false);

  const userQuery = encodeURIComponent(props.userId);
  const ideasUrl = `/api/social/drafts/ideas?userId=${userQuery}`;
  const draftsUrl = `/api/social/drafts/generate?userId=${userQuery}`;

  async function refreshIdeas() {
    setRefreshing(true);
    setEditingLinkedin(false);
    setEditingTweet(false);
    setStatus("");

    try {
      const generated = await postJson<SocialIdeasResponse>(ideasUrl, {
        projectId: props.projectId,
      });
      const ideas = generated.ideas;
      if (!ideas?.linkedin || !ideas?.x) {
        throw new Error("Generated ideas were empty");
      }
      setLinkedinDraft(normalizeDraft(ideas.linkedin));
      setTweetDraft(normalizeDraft(ideas.x));
      setContextLabel(ideas.contextLabel || props.initialContext);
      setSourceLabel(generated.source === "llm" ? "Personalized with user memory" : "Generated from profile context");
      setStatus("Social ideas refreshed.");
      setStatusError(false);
      return;
    } catch {
      try {
        const fallback = await postJson<SocialDraftsResponse>(draftsUrl, {
          projectId: props.projectId,
        });
        const linkedin = fallback.drafts?.find((entry) => entry.platform === "linkedin")?.text || "";
        const tweet = fallback.drafts?.find((entry) => entry.platform === "x")?.text || "";
        setLinkedinDraft(normalizeDraft(linkedin));
        setTweetDraft(normalizeDraft(tweet));
        setContextLabel(props.projectId ? props.initialContext : "Profile momentum");
        setSourceLabel("Generated from template drafts");
        setStatus("Refreshed with fallback templates.");
        setStatusError(false);
      } catch (error) {
        setStatus(error instanceof Error ? error.message : "Failed to refresh social ideas.");
        setStatusError(true);
      }
    } finally {
      setRefreshing(false);
    }
  }

  function openNativeShare(platform: "linkedin" | "x") {
    const text = normalizeDraft(platform === "linkedin" ? linkedinDraft : tweetDraft);
    if (!text) {
      setStatus(`${platform === "linkedin" ? "LinkedIn" : "Tweet"} draft is empty.`);
      setStatusError(true);
      return;
    }

    window.open(shareUrl(platform, text), "_blank", "noopener,noreferrer");
    setStatus(platform === "linkedin" ? "Opened LinkedIn composer." : "Opened native Tweet composer.");
    setStatusError(false);
  }

  return (
    <section className="glass p-6 md:p-8 rounded-2xl border border-white/10 bg-white/5">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
        <div>
          <h2 className="text-lg font-[Outfit] font-semibold text-white">Social Media Drafts</h2>
          <p className="text-xs text-gray-400">Edit and share native drafts for LinkedIn and X/Twitter.</p>
          <p className="text-[11px] text-gray-500 mt-1">
            Voice: {props.userName} · {props.userHeadline}
          </p>
        </div>
        <button
          type="button"
          onClick={() => void refreshIdeas()}
          disabled={refreshing}
          className="btn btn-secondary text-sm whitespace-nowrap disabled:opacity-60"
        >
          <i className={`fa-solid ${refreshing ? "fa-spinner fa-spin" : "fa-rotate-right"} mr-2`} />
          {refreshing ? "Refreshing" : "Refresh Ideas"}
        </button>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <article className="rounded-xl border border-[#0a66c2]/35 bg-[#0a66c2]/10 p-4">
          <div className="flex items-center justify-between mb-3">
            <span className="text-[11px] uppercase tracking-wider text-[#53a9ff] font-semibold">LinkedIn</span>
            <span className="text-[10px] text-gray-300">Native share</span>
          </div>
          <textarea
            value={linkedinDraft}
            onChange={(event) => setLinkedinDraft(event.target.value)}
            readOnly={!editingLinkedin}
            className="w-full min-h-[180px] rounded-lg border border-white/10 bg-[#0f172a]/70 p-3 text-[13px] text-gray-100 leading-relaxed resize-y focus:outline-none focus:ring-2 focus:ring-[#0a66c2]/50"
          />
          <div className="flex items-center gap-2 mt-3">
            <button
              type="button"
              onClick={() => {
                if (editingLinkedin) {
                  setLinkedinDraft((value) => normalizeDraft(value));
                  setStatus("LinkedIn draft updated.");
                  setStatusError(false);
                }
                setEditingLinkedin((value) => !value);
              }}
              className="btn btn-secondary text-xs"
            >
              <i className={`fa-solid ${editingLinkedin ? "fa-check" : "fa-pen"} mr-2`} />
              {editingLinkedin ? "Save" : "Edit"}
            </button>
            <button
              type="button"
              onClick={() => openNativeShare("linkedin")}
              className="btn bg-[#0a66c2] text-white hover:bg-[#095592] text-xs"
            >
              <i className="fa-brands fa-linkedin-in mr-2" />
              Share
            </button>
          </div>
        </article>

        <article className="rounded-xl border border-white/15 bg-black/30 p-4">
          <div className="flex items-center justify-between mb-3">
            <span className="text-[11px] uppercase tracking-wider text-white font-semibold">Tweet</span>
            <span className="text-[10px] text-gray-300">Native composer</span>
          </div>
          <textarea
            value={tweetDraft}
            onChange={(event) => setTweetDraft(event.target.value)}
            readOnly={!editingTweet}
            className="w-full min-h-[180px] rounded-lg border border-white/10 bg-[#0f172a]/70 p-3 text-[13px] text-gray-100 leading-relaxed resize-y focus:outline-none focus:ring-2 focus:ring-white/30"
          />
          <div className="flex items-center gap-2 mt-3">
            <button
              type="button"
              onClick={() => {
                if (editingTweet) {
                  setTweetDraft((value) => normalizeDraft(value));
                  setStatus("Tweet draft updated.");
                  setStatusError(false);
                }
                setEditingTweet((value) => !value);
              }}
              className="btn btn-secondary text-xs"
            >
              <i className={`fa-solid ${editingTweet ? "fa-check" : "fa-pen"} mr-2`} />
              {editingTweet ? "Save" : "Edit"}
            </button>
            <button
              type="button"
              onClick={() => openNativeShare("x")}
              className="btn bg-white text-[#111827] hover:bg-gray-200 text-xs"
            >
              <i className="fa-brands fa-x-twitter mr-2" />
              Tweet
            </button>
          </div>
        </article>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2 text-[11px] text-gray-500">
        <span>Context: {contextLabel}</span>
        <span>•</span>
        <span>{sourceLabel}</span>
      </div>
      <div className={`mt-2 text-xs ${statusError ? "text-red-300" : "text-emerald-300"} min-h-5`}>{status}</div>
    </section>
  );
}

