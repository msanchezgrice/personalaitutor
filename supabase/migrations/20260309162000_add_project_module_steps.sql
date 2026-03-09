create table if not exists public.project_module_steps (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  learner_profile_id uuid not null references public.learner_profiles(id) on delete cascade,
  step_key text not null,
  title text not null,
  order_index int not null default 0,
  status text not null check (status in ('not_started','in_progress','completed')),
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(project_id, step_key)
);

create index if not exists project_module_steps_project_order_idx
  on public.project_module_steps (project_id, order_index asc);

alter table public.project_module_steps enable row level security;

drop policy if exists project_module_steps_owner_all on public.project_module_steps;
create policy project_module_steps_owner_all on public.project_module_steps
  for all using (
    exists (
      select 1
      from public.projects p
      join public.learner_profiles lp on lp.id = p.learner_profile_id
      where p.id = project_id
        and lp.auth_user_id = auth.uid()::text
    )
  );
