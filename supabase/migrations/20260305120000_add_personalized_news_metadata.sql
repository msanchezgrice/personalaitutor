alter table if exists public.news_insights
  add column if not exists learner_profile_id uuid references public.learner_profiles(id) on delete cascade;

alter table if exists public.news_insights
  add column if not exists metadata jsonb not null default '{}'::jsonb;

create index if not exists news_insights_profile_published_idx
  on public.news_insights (learner_profile_id, published_at desc);
