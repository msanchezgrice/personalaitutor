alter table if exists public.learner_profiles
  add column if not exists stripe_customer_id text;

create unique index if not exists learner_profiles_stripe_customer_id_uidx
  on public.learner_profiles (stripe_customer_id)
  where stripe_customer_id is not null;

create table if not exists public.billing_subscriptions (
  learner_profile_id uuid primary key references public.learner_profiles(id) on delete cascade,
  stripe_subscription_id text not null unique,
  stripe_customer_id text,
  stripe_price_id text not null,
  status text not null check (status in ('trialing','active','past_due','canceled','unpaid','incomplete','incomplete_expired','paused')),
  trial_ends_at timestamptz,
  current_period_ends_at timestamptz,
  cancel_at_period_end boolean not null default false,
  last_webhook_event_id text,
  last_webhook_received_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists billing_subscriptions_status_idx
  on public.billing_subscriptions (status, current_period_ends_at desc);

create index if not exists billing_subscriptions_customer_idx
  on public.billing_subscriptions (stripe_customer_id);

alter table public.billing_subscriptions enable row level security;

drop policy if exists billing_subscriptions_owner_all on public.billing_subscriptions;
create policy billing_subscriptions_owner_all on public.billing_subscriptions
  for all using (
    exists (
      select 1
      from public.learner_profiles lp
      where lp.id = learner_profile_id
        and lp.auth_user_id = auth.uid()::text
    )
  );
