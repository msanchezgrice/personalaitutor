create table if not exists public.radar_projects (
  id uuid primary key default gen_random_uuid(),
  learner_profile_id uuid not null references public.learner_profiles(id) on delete cascade,
  slug text not null,
  name text not null,
  domain text,
  repo_name text,
  product_type text,
  inventory_status text,
  notes text not null default '',
  analysis_summary text not null default '',
  detected_keywords text[] not null default '{}',
  platform_handles jsonb not null default '{}'::jsonb,
  scan_query text,
  active boolean not null default true,
  auto_scan boolean not null default true,
  last_scanned_at timestamptz,
  last_proposal_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (learner_profile_id, slug)
);

create index if not exists radar_projects_owner_active_idx
  on public.radar_projects (learner_profile_id, active, auto_scan, updated_at desc);

create table if not exists public.radar_signals (
  id uuid primary key default gen_random_uuid(),
  radar_project_id uuid not null references public.radar_projects(id) on delete cascade,
  source_type text not null check (source_type in ('domain', 'news', 'topic')),
  title text not null,
  url text,
  summary text not null default '',
  published_at timestamptz,
  relevance_score numeric(5,2) not null default 0,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists radar_signals_project_created_idx
  on public.radar_signals (radar_project_id, created_at desc);

create table if not exists public.radar_proposals (
  id uuid primary key default gen_random_uuid(),
  radar_project_id uuid not null references public.radar_projects(id) on delete cascade,
  variant_index int not null,
  headline text not null,
  rationale text not null default '',
  content jsonb not null default '{}'::jsonb,
  source_signal_ids uuid[] not null default '{}',
  status text not null check (status in ('draft', 'approved', 'posted', 'archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists radar_proposals_project_created_idx
  on public.radar_proposals (radar_project_id, created_at desc);

alter table public.radar_projects enable row level security;
alter table public.radar_signals enable row level security;
alter table public.radar_proposals enable row level security;

drop policy if exists radar_projects_owner_all on public.radar_projects;
create policy radar_projects_owner_all on public.radar_projects
  for all using (
    exists (
      select 1
      from public.learner_profiles lp
      where lp.id = learner_profile_id
        and lp.auth_user_id = auth.uid()::text
    )
  );

drop policy if exists radar_signals_owner_all on public.radar_signals;
create policy radar_signals_owner_all on public.radar_signals
  for all using (
    exists (
      select 1
      from public.radar_projects rp
      join public.learner_profiles lp on lp.id = rp.learner_profile_id
      where rp.id = radar_project_id
        and lp.auth_user_id = auth.uid()::text
    )
  );

drop policy if exists radar_proposals_owner_all on public.radar_proposals;
create policy radar_proposals_owner_all on public.radar_proposals
  for all using (
    exists (
      select 1
      from public.radar_projects rp
      join public.learner_profiles lp on lp.id = rp.learner_profile_id
      where rp.id = radar_project_id
        and lp.auth_user_id = auth.uid()::text
    )
  );
