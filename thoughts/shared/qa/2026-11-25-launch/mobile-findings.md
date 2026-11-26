# Mobile QA walk: My AI Skill Tutor (390x844, touch)

Production: https://www.myaiskilltutor.com. Map generated once: `/map/7slwQUqpuSvc1YX_VUzWE3Dd_u4TZmX6`.
Video: `mobile/qa-mobile-walk.mp4`, 180 s. Extra checks: `mobile/extra.json`, screenshots `mobile/shots/x-*.png`.

## Walk steps
| # | Step | Result | Time (s) | Note |
|---|---|---|---|---|
| 1 | home-load | PASS | 8.0 | status 200 |
| 2 | home-scroll-sections | PASS | 24.7 |  |
| 3 | home-film-plays | PASS | 4.3 | video {"paused":false,"t":3.500617,"ready":4,"src":"https://www.myaiskilltutor.com/video/the-missing-map-720p.mp4"} |
| 4 | home-nav-links | PASS | 2.6 | nav: /#how, /#proof, /remapped, /#pricing, /learn |
| 5 | hero-to-map-generation | PASS | 16.5 | generated in 6 s (after the first 2.5 s); mapPath /map/7slwQUqpuSvc1YX_VUzWE3Dd_u4TZmX6 |
| 6 | map-result-contents | PASS | 10.9 | translation nodes: 5; result text length 3939 |
| 7 | map-result-copy-link-and-email-validation | PASS | 2.3 | a real email was NOT submitted, on purpose |
| 8 | map-reload-shared-link | PASS | 5.6 | visitor status 200; og:image https://www.myaiskilltutor.com/api/og/map/7slwQUqpuSvc1YX_VUzWE3Dd_u4TZmX6; og image status 200 type image/png |
| 9 | map-input-modes | PASS | 5.2 | status 200; too-short message: NONE SHOWN |
| 10 | map-upload-extract | PASS | 5.8 | fixtures/resume.docx -> 834 characters extracted; the extracted text was NOT submitted (one map per run) |
| 11 | remapped-index-and-route | PASS | 21.2 | index status 200; routes listed: 6; unknown slug status 404; a scheduled slug guess returned 404 |
| 12 | example-proof-page | PASS | 11.2 | status 200 |
| 13 | signup-from-map | PASS | 6.3 | status 200; Clerk sign-up widget nodes: 1; no account was created, on purpose |
| 14 | pricing-cta-targets | PASS | 2.2 | trial CTA -> /sign-up?redirect_url=%2Fdashboard%2Fproof&from=map ; free CTA -> /map |
| 15 | dashboard-signed-out | PASS | 15.7 | /dashboard -> /sign-in; /dashboard/map -> /sign-in; /dashboard/proof -> /sign-in; /dashboard/proof/site -> /sign-in |
| 16 | existing-pages-still-work | PASS | 27.3 | /assessment/ status 200 overflow 0; /learn status 200 overflow 0; /employers status 200 overflow 0; /u/alex-chen-ai status 200 overflow 0; /sign-in status 200 o |
| 17 | machine-files-and-apis | PASS | 1.6 | /robots.txt 200; /sitemap.xml 200; /llms.txt 200; /agents.md 200; /.well-known/agent-card.json 200; /video/the-missing-map-poster.jpg 200; sitemap has /map: tru |
| 18 | not-found-pages | FAIL | 6.6 | unknown page status 200; unknown map status 404 |

Result: 17 passed, 1 failed (not-found-pages, see M-04).

## Findings

### Blocker
- None. The core flow (paste, map, result, sharing, email validation, upload) works on phone.

