# Five articles, one practical career journey

Status: drafts for editorial review. Publish order is a recommendation, not a schedule or deployment authorization.

## Positioning

**You already have useful experience. Find where it transfers, learn the missing workflow, and build something that makes your next move credible.**

Audience: experienced professionals whose work is changing, with a focused entry for people leaving or reconsidering games. The product promise is guided learning and inspectable work. It is not job placement, a labor-market forecast, or instant qualification from a resume upload.

| Priority | Content | Proposed `/learn/` slug | Search intent / ownership | Reader leaves with |
| --- | --- | --- | --- | --- |
| 1 | How to Reframe Your Resume for the AI Job Market | `ai-skills-for-resume` | AI skills for resume; career change resume | Truthful summary, rewritten bullets, separate project section |
| 2 | Career Mapping: Turn Your Old Job Title into New Options | `career-mapping-transferable-skills` | Career mapping; transferable skills examples | Two possible directions, evidence gaps, one small experiment |
| 3 | How to Get a Job in the Age of AI | `how-to-get-a-job-in-the-age-of-ai` | Tentpole for the full job-search process | Target-role brief, proof project, outreach/interview plan |
| 4 | My Job Is Disappearing. What Do I Do Now? | `my-job-is-disappearing` | Task disruption and reskilling decision | Immediate plan and a choice between adapt, adjacent move, or retrain |
| 5 | After a Gaming Layoff: How to Find Your Next Role | `career-change-after-gaming-layoff` | Gaming transition; specific audience test | Games-to-other-work examples and a refreshed search process |

The main job-search guide is the tentpole even though the narrower resume and mapping pages are recommended for the first release. Editorial importance and measured keyword demand are different.

## Existing pages to retain and strengthen

- `prove-ai-skills-to-employers`: owns proof and non-degree evidence; add current observed FAQs and link to resume/mapping.
- `how-to-build-an-ai-portfolio`: owns case-study construction and portfolio packaging.
- `ai-upskilling-roadmap`: owns broad AI upskilling/learning plans; add a career-transition entry and one-project option.
- `ai-skills-for-product-managers`, `ai-skills-for-marketers`, `ai-skills-for-operations-managers`: remain role-workflow guides; new career pages refer to them.
- `prompt-engineering-for-workflows` and `workflow-automation-with-ai`: own practical implementation advice; don't recreate them in every career article.

## Internal links and conversion

Each draft includes links to existing learning, portfolio/proof, product, and assessment/signup routes. At integration, add reciprocal links among the five new pages and the existing guides above. Do not publish local Markdown filenames as public links.

Primary asset: **Career Remapping Workbook: From Past Work to Your Next Proof Project**. Provide the useful mapping exercise openly. A future email offer may invite readers to save or receive the workbook, but do not require an account merely to understand the core advice. No email form, delivery system, or mailing consent flow has been created in this task.

The worksheet can precede an existing tutor assessment. The local Career Studio prototype is an internal concept source, not a public CTA. Any future product link must accurately describe the released functionality at that time.

## Editorial standards

- Use actual tasks and constraints before proposing role names. Let readers choose a different path or no fit.
- Keep prior employment separate from independent AI projects. Never retroactively insert AI work into an old job.
- Mark all example people, artifacts, results, and metrics as illustrative. Never convert an example into a customer case study.
- Describe titles as search directions, not one-to-one replacements or verified open roles.
- Treat job listings as perishable. A reader should confirm responsibilities, location, seniority, pay constraints, and employer policies on the exact current employer page.
- Do not state that AI caused all gaming layoffs, that entire occupations have vanished, or that any career is AI-proof.
- Explain testing, model limits, and human review through concrete work. Proactivity means scoping and completing a bounded task, including asking for help when needed.
- Avoid claims about beating ATS, guaranteed interviews, employability percentages, fabricated time saved, or universal degree requirements.

## Integration checklist after editorial approval

Use the existing `apps/web/lib/learn-content.ts` content system and `/learn/[slug]` renderer. Keep the current schema; represent mapping rows as concise section bullets unless a real table component is warranted. If a new renderer, download route, or form changes behavior, write its failing behavior test first. For content-only integration, run the existing relevant content/route checks, typecheck, and build; do not add tests that merely repeat every sentence.

Check one H1, unique metadata, valid related slugs, natural internal links, mobile reading, visible worksheet access, accurate CTA behavior, canonical URL, sitemap inclusion, and no broken links. Use the GitHub/Vercel integration for a preview PR. Publishing/merging/deployment requires the user's subsequent approval. No claimable deployment or new Vercel project is needed.
