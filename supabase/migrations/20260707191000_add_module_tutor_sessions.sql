-- Tutor-driven lessons (Phase 2.2 rebuild): checkpointed tutor session per
-- module. The tutor walks the learner through the playbook step-by-step;
-- per-step and proof-checklist completion is tracked server-side and is
-- resumable. Completing the checklist is the input to the verified-state
-- gate (Phase 2.3).

create table if not exists public.module_tutor_sessions (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  learner_profile_id uuid not null references public.learner_profiles(id) on delete cascade,
  career_path_id text not null,
  module_title text not null,
  status text not null default 'active' check (status in ('active', 'completed')),
  current_step_index integer not null default 0,
  steps jsonb not null default '[]'::jsonb,
  checklist jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz
);

-- One active session per project per learner (resumable, idempotent start).
create unique index if not exists module_tutor_sessions_active_unique
  on public.module_tutor_sessions (project_id, learner_profile_id)
  where status = 'active';

create index if not exists module_tutor_sessions_profile_idx
  on public.module_tutor_sessions (learner_profile_id, created_at desc);

alter table public.module_tutor_sessions enable row level security;

drop policy if exists module_tutor_sessions_owner_all on public.module_tutor_sessions;
create policy module_tutor_sessions_owner_all on public.module_tutor_sessions
  for all using (
    exists (
      select 1
      from public.learner_profiles lp
      where lp.id = learner_profile_id
        and lp.auth_user_id = auth.uid()::text
    )
  );
