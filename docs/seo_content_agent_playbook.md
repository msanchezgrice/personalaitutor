# SEO Content Agent Playbook

## Goal

Grow qualified search traffic from people trying to:

- learn AI for work
- build AI skills
- upskill with AI
- create an AI portfolio
- prove AI skills to employers
- understand which AI projects to build first

The current public content system lives in:

- `/Users/miguel/PersonalAITutor/apps/web/lib/learn-content.ts`
- `/Users/miguel/PersonalAITutor/apps/web/app/learn/page.tsx`
- `/Users/miguel/PersonalAITutor/apps/web/app/learn/[slug]/page.tsx`

For now, new evergreen guides should be added to `learn-content.ts` unless there is a clear reason to create a new route family.

## Publishing Priorities

### Tier 1: Highest impact

- AI upskilling roadmap pages
- AI portfolio and proof pages
- role-based AI upskilling pages
- skill-specific pages tied to tangible workflows

### Tier 2: Strong support

- project idea pages
- case studies
- comparison pages such as `AI course vs AI project portfolio`
- FAQ roundup pages

### Tier 3: Lower priority

- generic AI news summaries
- broad “what is AI” explainers
- opinion content with weak buyer intent

## Content Types and Word Counts

### Pillar guide

- Target length: `1,800-2,400 words`
- Use for: roadmap, portfolio, proof, “how to learn AI for work”
- Structure:
  - 1 short intro
  - 5-7 H2 sections
  - 1 FAQ block with `4-6` questions
  - 1 CTA block tied to assessment or example profile

### Role page

- Target length: `1,200-1,800 words`
- Use for: marketers, product managers, operators, support, sales, founders
- Structure:
  - “What AI changes in this role”
  - “Best first projects”
  - “Recommended tool stack”
  - “How to prove skill in this role”
  - FAQ with `3-5` questions

### Skill page

- Target length: `1,000-1,500 words`
- Use for: prompt engineering, workflow automation, AI research systems, API integrations, portfolio proof
- Structure:
  - skill definition in plain English
  - when the skill matters
  - common workflows
  - example projects
  - mistakes to avoid
  - FAQ with `3-4` questions

### Case study

- Target length: `900-1,300 words`
- Use for: before-and-after transformation stories
- Structure:
  - starting point
  - workflow built
  - artifact or proof
  - measurable outcome
  - lessons learned

### Comparison page

- Target length: `900-1,200 words`
- Use for: “course vs portfolio”, “prompting vs workflow automation”, “certification vs proof”
- Structure:
  - define both options
  - compare by hiring value, speed, proof, transferability
  - recommend by audience

## Required On-Page Elements

Every new SEO page should include:

- one unique H1
- one unique meta title
- one unique meta description
- `4-8` natural internal links
- `3-5` keyword variations used naturally
- one FAQ block
- one CTA
- one “proof” angle, not just educational copy

Avoid:

- generic intros longer than 120 words
- listicles with no role-specific detail
- fluffy AI trend commentary
- keyword stuffing
- pages that do not answer a concrete search intent

## Internal Linking Rules

Every new article should link to:

- `/learn`
- one related `learn` guide
- `/u/alex-chen-ai`
- homepage `/`
- one conversion page such as `/sign-up?redirect_url=/onboarding/`

When role pages exist, each role page should also link to:

- one skill page
- one case study
- one portfolio/proof page

## Best Topic Batches

### Batch 1: Publish next

- `AI Skills for Product Managers`
- `AI Skills for Marketers`
- `AI Skills for Operations Managers`
- `Prompt Engineering for Workflows`
- `Workflow Automation with AI`
- `AI Project Ideas for Your Portfolio`

### Batch 2

- `How to Put AI Projects on Your Resume`
- `How to Write LinkedIn Posts About AI Work`
- `AI Skills for Customer Support Leaders`
- `AI Skills for Sales and RevOps`
- `AI Portfolio Examples for Non-Engineers`

### Batch 3

- `AI Certifications vs Real Project Proof`
- `Best AI Projects for Career Switchers`
- `How to Build an AI Research Workflow`
- `How to Build an Internal AI Copilot`
- `How to Evaluate AI Output Quality`

## Agent Prompt Template: Pillar Guide

Use this when adding a new evergreen guide to `learn-content.ts`.