### Major
- **M-01** (/map/7slwQUqpuSvc1YX_VUzWE3Dd_u4TZmX6, screenshot `12-map-result-full.png`): The result credits the person with AI experience the description never mentions: the translations say they 'Design AI conversation flows' and 'Run AI-assisted community platforms', and the headline says the title 'aligns well with running AI-assisted community operations'. The same page then says there is 'No evidence of designing or tuning AI agents or conversation flows.' Expected: Translations should only restate what the input says, or flag a stretch clearly. The headline and the 'doesn't show yet' section should not contradict the translations. Evidence: Now: 'Designs AI conversation flows for player support' (from 'answered player questions about balance changes'); 'No evidence of designing or tuning AI agents or conversation flows.'; headline body: 'which aligns well with running AI-assisted community operations.'
- **M-02** (/map/7slwQUqpuSvc1YX_VUzWE3Dd_u4TZmX6, screenshot `12-map-result-full.png`): Proof plan item 2 is titled 'Tuned model' and says to 'Train a voice model', but the same card says nothing is retrained. The word 'tuned' is used for something that is only prompting with examples. Expected: The item should say plainly what is built (for example 'voice profile from your samples, used in prompts') and drop 'tuned' and 'train' if no training happens. Evidence: '2. Tuned model / community-manager-voice, tuned on your weekly patch notes and player newsletters' / 'Train a voice model on your written patch notes...' / 'How it is tuned: voice profile + examples in context. Nothing is retrained.'
- **M-03** (/, screenshot `02-home-full.png (slices home-04 and home-07 in mobile/slices)`): The landing page promises 'a model tuned on your own work' and the FAQ answers 'Is the model really tuned on my work?' with 'Yes', then describes in-context prompting. The example model card's base-model line reads like placeholder copy. Expected: State in plain words that personalization is done with examples in the prompt and no weights are trained. The example's base-model output should be a real sample, not a teaser line. Evidence: FAQ: 'Yes, in context: we build a voice profile from your samples and run a base model with your examples.' Example card: 'Base model / Exciting update coming soon!' and 'Tuned on 24 of her launch emails. Method: Voice profile + examples in context.'
- **M-04** (/zz-qa-nonexistent-page-12345, screenshot `35-404-page.png`): An unknown URL does not show a not-found page. It redirects (307) to the sign-in page and renders the sign-in widget. A mistyped link therefore looks like a broken sign-in wall. Unknown map links (/map/<bad token>) do return a correct 'We couldn't find that map' page with status 404. Expected: Unknown paths return HTTP 404 with a not-found page that links back to the career map. Evidence: curl: '307 https://www.myaiskilltutor.com/sign-in?redirect_url=https%3A%2F%2Fwww.myaiskilltutor.com%2Fzz-qa-nonexistent-page-12345'; walk step not-found-pages: 'unknown page status 200'; '/map/zz-nope' -> 404.

### Minor
- **m-01** (/, screenshot `01-home-top.png`): At 390px the top nav row is clipped: the last item shows only a stray 'G' and cannot be scrolled to or seen. 'Log in' appears at 768px but is absent on phones, so a returning signed-out user has no visible login link in the header. Expected: All nav items reachable at phone width (wrap, menu, or scrollable row with a visible cue), and a login entry point visible on phone. Evidence: Nav row at 390px: 'How it works  Proof  Remapped  Pricing  G'. At 768px (x-tab768-home-top.png): 'Log in' and 'Guides' visible.
- **m-02** (/map/7slwQUqpuSvc1YX_VUzWE3Dd_u4TZmX6, screenshot `11-map-result-top.png`): The result calls the pasted text a résumé even when the person described a job in a few lines (the walk used a description, not a résumé). Expected: Copy should say 'your input' or 'what you wrote' when the source was a description. Evidence: 'Your career map · drawn from your résumé'; 'Backed by 5 lines of your résumé'; 'From your résumé' on each translation.
- **m-03** (/employers, screenshot `32-existing-employers.png`): The header is cramped at 390px: the site name wraps onto two lines and the 'Browse Talent Pool' button wraps onto two lines. Expected: Single-line name and button, or a shorter label, at phone width. Evidence: Header shows 'My AI Skill / Tutor' on two lines and 'Browse / Talent Pool' on two lines.

