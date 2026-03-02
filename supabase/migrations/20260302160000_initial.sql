create extension if not exists pgcrypto;

create table if not exists public.career_paths (
  id text primary key,
  name text not null,
  core_skill_domain text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.skill_domains (
  id uuid primary key default gen_random_uuid(),
  career_path_id text not null references public.career_paths(id) on delete cascade,
  name text not null,
  unique(career_path_id, name)
);

create table if not exists public.module_catalog (
  id uuid primary key default gen_random_uuid(),
  career_path_id text not null references public.career_paths(id) on delete cascade,
  title text not null,
  summary text not null,
  order_index int not null default 0,
  unique(career_path_id, title)
);

create table if not exists public.tool_catalog (
  id uuid primary key default gen_random_uuid(),
  career_path_id text not null references public.career_paths(id) on delete cascade,
  name text not null,
  unique(career_path_id, name)
);

create table if not exists public.learner_profiles (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid not null,
  handle text not null unique,
  full_name text not null,
  headline text not null default '',
  bio text not null default '',
  career_path_id text references public.career_paths(id),
  published boolean not null default false,
  tokens_used bigint not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.projects (
  id uuid primary key default gen_random_uuid(),
  learner_profile_id uuid not null references public.learner_profiles(id) on delete cascade,
  slug text not null,
  title text not null,
  description text not null default '',
  state text not null check (state in ('idea','planned','building','built','showcased','archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(learner_profile_id, slug)
);

create table if not exists public.project_artifacts (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  kind text not null,
  url text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.user_module_progress (
  id uuid primary key default gen_random_uuid(),
  learner_profile_id uuid not null references public.learner_profiles(id) on delete cascade,
  module_id uuid not null references public.module_catalog(id) on delete cascade,
  score numeric(5,4) not null default 0,
  state text not null check (state in ('not_started','in_progress','built','verified')),
  updated_at timestamptz not null default now(),
  unique(learner_profile_id, module_id)
);

create table if not exists public.user_skill_evidence (
  id uuid primary key default gen_random_uuid(),
  learner_profile_id uuid not null references public.learner_profiles(id) on delete cascade,
  skill_name text not null,
  status text not null check (status in ('not_started','in_progress','built','verified')),
  score numeric(5,4) not null default 0,
  evidence_count int not null default 0,
  updated_at timestamptz not null default now(),
  unique(learner_profile_id, skill_name)
);

create table if not exists public.verification_policies (
  id uuid primary key default gen_random_uuid(),
  module_min_score numeric(5,4) not null,
  project_min_score numeric(5,4) not null,
  built_min_artifacts int not null,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.verification_events (
  id uuid primary key default gen_random_uuid(),
  learner_profile_id uuid not null references public.learner_profiles(id) on delete cascade,
  project_id uuid references public.projects(id) on delete set null,
  event_type text not null,
  skill_name text not null,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.agent_jobs (
  id uuid primary key default gen_random_uuid(),
  learner_profile_id uuid references public.learner_profiles(id) on delete set null,
  project_id uuid references public.projects(id) on delete set null,
  type text not null,
  payload jsonb not null default '{}'::jsonb,
  status text not null check (status in ('queued','claimed','running','waiting_on_user','completed','failed','cancelled')),
  attempts int not null default 0,
  max_attempts int not null default 3,
  lease_until timestamptz,
  last_error_code text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists agent_jobs_claim_idx on public.agent_jobs (status, created_at);

create table if not exists public.agent_job_events (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.agent_jobs(id) on delete cascade,
  learner_profile_id uuid references public.learner_profiles(id) on delete set null,
  project_id uuid references public.projects(id) on delete set null,
  event_type text not null,
  message text not null,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.agent_memory (
  id uuid primary key default gen_random_uuid(),
  learner_profile_id uuid not null references public.learner_profiles(id) on delete cascade,
  memory_key text not null,
  memory_value jsonb not null,
  refreshed_at timestamptz not null default now(),
  unique(learner_profile_id, memory_key)
);

create table if not exists public.news_insights (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  url text not null,
  summary text not null,
  career_path_ids text[] not null default '{}',
  published_at timestamptz not null,
  created_at timestamptz not null default now()
);

create table if not exists public.daily_update_emails (
  id uuid primary key default gen_random_uuid(),
  learner_profile_id uuid not null references public.learner_profiles(id) on delete cascade,
  status text not null check (status in ('sent','failed')),
  summary text not null,
  upcoming_tasks text[] not null default '{}',
  news_ids uuid[] not null default '{}',
  failure_code text,
  created_at timestamptz not null default now()
);

create or replace function public.claim_agent_jobs(p_worker_id text, p_limit int default 5)
returns setof public.agent_jobs
language plpgsql
security definer
as $$
declare
  _claimed_ids uuid[];
begin
  with candidates as (
    select id
    from public.agent_jobs
    where status = 'queued'
      and (lease_until is null or lease_until < now())
    order by created_at
    limit greatest(1, p_limit)
    for update skip locked
  ), claimed as (
    update public.agent_jobs j
    set status = 'claimed',
        attempts = j.attempts + 1,
        lease_until = now() + interval '60 seconds',
        payload = j.payload || jsonb_build_object('claimedBy', p_worker_id),
        updated_at = now()
    from candidates c
    where j.id = c.id
    returning j.id
  )
  select array_agg(id) into _claimed_ids
  from claimed;

  return query
  select *
  from public.agent_jobs
  where id = any(coalesce(_claimed_ids, '{}'::uuid[]));
end;
$$;

alter table public.learner_profiles enable row level security;
alter table public.projects enable row level security;
alter table public.project_artifacts enable row level security;
alter table public.user_module_progress enable row level security;
alter table public.user_skill_evidence enable row level security;
alter table public.verification_events enable row level security;
alter table public.agent_jobs enable row level security;
alter table public.agent_job_events enable row level security;
alter table public.agent_memory enable row level security;
alter table public.daily_update_emails enable row level security;

create policy if not exists learner_profiles_owner_select on public.learner_profiles
  for select using (auth.uid() = auth_user_id);

create policy if not exists learner_profiles_owner_update on public.learner_profiles
  for update using (auth.uid() = auth_user_id);

create policy if not exists projects_owner_select on public.projects
  for select using (
    exists (
      select 1
      from public.learner_profiles lp
      where lp.id = learner_profile_id
        and lp.auth_user_id = auth.uid()
    )
  );

create policy if not exists projects_owner_modify on public.projects
  for all using (
    exists (
      select 1
      from public.learner_profiles lp
      where lp.id = learner_profile_id
        and lp.auth_user_id = auth.uid()
    )
  );

insert into public.verification_policies (module_min_score, project_min_score, built_min_artifacts, active)
select 0.40, 0.40, 1, true
where not exists (select 1 from public.verification_policies where active = true);
