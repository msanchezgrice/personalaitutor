-- Rebuild Phase 3: landscape monitoring + retention loops.
-- (1) daily_briefings  — one guardrail-validated briefing per career path per day
--                        (ported MDD engine, packages/daily-content).
-- (2) daily_actions    — the daily re-scoring output per learner per day
--                        ("Today, 15 min: ..."); completing one = a check-in.
-- (3) learner_streaks  — check-in streaks (current + longest), server-side.
-- (4) campaign-key constraints widened for the recurring weekly proof-of-watch
--     campaign (weekly_report_<year>_w<week>) and 7/14/30-day winbacks, plus a
--     partial unique index that makes those sends idempotent at the DB level.
-- Additive only. Do not apply automatically — run via `supabase db push`.

-- ── (1) daily_briefings ──────────────────────────────────────────────────────

create table if not exists public.daily_briefings (
  id uuid primary key default gen_random_uuid(),
  career_path_id text not null,
  briefing_date date not null,
  briefing jsonb not null,
  model text,
  created_at timestamptz not null default now(),
  unique (career_path_id, briefing_date)
);

create index if not exists daily_briefings_path_date_idx
  on public.daily_briefings (career_path_id, briefing_date desc);

-- Global (non-user) content; only the service role reads/writes it.
alter table public.daily_briefings enable row level security;

-- ── (2) daily_actions ────────────────────────────────────────────────────────

create table if not exists public.daily_actions (
  id uuid primary key default gen_random_uuid(),
  learner_profile_id uuid not null references public.learner_profiles(id) on delete cascade,
  action_date date not null,
  career_path_id text not null,
  title text not null,
  minutes integer not null check (minutes between 10 and 20),
  gap_ref text not null,
  artifact_ref text,
  score_delta integer not null default 0 check (score_delta between -3 and 3),
  score_delta_reason text,
  gap_adjustments jsonb not null default '[]'::jsonb,
  status text not null default 'pending' check (status in ('pending', 'completed')),
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  unique (learner_profile_id, action_date)
);

create index if not exists daily_actions_profile_date_idx
  on public.daily_actions (learner_profile_id, action_date desc);

create index if not exists daily_actions_completed_idx
  on public.daily_actions (learner_profile_id, status, completed_at desc);

alter table public.daily_actions enable row level security;

drop policy if exists daily_actions_owner_select on public.daily_actions;
create policy daily_actions_owner_select on public.daily_actions
  for select using (
    exists (
      select 1
      from public.learner_profiles lp
      where lp.id = learner_profile_id
        and lp.auth_user_id = auth.uid()::text
    )
  );

-- ── (3) learner_streaks ──────────────────────────────────────────────────────

create table if not exists public.learner_streaks (
  learner_profile_id uuid primary key references public.learner_profiles(id) on delete cascade,
  current_streak integer not null default 0 check (current_streak >= 0),
  longest_streak integer not null default 0 check (longest_streak >= 0),
  last_action_date date,
  updated_at timestamptz not null default now()
);

alter table public.learner_streaks enable row level security;

drop policy if exists learner_streaks_owner_select on public.learner_streaks;
create policy learner_streaks_owner_select on public.learner_streaks
  for select using (
    exists (
      select 1
      from public.learner_profiles lp
      where lp.id = learner_profile_id
        and lp.auth_user_id = auth.uid()::text
    )
  );

-- ── (4) recurring campaign keys (weekly proof-of-watch + winbacks) ──────────

alter table if exists public.learner_email_deliveries
  drop constraint if exists learner_email_deliveries_campaign_key_check;

alter table if exists public.learner_email_deliveries
  add constraint learner_email_deliveries_campaign_key_check check (
    campaign_key in (
      'welcome',
      'day_1_next_steps',
      'day_2_follow_up',
      'day_3_follow_up',
      'week_1_digest',
      'billing_checkout_reminder_1h',
      'billing_checkout_reminder_24h',
      'winback_7',
      'winback_14',
      'winback_30'
    )
    or campaign_key ~ '^weekly_report_[0-9]{4}_w[0-9]{2}$'
  );

alter table if exists public.learner_email_events
  drop constraint if exists learner_email_events_campaign_key_check;

alter table if exists public.learner_email_events
  add constraint learner_email_events_campaign_key_check check (
    campaign_key in (
      'welcome',
      'day_1_next_steps',
      'day_2_follow_up',
      'day_3_follow_up',
      'week_1_digest',
      'billing_checkout_reminder_1h',
      'billing_checkout_reminder_24h',
      'winback_7',
      'winback_14',
      'winback_30'
    )
    or campaign_key ~ '^weekly_report_[0-9]{4}_w[0-9]{2}$'
  );

-- Idempotency at the DB level for the recurring campaigns: one delivery row
-- per learner per weekly/winback campaign key (the code checks first; this
-- index makes concurrent sweeps safe).
create unique index if not exists learner_email_deliveries_recurring_uidx
  on public.learner_email_deliveries (learner_profile_id, campaign_key)
  where campaign_key ~ '^weekly_report_[0-9]{4}_w[0-9]{2}$'
     or campaign_key in ('winback_7', 'winback_14', 'winback_30');
