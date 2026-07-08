# UX Audit — myaiskilltutor.com (2026-07-07, post-rebuild)

Method: live browser walk (browse daemon, anonymous + authed test user `migs+mast-e2e@agentmail.to`) of
landing, /learn, /employers, /u/alex-chen-ai, sign-up, /assessment (full run, prior session), report page,
onboarding (full run incl. AI analysis), billing gate; plus code-level review of Projects workbench, chat,
AI News; plus Miguel's screenshots of the paid dashboard. Paid-dashboard live walk pending test-user billing
row. Severity: 🔴 breaks trust/conversion · 🟠 confusing · 🟡 polish.

## 🔴 F1 — Two contradictory scores (worst finding)
The anonymous assessment produces the NEW AI-readiness score (52/100, higher = better, LLM report).
Onboarding still runs the LEGACY deterministic analysis: "Low Risk (44/100) · Timeline: 3-5 years" — an AI
*impact risk* score where lower reads as safer, with "Key Risk Areas". A user who does both (the intended
funnel!) gets two conflicting numbers, opposite polarity, different frameworks. The product spine is the
readiness score; the onboarding risk analysis undermines it at the exact moment of highest intent.
**Fix:** kill onboarding's "Start AI Analysis" step. If a linked anonymous assessment exists → show THAT
report + score as the onboarding finale. If none → run the Phase 1 readiness report here (same module).
Deprecate the risk-score path entirely (`runtimeSubmitAssessment` deterministic output as user-facing).

## 🔴 F2 — Onboarding re-asks everything the assessment already captured
Onboarding step 1-2 = full name, career category, job title, years, company size, situation, goals,
LinkedIn — byte-identical questions to the anonymous assessment the user just completed. The claim/link
flow ties records together but prefills nothing.
**Fix:** when a linked assessment exists, onboarding collapses to: confirm prefilled basics (1 screen) →
resume upload (optional) → done. Cuts onboarding from 3 screens + 60s analysis to ~30 seconds.

## 🔴 F3 — Sign-up page copy contradicts the anonymous flow
Side panel says: "Get your AI assessment report by email… **Create your account first** so we can save your
answers…" — legacy copy from when the assessment lived behind sign-up. Now actively false (the report was
already emailed without an account) and re-raises the wall Phase 1 tore down.
**Fix:** rewrite panel: "Your score is saved. Create your account to start raising it — tutor sessions,
weekly proof artifacts, and your score trend." (Also update the /onboarding signed-out variant: "Create your
account first. Start with social login… then finish your personalized assessment" — same legacy framing.)

## 🔴 F4 — Projects workbench: four competing systems on one page (Miguel: "this entire project flow is confusing")
One module currently shows: (a) legacy module STEPS list, each with its own Attach Proof + Not started/Start
buttons and per-step "PROOF REQUIRED / LINK / FILE UPLOAD / PDF / DECK" chips; (b) the NEW Tutor Session
panel (Step X of N + checklist); (c) BUILD ACTIONS — standalone "Generate Website Proof / Generate PDF /
Generate Deck" buttons; (d) LOG PROGRESS free-text notes. Four parallel ways to "make progress," no
hierarchy, duplicated proof affordances.
Worse: the standalone Generate buttons bypass the evidence loop — they generate artifacts WITHOUT a
completed session's pasted evidence, producing weaker artifacts and cheapening "proof."
**Fix (deprecation-first):**
1. Tutor Session becomes THE workbench spine — top of page, full width.
2. DELETE the legacy per-step cards (Attach Proof / Start buttons); the session checklist subsumes them.
   Proof-upload lives inside the session's current step ("attach evidence").
3. DELETE standalone Generate buttons; artifact generation happens as the session finale (already built).
   Keep one escape hatch inside the session: "Skip ahead — generate from what I have."
4. Log Progress → collapse into the session's evidence notes (field already exists); delete the card.
Result: one module = one session = one artifact. Single mental model.

