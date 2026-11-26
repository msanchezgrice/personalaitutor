/**
 * Copy for the landing page (`/`), from the approved design
 * `thoughts/shared/design/2026-11-25-remap/Main.dc.html`.
 *
 * Kept in one module so the page, its JSON-LD and the tests read the same
 * strings. Honesty rules: the only statistics are the three sourced ones below,
 * Maya Ortiz is a fictional example and is labelled as one wherever she appears,
 * and the voice model is described as tuned in context.
 */

export const LANDING_META_TITLE = "Find Your New Job Title for the AI Era | My AI Skill Tutor";

export const LANDING_HERO = {
  kicker: "For people whose job title is disappearing",
  titleLead: "Your experience isn't obsolete. It's",
  titleAccent: "unmapped.",
  lede: "Tell us what you did before. We map it to the AI-era job it fits, then help you prove it in public: a live site, a model tuned on your own work, and a build log.",
  formLabel: "What did you do before?",
  placeholder: "Paste your résumé, or describe your last job in a few lines",
  submitLabel: "Map my career",
  uploadLabel: "Upload résumé (PDF or Word)",
  note: "Free. No account needed. Takes about a minute.",
  mapCaption: "Example: Maya, a game-studio marketing manager, remapped to Go-to-Market Engineer.",
} as const;

export const LANDING_META_DESCRIPTION = LANDING_HERO.lede;

export const LANDING_FILM = {
  title: "The 65-second version",
  summary: "Maya's studio closed. 140 applications, 0 callbacks. Then someone drew her a map.",
  note: "Maya and her studio are fictional. The film is an example of how a route gets drawn.",
  posterAlt: "Frame from the launch film: a career transit map with a green route crossing from old jobs to new jobs",
} as const;

export type LandingStat = { value: string; label: string; source: string; tone: "old" | "new" | "deep" };

/** The only statistics allowed on public pages, each with its source. */
export const LANDING_STATS: readonly LandingStat[] = [
  { value: "1 in 3", label: "U.S. game workers were laid off in the last two years.", source: "GDC State of the Game Industry 2026", tone: "old" },
  { value: "170M", label: "new jobs are expected worldwide by 2030.", source: "World Economic Forum, Future of Jobs Report 2025", tone: "new" },
  { value: "62%", label: "average pay premium for workers with AI skills.", source: "PwC 2026 Global AI Jobs Barometer", tone: "deep" },
];

export const LANDING_GAP_HEADING = "Old jobs are closing. New ones are opening. Nobody drew the map between them.";

export const LANDING_STEPS = [
  {
    title: "1. Tell us what you did",
    body: "Paste your résumé or describe your last job. We read what you actually did, line by line, and ignore the title.",
    dot: "old",
  },
  {
    title: "2. We translate it",
    body: "Each thing you did is matched to the AI-era skill it has become, with the line from your résumé that backs it up.",
    dot: "new",
  },
  {
    title: "3. You get a new title and a route",
    body: "One title that fits best, two alternates, the gaps to close, and the three pieces of proof that will make it believable.",
    dot: "arrived",
  },
] as const;

export const LANDING_EXAMPLE = {
  heading: "Maya's translation",
  label: "Example",
  context: "Senior Marketing Manager at a game studio, 2018 to 2025.",
  rows: [
    { before: "Planned 4 global game launches", now: "Builds AI launch workflows" },
    { before: "Wrote player emails to 12M players", now: "Writes brand-voice prompts" },
    { before: "Grew a 90k-member Discord", now: "Designs community agents" },
  ],
  newTitleLabel: "Her new title",
  newTitle: "Go-to-Market Engineer",
  cta: "Find yours",
} as const;

