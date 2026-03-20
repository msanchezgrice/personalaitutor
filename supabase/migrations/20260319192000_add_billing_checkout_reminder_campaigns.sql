alter table if exists public.learner_email_deliveries
  drop constraint if exists learner_email_deliveries_learner_profile_id_campaign_key_key,
  drop constraint if exists learner_email_deliveries_campaign_key_check,
  drop constraint if exists learner_email_deliveries_status_check;

alter table if exists public.learner_email_deliveries
  add constraint learner_email_deliveries_campaign_key_check check (
    campaign_key in (
      'welcome',
      'day_1_next_steps',
      'day_2_follow_up',
      'day_3_follow_up',
      'week_1_digest',
      'billing_checkout_reminder_1h',
      'billing_checkout_reminder_24h'
    )
  ),
  add constraint learner_email_deliveries_status_check check (
    status in ('queued','processing','sent','failed','skipped')
  );

create index if not exists learner_email_deliveries_queue_idx
  on public.learner_email_deliveries (campaign_key, status, created_at asc);

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
      'billing_checkout_reminder_24h'
    )
  );
