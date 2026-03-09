alter table if exists public.learner_email_deliveries
  add column if not exists external_user_id text,
  add column if not exists provider text,
  add column if not exists provider_message_id text,
  add column if not exists email_source text,
  add column if not exists email_medium text,
  add column if not exists email_campaign text,
  add column if not exists cohort_source text,
  add column if not exists cohort_medium text,
  add column if not exists cohort_campaign text,
  add column if not exists cohort_paid_source text;

update public.learner_email_deliveries as delivery
set
  external_user_id = coalesce(delivery.external_user_id, profile.external_user_id),
  provider = coalesce(delivery.provider, 'resend'),
  email_source = coalesce(delivery.email_source, 'lifecycle_email'),
  email_medium = coalesce(delivery.email_medium, 'email'),
  email_campaign = coalesce(delivery.email_campaign, delivery.campaign_key),
  cohort_source = coalesce(
    delivery.cohort_source,
    nullif(lower(coalesce(profile.acquisition -> 'last' ->> 'utmSource', profile.acquisition -> 'first' ->> 'utmSource', '')), ''),
    'unknown'
  ),
  cohort_medium = coalesce(
    delivery.cohort_medium,
    nullif(lower(coalesce(profile.acquisition -> 'last' ->> 'utmMedium', profile.acquisition -> 'first' ->> 'utmMedium', '')), ''),
    'unknown'
  ),
  cohort_campaign = coalesce(
    delivery.cohort_campaign,
    nullif(lower(coalesce(profile.acquisition -> 'last' ->> 'utmCampaign', profile.acquisition -> 'first' ->> 'utmCampaign', '')), ''),
    'unknown'
  ),
  cohort_paid_source = coalesce(
    delivery.cohort_paid_source,
    case
      when lower(coalesce(profile.acquisition -> 'last' ->> 'utmSource', profile.acquisition -> 'first' ->> 'utmSource', '')) like '%linkedin%' then 'linkedin'
      when lower(coalesce(profile.acquisition -> 'last' ->> 'utmSource', profile.acquisition -> 'first' ->> 'utmSource', '')) in ('x', 'twitter') then 'x'
      when lower(coalesce(profile.acquisition -> 'last' ->> 'utmSource', profile.acquisition -> 'first' ->> 'utmSource', '')) like '%facebook%' then 'facebook'
      when lower(coalesce(profile.acquisition -> 'last' ->> 'utmSource', profile.acquisition -> 'first' ->> 'utmSource', '')) like '%instagram%' then 'facebook'
      when lower(coalesce(profile.acquisition -> 'last' ->> 'utmSource', profile.acquisition -> 'first' ->> 'utmSource', '')) like '%meta%' then 'facebook'
      when coalesce(profile.acquisition -> 'last' ->> 'gclid', profile.acquisition -> 'first' ->> 'gclid', '') <> '' then 'google'
      when lower(coalesce(profile.acquisition -> 'last' ->> 'utmSource', profile.acquisition -> 'first' ->> 'utmSource', '')) like '%google%' then 'google'
      when coalesce(profile.acquisition -> 'last' ->> 'msclkid', profile.acquisition -> 'first' ->> 'msclkid', '') <> '' then 'bing'
      when lower(coalesce(profile.acquisition -> 'last' ->> 'utmSource', profile.acquisition -> 'first' ->> 'utmSource', '')) like '%bing%' then 'bing'
      else 'unknown'
    end
  )
from public.learner_profiles as profile
where profile.id = delivery.learner_profile_id;

create unique index if not exists learner_email_deliveries_provider_message_uidx
  on public.learner_email_deliveries (provider, provider_message_id)
  where provider_message_id is not null;

create table if not exists public.learner_email_events (
  id uuid primary key default gen_random_uuid(),
  delivery_id uuid not null references public.learner_email_deliveries(id) on delete cascade,
  learner_profile_id uuid not null references public.learner_profiles(id) on delete cascade,
  external_user_id text,
  provider text not null default 'resend',
  provider_message_id text,
  provider_event_id text not null,
  campaign_key text not null check (
    campaign_key in ('welcome','day_1_next_steps','day_2_follow_up','day_3_follow_up','week_1_digest')
  ),
  event_type text not null check (
    event_type in ('sent','delivered','opened','clicked','bounced','complained','unsubscribed')
  ),
  event_at timestamptz not null default now(),
  email_source text,
  email_medium text,
  email_campaign text,
  email_content text,
  cohort_source text,
  cohort_medium text,
  cohort_campaign text,
  cohort_paid_source text,
  link_url text,
  link_host text,
  link_path text,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(provider, provider_event_id)
);

create index if not exists learner_email_events_delivery_event_idx
  on public.learner_email_events (delivery_id, event_type, event_at desc);

create index if not exists learner_email_events_source_idx
  on public.learner_email_events (cohort_source, email_campaign, event_type, event_at desc);

alter table public.learner_email_events enable row level security;

drop policy if exists learner_email_events_owner_select on public.learner_email_events;
create policy learner_email_events_owner_select on public.learner_email_events
  for select using (
    exists (
      select 1
      from public.learner_profiles lp
      where lp.id = learner_profile_id
        and lp.auth_user_id = auth.uid()::uuid
    )
  );
