-- Anonymous assessment flow (Phase 1 rebuild): visitors take the assessment
-- without a Clerk account. Sessions are keyed by an unguessable token and
-- linked to a learner profile after sign-up (matched on captured email).

create table if not exists public.anonymous_assessments (
  id uuid primary key default gen_random_uuid(),
  session_token text not null unique,
  status text not null default 'started' check (status in ('started', 'submitted', 'completed')),
  career_path_id text,
  career_category_label text,
  job_title text,
  years_experience text,
  company_size text,
  situation text,
  goals jsonb not null default '[]'::jsonb,
  ai_comfort integer,
  linkedin_url text,
  resume_text text,
  answers jsonb not null default '[]'::jsonb,
  email text,
  email_captured_at timestamptz,
  report_email_sent_at timestamptz,
  learner_profile_id uuid references public.learner_profiles(id) on delete set null,
  linked_at timestamptz,
  visitor_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  submitted_at timestamptz
);

create index if not exists anonymous_assessments_email_idx
  on public.anonymous_assessments (email)
  where email is not null;

create index if not exists anonymous_assessments_profile_idx
  on public.anonymous_assessments (learner_profile_id)
  where learner_profile_id is not null;

create index if not exists anonymous_assessments_created_idx
  on public.anonymous_assessments (created_at desc);

alter table public.anonymous_assessments enable row level security;

drop policy if exists anonymous_assessments_owner_select on public.anonymous_assessments;
create policy anonymous_assessments_owner_select on public.anonymous_assessments
  for select using (
    learner_profile_id is not null and exists (
      select 1
      from public.learner_profiles lp
      where lp.id = learner_profile_id
        and lp.auth_user_id = auth.uid()::text
    )
  );

-- Score history: every readiness-score computation appends a row.
-- The score trend is the product's spine (free tier = see it, paid = move it).
create table if not exists public.assessment_report_history (
  id uuid primary key default gen_random_uuid(),
  anonymous_assessment_id uuid references public.anonymous_assessments(id) on delete cascade,
  learner_profile_id uuid references public.learner_profiles(id) on delete set null,
  readiness_score integer not null check (readiness_score between 0 and 100),
  deterministic_score numeric,
  model text,
  report jsonb not null,
  created_at timestamptz not null default now()
);

create index if not exists assessment_report_history_assessment_idx
  on public.assessment_report_history (anonymous_assessment_id, created_at);

create index if not exists assessment_report_history_profile_idx
  on public.assessment_report_history (learner_profile_id, created_at desc)
  where learner_profile_id is not null;

alter table public.assessment_report_history enable row level security;

drop policy if exists assessment_report_history_owner_select on public.assessment_report_history;
create policy assessment_report_history_owner_select on public.assessment_report_history
  for select using (
    learner_profile_id is not null and exists (
      select 1
      from public.learner_profiles lp
      where lp.id = learner_profile_id
        and lp.auth_user_id = auth.uid()::text
    )
  );
