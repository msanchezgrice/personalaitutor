# Make the 30-Day Plan the Operational Spine (assessment + fix plan, 2026-07-08)

Miguel's feedback: "update the initial modules or define them per career? the 30-day plan feels only partially there."
Verdict from code assessment: **it's neither — the 30-day plan is orphaned.** Modules are ALREADY per-career
(matrix.ts, 9 paths × 3-4 static module strings) but every user on a path gets the identical sequence, always
`modules[0]` first. The plan — the most personalized artifact we generate — connects to NOTHING after the
anonymous report page.

## As-is wiring (verified, citations)
- 30-day plan: generated (assessment-report.ts:75-84, prompt :158), persisted in every assessment_report_history
  row, rendered ONLY at assessment/report/[token]/page.tsx:188-209. Repo-wide grep: nothing else reads it.
  Daily rescore copies it forward frozen (daily-action.ts:379-391) but never reads it.
- Modules: profile.careerPathId (self-selected at onboarding, NOT report.recommendedPath) → static
  MODULE_TRACKS filter (runtime.ts:3271, store.ts:1557); active module ALWAYS modules[0]
  (projects/page.tsx:22, artifact-generation.ts:88-96); starter project = generic "{career} Starter Build"
  (runtime.ts:3147-3162). Report gaps/plan influence module selection 0%.
- Daily actions: gaps × today's briefing only (daily-action.ts:317,362-368; briefing-rescore.ts:84-147).
  The `activeArtifactTitles` prompt hook (briefing-rescore.ts:67-68,90-92) exists but is NEVER populated.
  daily_actions rows store gap_ref, no plan_week/module.
- Weekly email nextStep: gap-based or generic "pick the next module" (weekly-report.ts:120-124). Plan absent.
- Playbook depth cliff: rich 5-step playbooks only for product-management + marketing-seo; other 7 paths generic.

Three parallel rails that never meet: path→modules, gaps→daily action, plan→/dev/null.

## Fix plan (phases; S/M/L; no new tables except one optional column)
1. **[S] Plan weeks name real modules**: add optional `moduleTitle` per thirtyDayPlan week
   (assessment-report.ts schema + prompt — model picks from the recommended path's modules[], already in
   prompt at :116-118). Plan becomes a per-user module ORDERING. Backward compatible.
   **[S] Current-week helper**: pure function (clamp 1..4 by weeks since report.createdAt, or by completed
   module count). No storage.
2. **[M] Kill static modules[0]**: projects/page.tsx:22 + artifact-generation.ts:92 select active module from
   thirtyDayPlan[currentWeek].moduleTitle (fallback modules[0] when no report).
   **[M] Personalized starter project**: seed title/description from plan week 1 focus + #1 gap (runtime.ts:3147-3162).
   **[M] Order moduleRecommendations by plan** (runtime.ts:3271, store.ts:1557).
3. **[M] Dashboard "This week's focus" card**: thirtyDayPlan[currentWeek] + 4-dot week tracker (reuses
   getLatestAssessmentReportForProfile). **[S/M] Week completion** via module_tutor_sessions completion;
   optional migration: nullable daily_actions.plan_week smallint.
4. **[S] Daily action knows the week**: populate activeArtifactTitles hook with current week's moduleTitle+focus.
   **[S] Weekly email nextStep** anchors to plan week (weekly-report.ts:120-124).
5. **[L] Author rich playbooks for remaining 7 paths** — do LAST, after the plumbing routes users there.

Payoff: phases 1-2 de-orphan the plan and make module sequence per-user (the core complaint); 3 makes progress
visible; 4 closes the loop; 5 is the content lift. Full agent report in session 2026-07-07/08 transcript.