### Polish
- **p-01** (/, screenshot `02-home-full.png (slice home-00)`): Route labels in the hero illustration (Copywriter, Recruiter, QA Tester, Paralegal) are very small on phone and hard to read. Expected: Minimum label size that reads at 390px, or fewer labels. Evidence: Labels render at roughly 9-10px in the 390px screenshot.
- **p-02** (/, screenshot `01-home-top.png`): The logo link in the header is 34x34px, under the 40px target size used for the other controls. Expected: At least 40px tap target. Evidence: extra.js tap-target scan: 'My AI Skill Tutor' A 34x34 at top 14.
- **p-03** (/remapped/ (route 'Marketing Manager to Go-to-Market Engineer'; exact slug not recorded), screenshot `23-remapped-route-top.png`): The route headline breaks 'Go-to-' and 'Market Engineer' across lines, so the hyphenated title splits awkwardly. Expected: Keep 'Go-to-Market' together (non-breaking hyphens) or allow the line to break before 'Go-to-Market'. Evidence: 'Marketing Manager to Go-to- / Market Engineer'.
- **p-04** (/remapped/ (route 'Marketing Manager to Go-to-Market Engineer'; exact slug not recorded), screenshot `24-remapped-route-full.png (slice 24-01)`): The 'What the old job becomes' comparison stacks its two column labels ('In the old job', 'In the new one') above a single list, so on a phone it is not clear which side each item belongs to. Expected: Clear before/after pairing on phone (for example 'Was:' and 'Now:' labels on each row). Evidence: Column labels rendered as two stacked lines above the list.
- **p-05** (/assessment/, screenshot `30-existing-assessment.png`): The assessment page uses a dark theme and a different header from the light landing and map pages, so the product looks like two sites. Expected: Consistent visual system, or a deliberate reason for the difference. Evidence: Dark background with 'Your Role / STEP 1/5' form versus the light landing page.

## Checked and fine
- No horizontal overflow at 390, 360, or 768 px on /, /map, /remapped, /remapped/qa-tester-to-model-evaluator, /u/maya-ortiz, /map/<token>, /sign-up?from=map (overflowPx 0 everywhere).
- Map result quotes: all five quoted lines appear verbatim in the DESCRIBE text.
- Map input short-text check: the walk reported 'NONE SHOWN', but the page does show 'Add at least 45 more characters' with a 15 / 20,000 counter (shot 18). That was a false alarm in the walk, not a product bug.
- Map input modes: Paste, Upload and Describe all switch state and the textarea takes focus (x-map-mode-*.png). The upload extraction preview renders (shot 20).
- Invalid email shows an error without submitting (shot 14). No real email was submitted.
- Example page (/u/maya-ortiz) is labelled 'Example profile' at the top and the bottom says it is fictional.
- Landing example card (Maya) and the film caption are labelled 'Example' and 'fictional'. Build log card labelled 'Example'.
- Existing pages return 200 and fit the screen: /assessment/, /learn, /employers, /u/alex-chen-ai, /sign-in.
- Signed-out dashboard routes redirect to /sign-in.
- Shared map link: visitor page loads (200), og:image renders (200, image/png).
- Map 404 for an unknown token renders a proper not-found page.
- Landing header is not sticky: after scrolling 1500 px the header scrolls away (x-home-scroll1500.png). Header height at top is about 96 px on the landing page and 73-88 px on other pages.
- Map mode buttons are 45px tall. The only control under 40 px on the first two screens of / is the logo link (p-02).
- No broken images on /.
- Launch film plays (video reports playing state).
- Robots, sitemap, llms.txt, agents.md, agent card and API auth checks pass (401 when signed out).

## Could not check
- Anything behind sign-in: the real dashboard, Proof Studio, and the voice model page.
- Real account creation (Clerk sign-up) and sign-in with Google. Not run on purpose.
- Real email delivery of the map link. No address was submitted.
- Payment and trial start. Not run.
- Real résumé upload from a file the person owns: only the fixture resume.docx was used, and its text was not submitted.
- Real devices, Safari iOS rendering, and landscape orientation. Only Chromium emulation was used.
- The route-map SVG was checked by screenshot only, not by inspecting its SVG text.
- Desktop walk was not run in this task.