export const LANDING_PROOF = {
  heading: "Then we help you prove it",
  lede: "A new title on a résumé is a claim. These are three things a hiring manager can open and check.",
  site: {
    title: "A site of your own",
    body: "Your new title, your translated skills and your projects on one public page. We draft it from your map; you edit and publish.",
    url: "myaiskilltutor.com/u/maya-ortiz",
    name: "Maya Ortiz",
    headline: "Go-to-market engineer for game studios",
    bio: "I turn launch plans into AI workflows, player emails into brand-voice prompts, and communities into agents.",
  },
  model: {
    title: "A model tuned on your work",
    body: "Give it samples of your writing. It learns your voice, and visitors can try it on your page next to the untuned model. The model card says exactly how it was tuned.",
    name: "maya-voice-v1",
    tunedOn: "Tuned on 24 of her launch emails",
    baseLabel: "Base model",
    baseOutput: "Exciting update coming soon!",
    tunedOutput: "Squad up. Season 4 drops Friday.",
  },
  log: {
    title: "A build log that shows the work",
    body: "Short posts about what you built this week: the prompt, the setup, what broke. Your tutor drafts from your notes; you publish and share.",
    byline: "Maya Ortiz · Build log · Week 3",
    postTitle: "I turned our launch checklist into one agent workflow",
    steps: ["Brief", "Agent drafts", "Maya reviews"],
  },
} as const;

export const LANDING_REMAPPED = {
  kicker: "Remapped",
  heading: "One new career, remapped every week",
  body: "Each week we take one job that is shrinking and draw its route: which skills carry over, what the new title is, and what to build first.",
  cta: "See every route",
} as const;

export const LANDING_TUTOR = {
  heading: "A tutor for the whole route",
  items: [
    { title: "A weekly plan for your new title", body: "Short modules that end in something you can show, in the order your route needs them." },
    { title: "An AI tutor, any hour", body: "Stuck on a step? Ask. It knows your background, your map and what you built last." },
    { title: "Daily AI news for your field", body: "One briefing a day, filtered to the job you are moving into, with one small action." },
  ],
} as const;

export const LANDING_PRICING = {
  heading: "The map is free. Building the proof is one plan.",
  free: {
    title: "Career map",
    price: "Free",
    features: [
      "Your new title and two alternates",
      "Every skill translated, with the résumé line behind it",
      "The gaps to close and what to build first",
      "A link to your map you can keep and share",
    ],
    cta: "Map my career",
  },
  paid: {
    title: "Career Builder",
    price: "$49.99",
    cadence: "per month, after a 7-day free trial",
    features: [
      "Proof Studio: your site, your tuned model, your build log",
      "A weekly plan built for your new title",
      "The AI tutor, any hour",
      "Daily AI news for your field",
    ],
    cta: "Start 7-day free trial",
    ctaSignedIn: "Open Proof Studio",
    note: "Card required to start the trial. Cancel any time before day 7 and you pay nothing.",
  },
} as const;

export type LandingFaq = { question: string; answer: string };

export const LANDING_FAQ_HEADING = "Questions people ask first";

export const LANDING_FAQS: readonly LandingFaq[] = [
  {
    question: "Will this get me a job?",
    answer: "Nobody can promise that. What you get is a title that fits what you have actually done, and proof a hiring manager can open and check.",
  },
  {
    question: "How do you choose the new title?",
    answer: "From the work in your résumé, not from your old title. Every translated skill shows the line it came from, so you can see the reasoning and disagree with it.",
  },
  {
    question: "Is the model really tuned on my work?",
    answer: "Yes, in context: we build a voice profile from your samples and run a base model with your examples. Your model card states the method, the base model and the number of samples.",
  },
  {
    question: "Do I need to know how to code?",
    answer: "No. The routes start from marketing, design, production, QA, support and recruiting work. Your tutor walks you through each build.",
  },
  {
    question: "What happens to my résumé?",
    answer: "We use it to draw your map and nothing else. Your map is private until you choose to share the link.",
  },
];

export const LANDING_GUIDES = {
  heading: "Guides for the move",
  lede: "Free, plain-language guides on mapping what you did and showing what you can do now.",
  cta: "Browse all guides",
  /** Career-change guides first; the generic featured list fills any gap. */
  slugs: ["career-mapping-transferable-skills", "my-job-is-disappearing", "ai-skills-for-resume"],
} as const;

export const LANDING_FINAL = {
  heading: "Find your new title",
  body: "Paste your résumé and see where your experience goes next. It takes about a minute and costs nothing.",
  cta: "Map my career",
} as const;
