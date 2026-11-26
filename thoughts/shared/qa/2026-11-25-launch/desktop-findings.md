# Desktop QA walk: myaiskilltutor.com (1440x900, production)

Run: walk.js desktop (run once, no re-run). Map generated: /map/2pLw4ybYOAD6xTEY1tIWIwAP_vvNCZxu
Video: desktop/qa-desktop-walk.mp4, 179.4 s.
Steps: 17 passed, 1 failed (not-found-pages).

## Walk steps

| # | Step | Result | Time (ms) |
|---|------|--------|-----------|
| 1 | home-load | pass | 9767 |
| 2 | home-scroll-sections | pass | 18312 |
| 3 | home-film-plays | pass | 4802 |
| 4 | home-nav-links | pass | 4193 |
| 5 | hero-to-map-generation | pass (generated in 6 s) | 18405 |
| 6 | map-result-contents | pass (5 translations) | 7227 |
| 7 | map-result-copy-link-and-email-validation | pass (invalid email blocked, no real submit) | 2499 |
| 8 | map-reload-shared-link | pass (visitor 200, OG image 200) | 6136 |
| 9 | map-input-modes | pass | 6275 |
| 10 | map-upload-extract | pass (824 chars extracted, not submitted) | 6228 |
| 11 | remapped-index-and-route | pass (6 routes) | 19573 |
| 12 | example-proof-page | pass | 10213 |
| 13 | signup-from-map | pass (no account created) | 6752 |
| 14 | pricing-cta-targets | pass | 2832 |
| 15 | dashboard-signed-out | pass (redirects to sign-in) | 14287 |
| 16 | existing-pages-still-work | pass | 31145 |
| 17 | machine-files-and-apis | pass | 1735 |
| 18 | not-found-pages | FAIL: unknown page returns 200 (D-02) | 6991 |

Walk note (harness, not product): step 9 logged "too-short message: NONE SHOWN", but screenshot 18-map-input-too-short.png shows "Add at least 45 more characters..." The walk check is wrong on this point.

## Findings

### Major
- D-01 Tuned-model wording conflicts with the method (map proof plan and landing FAQ).
- D-02 Unknown URLs return 200 and show the sign-in card, not a 404.

### Minor
- D-03 /employers primary CTA "Browse Talent Pool" while the pool is "opening soon".
- D-04 Upload extraction keeps PDF hard line breaks mid-sentence.
- D-05 Launch-film poster is clipped at the frame edges.
- D-06 Landing statistics have sources but are unverified here.
- D-07 Sign-up heading says "Your map is saved" before an account exists.
- D-08 Blocked third-party script and ad/analytics CSP errors on every page.

### Polish
- D-09 Low-contrast white label on the green Continue button (sign-up and sign-in).
- D-10 /assessment uses a dark theme unlike the rest of the site.

## Checked and fine
- Map result title "Model Evaluator" fits the QA Lead résumé (game studio, QA, certification, reports).
- All 5 map quotes appear verbatim in fixtures/resume.txt (one is a prefix of a longer line: "Wrote and maintained 1,400 regression test cases in TestRail").
- Route drawing labels do not overlap lines or each other at 1440 and 1024.
- Example profile (/u/maya-ortiz) is labelled "Example profile" at the top and "fictional" in the footer. Alex Chen profile labelled "EXAMPLE PROFILE".
- Map 404 ("We couldn't find that map") is correct.
- No horizontal overflow at 1024x768, 1440x900 or 1920x1080 on /, /map, /remapped, /u/maya-ortiz.
- Keyboard: 12 Tab presses on / reach logo, nav, Log in, Find your new title, résumé box, Map my career, Upload, video. Each focused element shows a visible outline.
- All 20 internal links on / return 200 (sign-in redirect for /dashboard links returns 200 on the sign-in page).
- No broken images on /.
- Email validation message appears on a bad address. No real email submitted.
- Upload mode: "Map my career" is disabled until a file is chosen (intended).
- Existing pages /assessment/, /learn, /employers, /u/alex-chen-ai, /sign-in all return 200 with no overflow.
- Machine files: robots.txt, sitemap.xml, llms.txt, agents.md, agent-card.json, poster image return 200. Protected APIs return 401 when signed out (with a spoofed header).

## Could not check
- The FAQ on / is not collapsible (all answers always visible), so no per-question click test was possible. Step "open FAQ" is marked not applicable.
- Anything behind sign-in: dashboard, proof studio, voice model, build log, trial start.
- Real email delivery for "Email me my map" (not submitted, on purpose).
- Payment and trial flow (not entered).
- The full-height /learn hero CTA row was cropped at the 900 px viewport in screenshot 31; not re-checked at full height.
- The 1 in 3 / 170M / 62% statistics were not verified against their sources.
- Film content beyond the poster frame (video was played for 3 s only).
