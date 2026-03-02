"use client";

import { useEffect, useState } from "react";

type Profile = {
  id: string;
  handle: string;
  name: string;
  headline: string;
  bio: string;
  careerPathId: string;
  tools: string[];
  published: boolean;
  socialLinks: { linkedin?: string; x?: string; website?: string; github?: string };
};

export function ProfileEditor() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      const res = await fetch("/api/dashboard/summary");
      const data = (await res.json()) as { ok: boolean; summary?: { user: Profile } };
      if (res.ok && data.ok && data.summary) {
        setProfile(data.summary.user);
      }
    };
    void load();
  }, []);

  const patchProfile = async () => {
    if (!profile) return;
    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const res = await fetch("/api/profile", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          handle: profile.handle,
          name: profile.name,
          headline: profile.headline,
          bio: profile.bio,
          tools: profile.tools,
          socialLinks: profile.socialLinks,
        }),
      });
      const data = (await res.json()) as { ok: boolean; profile?: Profile; error?: { message: string } };
      if (!res.ok || !data.ok || !data.profile) {
        throw new Error(data.error?.message ?? "Unable to update profile");
      }
      setProfile(data.profile);
      setSuccess("Profile updated.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to update profile");
    } finally {
      setLoading(false);
    }
  };

  const publish = async () => {
    setLoading(true);
    setError(null);
    setSuccess(null);
    try {
      const res = await fetch("/api/profile/publish", { method: "POST" });
      const data = (await res.json()) as {
        ok: boolean;
        profile?: Profile;
        publicUrl?: string;
        error?: { message: string };
      };
      if (!res.ok || !data.ok || !data.profile) {
        throw new Error(data.error?.message ?? "Unable to publish profile");
      }
      setProfile(data.profile);
      setSuccess(`Profile published at ${data.publicUrl}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to publish profile");
    } finally {
      setLoading(false);
    }
  };

  if (!profile) return <div className="panel" style={{ marginTop: 14 }}>Loading profile...</div>;

  return (
    <section className="panel" style={{ marginTop: 14 }}>
      <div className="grid-2">
        <article className="card">
          <label htmlFor="profile-handle">Handle</label>
          <input
            id="profile-handle"
            className="input"
            value={profile.handle}
            onChange={(e) => setProfile((prev) => (prev ? { ...prev, handle: e.target.value } : prev))}
          />

          <label htmlFor="profile-name" style={{ marginTop: 10, display: "block" }}>Name</label>
          <input
            id="profile-name"
            className="input"
            value={profile.name}
            onChange={(e) => setProfile((prev) => (prev ? { ...prev, name: e.target.value } : prev))}
          />

          <label htmlFor="profile-headline" style={{ marginTop: 10, display: "block" }}>Headline</label>
          <input
            id="profile-headline"
            className="input"
            value={profile.headline}
            onChange={(e) => setProfile((prev) => (prev ? { ...prev, headline: e.target.value } : prev))}
          />

          <label htmlFor="profile-bio" style={{ marginTop: 10, display: "block" }}>Bio</label>
          <textarea
            id="profile-bio"
            className="input"
            rows={4}
            value={profile.bio}
            onChange={(e) => setProfile((prev) => (prev ? { ...prev, bio: e.target.value } : prev))}
          />

          <button type="button" className="btn" style={{ marginTop: 10 }} disabled={loading} onClick={patchProfile}>Save Profile</button>
          <button type="button" className="btn primary" style={{ marginTop: 10, marginLeft: 8 }} disabled={loading} onClick={publish}>Publish Profile</button>
        </article>

        <article className="card">
          <h3>Public surfaces</h3>
          <p><strong>Published:</strong> {profile.published ? "Yes" : "No"}</p>
          <p><strong>Profile URL:</strong> <a href={`/u/${profile.handle}`}>/u/{profile.handle}</a></p>
          <p><strong>OG URL:</strong> <code>/api/og/profile/{profile.handle}</code></p>
          <label htmlFor="linkedin" style={{ marginTop: 10, display: "block" }}>LinkedIn</label>
          <input
            id="linkedin"
            className="input"
            value={profile.socialLinks.linkedin ?? ""}
            onChange={(e) =>
              setProfile((prev) =>
                prev
                  ? { ...prev, socialLinks: { ...prev.socialLinks, linkedin: e.target.value } }
                  : prev,
              )
            }
          />
          <label htmlFor="x" style={{ marginTop: 10, display: "block" }}>X</label>
          <input
            id="x"
            className="input"
            value={profile.socialLinks.x ?? ""}
            onChange={(e) =>
              setProfile((prev) =>
                prev
                  ? { ...prev, socialLinks: { ...prev.socialLinks, x: e.target.value } }
                  : prev,
              )
            }
          />
        </article>
      </div>

      {error ? <div className="fail-box" style={{ marginTop: 10 }}>{error}</div> : null}
      {success ? <div className="success-box" style={{ marginTop: 10 }}>{success}</div> : null}
    </section>
  );
}
