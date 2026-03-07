alter table if exists public.learner_profiles
  add column if not exists contact_email text;

create table if not exists public.learner_email_deliveries (
  id uuid primary key default gen_random_uuid(),
  learner_profile_id uuid not null references public.learner_profiles(id) on delete cascade,
  campaign_key text not null check (
    campaign_key in ('welcome','day_1_next_steps','day_2_follow_up','day_3_follow_up','week_1_digest')
  ),
  status text not null check (status in ('sent','failed')),
  recipient_email text not null,
  subject text not null,
  payload jsonb not null default '{}'::jsonb,
  sent_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(learner_profile_id, campaign_key)
);

create index if not exists learner_email_deliveries_profile_sent_idx
  on public.learner_email_deliveries (learner_profile_id, sent_at desc);

alter table public.learner_email_deliveries enable row level security;

drop policy if exists learner_email_deliveries_owner_select on public.learner_email_deliveries;
create policy learner_email_deliveries_owner_select on public.learner_email_deliveries
  for select using (
    exists (
      select 1
      from public.learner_profiles lp
      where lp.id = learner_profile_id
        and lp.auth_user_id = auth.uid()::text
    )
  );
