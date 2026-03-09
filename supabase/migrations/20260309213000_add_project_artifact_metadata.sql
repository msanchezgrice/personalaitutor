alter table if exists public.project_artifacts
  add column if not exists metadata jsonb not null default '{}'::jsonb;

create index if not exists project_artifacts_project_step_key_idx
  on public.project_artifacts (project_id, ((metadata ->> 'stepKey')), created_at desc);
