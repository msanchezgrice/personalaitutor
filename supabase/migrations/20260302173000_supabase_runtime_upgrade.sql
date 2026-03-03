drop policy if exists learner_profiles_owner_select on public.learner_profiles;
drop policy if exists learner_profiles_owner_update on public.learner_profiles;
drop policy if exists projects_owner_select on public.projects;
drop policy if exists projects_owner_modify on public.projects;

alter table if exists public.learner_profiles
  alter column auth_user_id type text using auth_user_id::text;

alter table if exists public.learner_profiles
  add column if not exists external_user_id text;

alter table if exists public.learner_profiles
  add column if not exists tools text[] not null default '{}';

alter table if exists public.learner_profiles
  add column if not exists social_links jsonb not null default '{}'::jsonb;

alter table if exists public.learner_profiles
  add column if not exists goals text[] not null default '{}';

create unique index if not exists learner_profiles_external_user_id_uidx
  on public.learner_profiles (external_user_id)
  where external_user_id is not null;

create table if not exists public.onboarding_sessions (
  id uuid primary key default gen_random_uuid(),
  learner_profile_id uuid not null references public.learner_profiles(id) on delete cascade,
  situation text,
  career_path_id text references public.career_paths(id),
  linkedin_url text,
  resume_filename text,
  ai_knowledge_score numeric(5,4),
  goals text[] not null default '{}',
  status text not null check (status in ('started','collecting','assessment_pending','ready_for_dashboard')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.assessment_attempts (
  id uuid primary key default gen_random_uuid(),
  learner_profile_id uuid not null references public.learner_profiles(id) on delete cascade,
  score numeric(5,4) not null default 0,
  answers jsonb not null default '[]'::jsonb,
  recommended_career_path_ids text[] not null default '{}',
  started_at timestamptz not null default now(),
  submitted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.build_log_entries (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  learner_profile_id uuid not null references public.learner_profiles(id) on delete cascade,
  message text not null,
  level text not null check (level in ('info','success','warn','error')),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.oauth_connections (
  id uuid primary key default gen_random_uuid(),
  learner_profile_id uuid not null references public.learner_profiles(id) on delete cascade,
  platform text not null,
  connected boolean not null default false,
  account_label text,
  connected_at timestamptz,
  last_error_code text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (learner_profile_id, platform)
);

create table if not exists public.social_drafts (
  id uuid primary key default gen_random_uuid(),
  learner_profile_id uuid not null references public.learner_profiles(id) on delete cascade,
  project_id uuid references public.projects(id) on delete set null,
  platform text not null check (platform in ('linkedin','x')),
  text text not null,
  og_url text not null,
  share_url text not null,
  status text not null check (status in ('draft','published','failed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.employer_leads (
  id uuid primary key default gen_random_uuid(),
  employer_name text not null,
  employer_email text not null,
  handle text not null,
  note text not null,
  created_at timestamptz not null default now()
);

alter table public.onboarding_sessions enable row level security;
alter table public.assessment_attempts enable row level security;
alter table public.build_log_entries enable row level security;
alter table public.oauth_connections enable row level security;
alter table public.social_drafts enable row level security;
alter table public.employer_leads enable row level security;

create policy learner_profiles_owner_select on public.learner_profiles
  for select using (auth.uid()::text = auth_user_id);

create policy learner_profiles_owner_update on public.learner_profiles
  for update using (auth.uid()::text = auth_user_id);

create policy projects_owner_select on public.projects
  for select using (
    exists (
      select 1
      from public.learner_profiles lp
      where lp.id = learner_profile_id
        and lp.auth_user_id = auth.uid()::text
    )
  );

create policy projects_owner_modify on public.projects
  for all using (
    exists (
      select 1
      from public.learner_profiles lp
      where lp.id = learner_profile_id
        and lp.auth_user_id = auth.uid()::text
    )
  );

drop policy if exists onboarding_sessions_owner_all on public.onboarding_sessions;
create policy onboarding_sessions_owner_all on public.onboarding_sessions
  for all using (
    exists (
      select 1 from public.learner_profiles lp
      where lp.id = learner_profile_id and lp.auth_user_id = auth.uid()::text
    )
  );

drop policy if exists assessment_attempts_owner_all on public.assessment_attempts;
create policy assessment_attempts_owner_all on public.assessment_attempts
  for all using (
    exists (
      select 1 from public.learner_profiles lp
      where lp.id = learner_profile_id and lp.auth_user_id = auth.uid()::text
    )
  );

drop policy if exists build_logs_owner_select on public.build_log_entries;
create policy build_logs_owner_select on public.build_log_entries
  for select using (
    exists (
      select 1 from public.projects p
      join public.learner_profiles lp on lp.id = p.learner_profile_id
      where p.id = project_id and lp.auth_user_id = auth.uid()::text
    )
  );

drop policy if exists oauth_connections_owner_all on public.oauth_connections;
create policy oauth_connections_owner_all on public.oauth_connections
  for all using (
    exists (
      select 1 from public.learner_profiles lp
      where lp.id = learner_profile_id and lp.auth_user_id = auth.uid()::text
    )
  );

drop policy if exists social_drafts_owner_all on public.social_drafts;
create policy social_drafts_owner_all on public.social_drafts
  for all using (
    exists (
      select 1 from public.learner_profiles lp
      where lp.id = learner_profile_id and lp.auth_user_id = auth.uid()::text
    )
  );

insert into public.learner_profiles (
  id,
  auth_user_id,
  external_user_id,
  handle,
  full_name,
  headline,
  bio,
  career_path_id,
  published,
  tokens_used,
  tools,
  social_links,
  goals
)
values (
  '00000000-0000-0000-0000-000000000001',
  '00000000-0000-0000-0000-000000000001',
  'user_test_0001',
  'test-user-0001',
  'TEST_USER_0001',
  'Synthetic profile for end-to-end verification',
  'Synthetic user for onboarding, dashboard, profile publish, and employer search verification.',
  'product-management',
  true,
  18430,
  '{"OpenAI API","Supabase","Vercel"}',
  '{"linkedin":"https://www.linkedin.com/in/test-user-0001","x":"https://x.com/test_user_0001","website":"http://localhost:6396/u/test-user-0001"}'::jsonb,
  '{"upskill_current_job","ship_ai_projects"}'
)
on conflict (id) do nothing;

insert into public.projects (
  id,
  learner_profile_id,
  slug,
  title,
  description,
  state
)
values (
  '11111111-1111-1111-1111-111111111111',
  '00000000-0000-0000-0000-000000000001',
  'project-alpha-001',
  'PROJECT_ALPHA_001',
  'Synthetic customer support copilot prototype with artifact outputs.',
  'building'
)
on conflict do nothing;

insert into public.project_artifacts (id, project_id, kind, url)
values (
  '22222222-2222-2222-2222-222222222222',
  '11111111-1111-1111-1111-111111111111',
  'website',
  '/u/test-user-0001/projects/project-alpha-001'
)
on conflict do nothing;

insert into public.user_skill_evidence (
  id,
  learner_profile_id,
  skill_name,
  status,
  score,
  evidence_count
)
values
  ('33333333-3333-3333-3333-333333333333', '00000000-0000-0000-0000-000000000001', 'Prompt Engineering', 'built', 0.56, 2),
  ('44444444-4444-4444-4444-444444444444', '00000000-0000-0000-0000-000000000001', 'Workflow Design', 'in_progress', 0.32, 1)
on conflict (learner_profile_id, skill_name) do nothing;
