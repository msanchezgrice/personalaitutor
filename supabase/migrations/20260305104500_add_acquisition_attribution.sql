alter table if exists public.learner_profiles
  add column if not exists acquisition jsonb not null default '{}'::jsonb;

alter table if exists public.onboarding_sessions
  add column if not exists acquisition jsonb not null default '{}'::jsonb;

create index if not exists onboarding_sessions_acquisition_gin_idx
  on public.onboarding_sessions using gin (acquisition);
