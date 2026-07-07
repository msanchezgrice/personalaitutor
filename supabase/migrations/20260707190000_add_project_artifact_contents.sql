-- Real artifact generation (Phase 2.1 rebuild): structured, LLM-generated
-- artifact content persisted per artifact URL. The /generated/[...slug] route
-- feeds this content to the HTML/PDF/DOCX/PPTX writers; artifacts without a
-- content row (legacy placeholders) no longer render and never satisfy the
-- built-state gate.

create table if not exists public.project_artifact_contents (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  learner_profile_id uuid references public.learner_profiles(id) on delete set null,
  artifact_url text not null unique,
  kind text not null,
  content_kind text not null check (content_kind in ('website', 'resume', 'deck', 'brief')),
  content jsonb not null,
  model text,
  created_at timestamptz not null default now()
);

create index if not exists project_artifact_contents_project_idx
  on public.project_artifact_contents (project_id, created_at desc);

create index if not exists project_artifact_contents_profile_idx
  on public.project_artifact_contents (learner_profile_id, created_at desc)
  where learner_profile_id is not null;

alter table public.project_artifact_contents enable row level security;

drop policy if exists project_artifact_contents_owner_select on public.project_artifact_contents;
create policy project_artifact_contents_owner_select on public.project_artifact_contents
  for select using (
    exists (
      select 1
      from public.projects p
      join public.learner_profiles lp on lp.id = p.learner_profile_id
      where p.id = project_id
        and lp.auth_user_id = auth.uid()::text
    )
  );
