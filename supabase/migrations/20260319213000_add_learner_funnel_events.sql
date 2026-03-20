create table if not exists public.learner_funnel_events (
  id uuid primary key default gen_random_uuid(),
  event_id text,
  event_key text not null,
  occurred_at timestamptz not null default now(),
  visitor_id text,
  auth_user_id text,
  learner_profile_id uuid references public.learner_profiles(id) on delete set null,
  onboarding_session_id uuid references public.onboarding_sessions(id) on delete set null,
  project_id uuid references public.projects(id) on delete set null,
  funnel text,
  step text,
  path text,
  page_url text,
  utm_source text,
  utm_medium text,
  utm_campaign text,
  utm_content text,
  utm_term text,
  first_utm_source text,
  first_utm_medium text,
  first_utm_campaign text,
  first_utm_content text,
  first_utm_term text,
  landing_path text,
  first_landing_path text,
  referrer text,
  first_referrer text,
  paid_source text,
  properties jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists learner_funnel_events_occurred_idx
  on public.learner_funnel_events (occurred_at desc);

create index if not exists learner_funnel_events_event_idx
  on public.learner_funnel_events (event_key, occurred_at desc);

create index if not exists learner_funnel_events_visitor_idx
  on public.learner_funnel_events (visitor_id, occurred_at desc);

create index if not exists learner_funnel_events_profile_idx
  on public.learner_funnel_events (learner_profile_id, occurred_at desc);

create index if not exists learner_funnel_events_source_idx
  on public.learner_funnel_events (utm_source, utm_campaign, occurred_at desc);

alter table public.learner_funnel_events enable row level security;

drop policy if exists learner_funnel_events_owner_select on public.learner_funnel_events;
create policy learner_funnel_events_owner_select on public.learner_funnel_events
  for select using (
    learner_profile_id is not null and exists (
      select 1
      from public.learner_profiles lp
      where lp.id = learner_profile_id
        and lp.auth_user_id = auth.uid()::text
    )
  );