## 🟠 F5 — Stale tutor-session snapshots after playbook updates
Sessions snapshot their steps at start (by design, resumability). Miguel's session shows old 3-step content
while the Log Progress panel shows the new 5-step playbook — two texts for the same module on one screen.
**Fix:** banner on active sessions whose playbook changed: "This playbook was updated — Restart with the new
version" (restart = new session, old one archived). Cheap: compare stored steps hash vs current playbook.

## 🟠 F6 — Employers page presents synthetic candidates as real
"42 verified candidates live now · proof pages available instantly", "System Verified", featured talent
cards — all seeded synthetic data (`INCLUDE_SYNTHETIC_TALENT`, 20 fake candidates). For an employer this is
a fabricated marketplace; for the truthful-reporting ethos it's a liability. The example profile page
handles this correctly ("Example profile" label) — the employers page doesn't.
**Fix (choose one):** (a) label clearly: "Example candidates — talent pool opens soon", swap "42 live now"
for a waitlist CTA; or (b) unlink /employers from nav until the talent side is real. Recommend (a) — keeps
the SEO/positioning page, kills the dishonesty.

## 🟠 F7 — "AI Builder" persona label everywhere
Sidebar shows "Miguel SanchezGrice — AI Builder"; playbook copy says "For AI Builder, the goal is…" — an
internal persona string leaking into UI. Users picked "Product Manager", not "AI Builder".
**Fix:** show the user's career path ("Product Management") or goal; scrub "For AI Builder" from templates.

## 🟠 F8 — Onboarding review-screen copy bug
Review shows "Role: Not provided (Product Manager)" — the fallback renders alongside "Not provided".
Also "Ready for AI Analysis / takes 30-60 seconds" over-promises given F1's output quality.

## 🟡 F9 — XP widget lag
"15 XP to Level 2" then "25 XP to Level 2" across Miguel's screenshots — thresholds moved with the new XP
wiring mid-session. One-time artifact of tonight's ship; fine. Watch that XP only moves forward for users.

## 🟡 F10 — Chat Tutor generic-mode first message
(Fixed tonight for session mode.) The generic fallback's canned intro still says "Share where you're stuck
and I'll guide your next move" with no context of what the user could do. Low priority once F4 makes
sessions primary.

## 🟡 F11 — Assessment report → sign-up handoff loses the thread
Report CTA "Start Raising Your Score →" goes to generic sign-up (with F3's wrong copy). After sign-up +
onboarding (F1/F2 friction), the user lands on a dashboard whose score card must re-derive their linked
report. Every step that isn't "your score, continued" bleeds intent. Fixing F1-F3 mostly fixes this; ideal
end-state: report → sign-up → dashboard already showing YOUR score + first session CTA, zero re-entry.

## Deprecation list (approved surface: "we can deprecate anything legacy")
| Surface | Action |
|---|---|
| Onboarding deterministic risk analysis | DELETE — replace with linked readiness report (F1) |
| Onboarding duplicate questions | COLLAPSE when assessment linked (F2) |
| Legacy per-step module cards w/ Attach Proof buttons | DELETE — session checklist subsumes (F4) |
| Standalone Generate Website/PDF/Deck buttons | DELETE — session finale generates (F4) |
| Log Progress card | MERGE into session evidence notes (F4) |
| Employers "live candidates" framing | RELABEL as examples + waitlist (F6) |
| /dashboard/social route | Already de-navved; delete route after 30 days quiet |
| "AI Builder" persona strings | REPLACE with career path label (F7) |

## Suggested implementation order
1. F1+F2+F3 (funnel integrity — one score, no re-asking, honest copy) — ~1 day
2. F4 (workbench simplification — the confusion Miguel hit) — ~1 day
3. F5 (session restart banner) + F7 + F8 (copy) — ~half day
4. F6 (employers relabel) — ~2 hours
Pending: paid-dashboard live walk (blocked on test-user billing row) may add findings.