```text
Write one evergreen SEO article for My AI Skill Tutor and add it as a new object in `/Users/miguel/PersonalAITutor/apps/web/lib/learn-content.ts`.

Topic: {{TOPIC}}
Primary keyword: {{PRIMARY_KEYWORD}}
Secondary keywords: {{SECONDARY_KEYWORDS}}
Audience: working professionals trying to build AI skills and show proof to employers
Length target: 1,800-2,400 words
Tone: direct, practical, specific, zero fluff

Requirements:
- The article must be useful for someone trying to learn AI for work, not for hobbyist curiosity.
- Focus on workflows, portfolio proof, and career leverage.
- Use 5-7 sections with concrete sub-advice.
- Include 4-6 FAQs.
- Include takeaways that are concise and actionable.
- Avoid hype, vague future predictions, and generic “AI is changing everything” filler.
- Mention specific examples of projects, artifacts, workflows, and employer-facing proof.
- Write clean, natural prose that reads like a senior operator or product-minded builder.

Output format:
- Return a valid `LearnArticle` object only.
- Use the existing schema in `learn-content.ts`.
- Set `publishedAt` and `updatedAt` to today's date in `YYYY-MM-DD`.
- Add 2 related slugs that already exist in `learn-content.ts`.
```

## Agent Prompt Template: Role Page

```text
Write one role-based SEO guide for My AI Skill Tutor and add it as a new object in `/Users/miguel/PersonalAITutor/apps/web/lib/learn-content.ts`.

Topic: {{ROLE_TOPIC}}
Primary keyword: {{PRIMARY_KEYWORD}}
Audience: {{ROLE}}
Length target: 1,200-1,800 words

Must include:
- what AI changes in this role now
- top 3-5 workflows this role should learn
- recommended starter tool stack
- 3 project ideas for building proof
- how to show this work on a portfolio or LinkedIn
- 3-5 FAQs

Constraints:
- Make the page role-specific, not generic.
- Use examples the role already understands.
- Do not spend time explaining basic AI terminology unless it affects the workflow.
- Keep the content useful for someone who wants career leverage in the next 90 days.

Output:
- Return one valid `LearnArticle` object only.
```

## Agent Prompt Template: Skill Page

```text
Write one skill-specific SEO guide for My AI Skill Tutor and add it as a new object in `/Users/miguel/PersonalAITutor/apps/web/lib/learn-content.ts`.

Skill topic: {{SKILL}}
Primary keyword: {{PRIMARY_KEYWORD}}
Length target: 1,000-1,500 words

Must include:
- what the skill means in practical work terms
- where the skill appears in real workflows
- common mistakes
- 2-4 example projects
- how employers evaluate this skill
- 3-4 FAQs

Tone:
- precise
- concrete
- useful to professionals
- not academic

Output:
- Return one valid `LearnArticle` object only.
```

## Agent Prompt Template: Case Study

```text
Write one SEO case study for My AI Skill Tutor and add it as a new object in `/Users/miguel/PersonalAITutor/apps/web/lib/learn-content.ts`.

Topic: {{CASE_STUDY_TOPIC}}
Primary keyword: {{PRIMARY_KEYWORD}}
Length target: 900-1,300 words

Structure:
- initial problem
- workflow built
- tools used
- artifacts created
- measurable outcome
- lessons learned
- FAQ with 3 questions

Important:
- Write it like a believable transformation story.
- Include specific workflow and proof details.
- Avoid fake vanity metrics.

Output:
- Return one valid `LearnArticle` object only.
```

## Review Checklist Before Publishing

- Title is unique and search-intent aligned
- Slug is short and friendly
- Description is specific and not generic
- Article includes at least one strong CTA
- Article includes related links
- Copy contains concrete workflows and proof examples
- FAQ answers are specific
- Build passes after the change

## Suggested Next 10 Pages

- `ai-skills-for-product-managers`
- `ai-skills-for-marketers`
- `ai-skills-for-operations-managers`
- `prompt-engineering-for-workflows`
- `workflow-automation-with-ai`
- `ai-project-ideas-for-your-portfolio`
- `how-to-put-ai-projects-on-your-resume`
- `ai-portfolio-examples-for-non-engineers`
- `ai-certifications-vs-project-proof`
- `how-to-evaluate-ai-output-quality`
