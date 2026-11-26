-- Career Map + Proof Studio (2026-11-25).
-- Additive only: six new tables, no changes to existing ones.
--
-- Access model: every table has RLS enabled with NO policies and all grants
-- revoked from anon/authenticated. The web app reads and writes exclusively
-- through the service-role client (apps/web/lib/supabase-admin.ts); public
-- pages are rendered server-side from published rows.

-- ---------------------------------------------------------------------------
-- Career maps: anonymous résumé -> new title. Keyed by an unguessable token,
-- linked to a learner profile after sign-up (cookie token or matched email).
-- ---------------------------------------------------------------------------
create table if not exists public.career_maps (
  id uuid primary key default gen_random_uuid(),
  token text not null unique,
  status text not null default 'generating' check (status in ('generating', 'completed', 'failed')),
  source text not null default 'paste' check (source in ('paste', 'upload', 'describe')),
  input_text text not null,
  map jsonb,
  model text,
  failure_reason text,
  previous_title text,
  primary_title_id text,
  email text,
  email_captured_at timestamptz,
  map_email_sent_at timestamptz,
  learner_profile_id uuid references public.learner_profiles(id) on delete set null,
  linked_at timestamptz,
  visitor_id text,
  ip_hash text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists career_maps_email_idx on public.career_maps (email) where email is not null;
create index if not exists career_maps_profile_idx on public.career_maps (learner_profile_id, created_at desc) where learner_profile_id is not null;
create index if not exists career_maps_ip_hash_idx on public.career_maps (ip_hash, created_at desc) where ip_hash is not null;
create index if not exists career_maps_created_idx on public.career_maps (created_at desc);

-- ---------------------------------------------------------------------------
-- Proof site: the learner's settings for their public page at /u/{handle}.
-- One row per learner. Publishing still uses learner_profiles.published.
-- ---------------------------------------------------------------------------
create table if not exists public.proof_sites (
  learner_profile_id uuid primary key references public.learner_profiles(id) on delete cascade,
  career_map_id uuid references public.career_maps(id) on delete set null,
  new_title text not null,
  previous_role text,
  tagline text not null default '',
  bio text not null default '',
  translations jsonb not null default '[]'::jsonb,
  contact_email text,
  linkedin_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Voice models: tuned in context on the learner's own writing samples.
-- ---------------------------------------------------------------------------
create table if not exists public.voice_models (
  id uuid primary key default gen_random_uuid(),
  learner_profile_id uuid not null references public.learner_profiles(id) on delete cascade,
  slug text not null,
  name text not null,
  purpose text not null default '',
  sample_type text not null default '',
  status text not null default 'draft' check (status in ('draft', 'ready')),
  published boolean not null default false,
  style_profile jsonb,
  base_model text,
  sample_count integer not null default 0,
  demo_prompt text,
  demo_base_output text,
  demo_tuned_output text,
  tuned_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (learner_profile_id, slug)
);

create index if not exists voice_models_profile_idx on public.voice_models (learner_profile_id, created_at desc);

create table if not exists public.voice_model_samples (
  id uuid primary key default gen_random_uuid(),
  voice_model_id uuid not null references public.voice_models(id) on delete cascade,
  learner_profile_id uuid not null references public.learner_profiles(id) on delete cascade,
  title text,
  content text not null,
  created_at timestamptz not null default now()
);

create index if not exists voice_model_samples_model_idx on public.voice_model_samples (voice_model_id, created_at);

-- Every comparison run (owner tests and public "try it" runs). Used for the
-- public demo rate limit and as a usage record. Outputs are not stored for
-- public runs beyond what the rate limit needs.
create table if not exists public.voice_model_runs (
  id uuid primary key default gen_random_uuid(),
  voice_model_id uuid not null references public.voice_models(id) on delete cascade,
  source text not null check (source in ('owner', 'public')),
  ip_hash text,
  prompt text not null,
  created_at timestamptz not null default now()
);

create index if not exists voice_model_runs_model_idx on public.voice_model_runs (voice_model_id, created_at desc);
create index if not exists voice_model_runs_ip_idx on public.voice_model_runs (ip_hash, created_at desc) where ip_hash is not null;

-- ---------------------------------------------------------------------------
-- Build log posts: short public posts about what the learner built.
-- (Distinct from build_log_entries, the internal per-project event log.)
-- ---------------------------------------------------------------------------
create table if not exists public.build_log_posts (
  id uuid primary key default gen_random_uuid(),
  learner_profile_id uuid not null references public.learner_profiles(id) on delete cascade,
  slug text not null,
  title text not null,
  summary text not null default '',
  body_markdown text not null default '',
  status text not null default 'draft' check (status in ('draft', 'published')),
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (learner_profile_id, slug)
);

create index if not exists build_log_posts_profile_idx on public.build_log_posts (learner_profile_id, published_at desc);

-- ---------------------------------------------------------------------------
-- Lock everything down: service role only.
-- ---------------------------------------------------------------------------
alter table public.career_maps enable row level security;
alter table public.proof_sites enable row level security;
alter table public.voice_models enable row level security;
alter table public.voice_model_samples enable row level security;
alter table public.voice_model_runs enable row level security;
alter table public.build_log_posts enable row level security;

revoke all on table public.career_maps from anon, authenticated;
revoke all on table public.proof_sites from anon, authenticated;
revoke all on table public.voice_models from anon, authenticated;
revoke all on table public.voice_model_samples from anon, authenticated;
revoke all on table public.voice_model_runs from anon, authenticated;
revoke all on table public.build_log_posts from anon, authenticated;
