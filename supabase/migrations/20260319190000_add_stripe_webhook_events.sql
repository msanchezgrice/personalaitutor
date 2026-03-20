create table if not exists public.stripe_webhook_events (
  stripe_event_id text primary key,
  event_type text not null,
  learner_profile_id uuid references public.learner_profiles(id) on delete set null,
  state text not null default 'processing' check (state in ('processing','processed')),
  processed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists stripe_webhook_events_profile_idx
  on public.stripe_webhook_events (learner_profile_id, created_at desc);

create index if not exists stripe_webhook_events_state_idx
  on public.stripe_webhook_events (state, created_at desc);

alter table public.stripe_webhook_events enable row level security;
