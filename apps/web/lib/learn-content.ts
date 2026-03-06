export type LearnArticleSection = {
  id: string;
  title: string;
  paragraphs: string[];
  bullets?: string[];
};

export type LearnFaq = {
  question: string;
  answer: string;
};

export type LearnArticle = {
  slug: string;
  category: string;
  title: string;
  description: string;
  heroSummary: string;
  readingTime: string;
  publishedAt: string;
  updatedAt: string;
  takeaways: string[];
  keywords: string[];
  sections: LearnArticleSection[];
  faq: LearnFaq[];
  relatedSlugs: string[];
};

export const learnArticles: LearnArticle[] = [
  {
    slug: "ai-upskilling-roadmap",
    category: "AI Upskilling",
    title: "AI Upskilling Roadmap for Working Professionals",
    description:
      "A practical roadmap for learning AI skills, building useful workflows, and creating proof-based portfolio projects that actually help your career.",
    heroSummary:
      "The fastest path to AI upskilling is not collecting random prompts or chasing every new model release. It is choosing one career outcome, learning a small working stack, and shipping visible projects that prove you can use AI in real workflows.",
    readingTime: "9 min read",
    publishedAt: "2026-03-06",
    updatedAt: "2026-03-06",
    takeaways: [
      "Start with one job outcome, not a vague goal like \"learn AI.\"",
      "Learn a small core stack before adding more tools.",
      "Ship three proof-based projects in increasing difficulty.",
      "Turn every project into a public artifact, build log, and portfolio entry.",
    ],
    keywords: [
      "AI upskilling",
      "AI skills roadmap",
      "how to learn AI for work",
      "AI learning plan",
      "AI career development",
    ],
    sections: [
      {
        id: "define-the-outcome",
        title: "1. Start with the work outcome you want",
        paragraphs: [
          "Most people make AI learning slower than it needs to be because they start with tools. They sign up for five apps, skim a few tutorials, and end up with shallow familiarity but no real leverage. A better starting point is the business problem or job outcome you want to improve.",
          "If you work in operations, maybe the outcome is faster reporting or better handoffs. If you work in marketing, maybe it is producing better briefs, research, and content systems. If you are a product manager, maybe it is generating specs, analyzing feedback, or turning notes into decisions. AI upskilling becomes much easier when the target is concrete.",
        ],
        bullets: [
          "Choose one role-specific outcome you care about this quarter.",
          "Write down the current manual workflow you want to improve.",
          "Define how you will measure the result: time saved, quality improved, speed to publish, or output volume.",
        ],
      },
      {
        id: "build-core-stack",
        title: "2. Learn a small core stack before anything else",
        paragraphs: [
          "You do not need to master every AI product. You need a compact stack that lets you go from idea to output. For most professionals, that means one conversational model, one workflow or coding environment, and one place to store or publish the result.",
          "A common mistake is over-indexing on prompt tricks while ignoring systems thinking. The real skill is learning how to break work into steps, pass context across those steps, and verify whether the output is actually usable. That is why your stack should support drafting, automation, and proof generation.",
        ],
        bullets: [
          "Pick one primary model or AI assistant for everyday work.",
          "Pick one build environment such as Cursor, Replit, or a workflow tool like Zapier or Make.",
          "Pick one publishing destination such as a portfolio page, public project page, or LinkedIn post.",
        ],
      },
      {
        id: "ship-three-projects",
        title: "3. Ship three progressively harder projects",
        paragraphs: [
          "The best AI learning plan is project-based. Your first project should save you time. Your second should combine multiple tools or steps. Your third should create something public that another person can inspect or use. That progression teaches you prompting, systems design, quality control, and communication without getting lost in theory.",
          "Each project should be narrow enough to finish quickly. A support reply assistant, research summarizer, content brief generator, lead qualification workflow, or meeting note system is usually a better first project than a giant autonomous agent. Early wins matter because they create reusable assets and real confidence.",
        ],
        bullets: [
          "Project 1: replace one repetitive task you already do every week.",
          "Project 2: connect one source of input to one repeatable output.",
          "Project 3: publish the workflow, result, or artifact as visible proof.",
        ],
      },
      {
        id: "publish-proof",
        title: "4. Convert your work into public proof",
        paragraphs: [
          "AI skill is much more credible when someone can inspect the workflow, not just read a claim about it. Employers and clients respond to proof: a project summary, artifact screenshots, build logs, measurable outcomes, tool stack, and a short explanation of what you improved.",
          "This is why portfolio structure matters as much as the underlying project. If the work is hidden inside private chats or local notebooks, it does not help your career nearly as much. Publish concise summaries, note the tools used, and explain the before-and-after state of the workflow.",
        ],
        bullets: [
          "Capture the problem, process, tools, and result for each project.",
          "Save artifacts such as prompts, outputs, screenshots, dashboards, or links.",
          "Add a short reflection on what changed after the first version shipped.",
        ],
      },
      {
        id: "run-90-day-plan",
        title: "5. Use a 30-60-90 day plan",
        paragraphs: [
          "A 30-60-90 structure keeps AI upskilling realistic. In the first 30 days, you want fluency with your core stack and one completed project. By day 60, you should have a second project and a cleaner sense of your repeatable workflow pattern. By day 90, you want a portfolio page, a public proof story, and language you can use in interviews or on LinkedIn.",
          "This timeline matters because it changes AI learning from open-ended exploration into a professional development system. The goal is not to feel informed. The goal is to become obviously useful.",
        ],
        bullets: [
          "Days 1-30: learn the tools and ship one time-saving workflow.",
          "Days 31-60: connect multiple steps and improve reliability.",
          "Days 61-90: publish case studies, portfolio proof, and employer-facing summaries.",
        ],
      },
      {
        id: "avoid-common-mistakes",
        title: "6. Avoid the common AI upskilling mistakes",
        paragraphs: [
          "The most common mistake is staying in consumption mode. Watching demos and collecting prompt libraries feels productive, but it does not create durable skill. Another mistake is chasing broad AI literacy without tying it to one domain, one function, or one measurable result.",
          "A third mistake is failing to document the work. Even when someone builds a good workflow, they often lose the career upside because they never translate it into a portfolio entry, public artifact, or interview narrative. Learning AI is useful. Proving AI skill is what changes opportunities.",
        ],
        bullets: [
          "Do not start with too many tools.",
          "Do not make your first project too big.",
          "Do not leave finished work undocumented.",
        ],
      },
    ],
    faq: [
      {
        question: "How long does AI upskilling usually take?",
        answer:
          "Most professionals can build meaningful momentum in 30 to 90 days if they focus on one role-specific outcome, use a small tool stack, and ship proof-based projects instead of consuming endless tutorials.",
      },
      {
        question: "Do I need to know how to code to learn AI skills?",
        answer:
          "No. Coding helps, but many strong first projects involve research, content systems, automations, process design, and evaluation. What matters most is learning how to structure work, test outputs, and publish proof.",
      },
      {
        question: "What is the best first AI project for work?",
        answer:
          "The best first project is a narrow workflow you already repeat often, such as summarizing notes, drafting responses, creating content briefs, or turning raw inputs into a structured deliverable.",
      },
      {
        question: "How do I show AI skills on LinkedIn or in interviews?",
        answer:
          "Use concrete examples. Show the workflow you built, the tools you used, the business problem it solved, the output it produced, and what changed after you shipped it.",
      },
    ],
    relatedSlugs: ["how-to-build-an-ai-portfolio", "prove-ai-skills-to-employers"],
  },
  {
    slug: "how-to-build-an-ai-portfolio",
    category: "AI Portfolio",
    title: "How to Build an AI Portfolio That Employers Trust",
    description:
      "A clear framework for turning AI projects into portfolio pages with build logs, artifacts, outcomes, and employer-facing proof.",
    heroSummary:
      "A strong AI portfolio is not a gallery of generic screenshots. It is evidence that you can scope work, use AI tools well, ship outputs, and explain the business value of what you built.",
    readingTime: "8 min read",
    publishedAt: "2026-03-06",
    updatedAt: "2026-03-06",
    takeaways: [
      "Center each portfolio page on a business problem and shipped result.",
      "Show the workflow, tool stack, and decision-making process.",
      "Include artifacts, metrics, and a short reflection on iteration.",
      "Use portfolio pages as a bridge to LinkedIn, resumes, and interviews.",
    ],
    keywords: [
      "AI portfolio",
      "AI portfolio examples",
      "how to build an AI portfolio",
      "AI project portfolio",
      "public proof of AI skills",
    ],
    sections: [
      {
        id: "portfolio-purpose",
        title: "1. Know what an AI portfolio is supposed to prove",
        paragraphs: [
          "An AI portfolio should prove that you can use AI to create useful work, not just that you have experimented with tools. Hiring managers want to know whether you can identify a problem, design a workflow, improve output quality, and communicate what you built.",
          "That means your portfolio needs to move beyond vague claims like \"used ChatGPT for research\" or \"built an AI app.\" The stronger approach is to document what the system did, how you used it, what tools were involved, and what changed because the workflow existed.",
        ],
        bullets: [
          "Show the problem clearly.",
          "Show the workflow clearly.",
          "Show the output clearly.",
          "Show why the work mattered.",
        ],
      },
      {
        id: "choose-project-types",
        title: "2. Choose project types that create believable proof",
        paragraphs: [
          "The best AI portfolio projects are easy to inspect. They often include a visible output, a repeatable process, and a short story about improvement over time. Internal workflow automations, research copilots, support assistants, content systems, enrichment tools, and evaluation pipelines all work well.",
          "Generic chatbot clones are weaker unless they solve a distinct business problem or include real workflow logic. Employers do not need another demo. They need evidence that you can make AI useful in context.",
        ],
        bullets: [
          "Workflow automation projects",
          "Research and summarization systems",
          "Content operations and brief generation",
          "Internal copilots for support, product, or sales",
        ],
      },
      {
        id: "page-structure",
        title: "3. Use the same structure on every project page",
        paragraphs: [
          "Consistency is helpful because it lets recruiters scan quickly. Every portfolio page should follow a repeatable structure: problem, audience, tool stack, workflow, artifacts, results, and lessons learned. This makes the portfolio feel professional and makes comparisons easier across projects.",
          "A repeatable structure also helps SEO. Search engines can better understand your pages when the layout is stable, the headings are descriptive, and the copy uses natural language around AI workflows, skills, tools, and outcomes.",
        ],
        bullets: [
          "Headline and one-sentence project summary",
          "Problem and user context",
          "Tools used and why they were chosen",
          "Workflow steps or build log",
          "Artifacts or outputs",
          "Outcome, metrics, and next iteration",
        ],
      },
      {
        id: "artifacts-and-build-logs",
        title: "4. Artifacts and build logs are the trust layer",
        paragraphs: [
          "Anyone can claim they built an AI workflow. Trust goes up when a portfolio page includes the outputs and the build trail behind them. Screenshots, prompt snippets, generated assets, test outputs, before-and-after comparisons, and links to shipped pages all increase credibility.",
          "Build logs are especially useful because they show iteration. They let you explain what changed between version one and version two, where the workflow failed, and how you improved it. That narrative demonstrates judgment, which matters more than novelty.",
        ],
        bullets: [
          "Link to public artifacts where possible.",
          "Show at least one concrete output from the system.",
          "Document one meaningful change you made after testing.",
        ],
      },
      {
        id: "translate-for-employers",
        title: "5. Translate portfolio work into hiring language",
        paragraphs: [
          "A portfolio should help someone imagine you on their team. That means turning technical details into business language. Instead of saying you used embeddings, explain that you improved retrieval quality for a knowledge workflow. Instead of saying you chained prompts, explain that you reduced manual review time or improved consistency.",
          "This translation layer is what makes AI portfolio pages useful in interviews and outreach. Each project should have a short employer-facing summary that answers the question: why should another company care that you built this?",
        ],
        bullets: [
          "Describe the workflow in plain language first.",
          "Connect the work to speed, quality, reliability, or scale.",
          "Summarize the value in two or three sentences that can also work on LinkedIn.",
        ],
      },
      {
        id: "portfolio-checklist",
        title: "6. Publish with a simple portfolio checklist",
        paragraphs: [
          "Before a portfolio page goes live, run a quick quality check. Make sure the page can stand on its own, even for someone who has never met you. It should explain the project clearly, link to proof, and show enough detail to feel real without overwhelming the reader.",
          "Over time, your portfolio should become a system. Each new project should plug into the same structure, link to related work, and reinforce your positioning. That compounding effect is what turns scattered projects into a real AI brand.",
        ],
        bullets: [
          "Unique title and meta description",
          "One H1 and clear section headings",
          "At least one artifact or build-log signal",
          "Internal links to related projects or guides",
          "A clear CTA to contact, connect, or view more work",
        ],
      },
    ],
    faq: [
      {
        question: "What should an AI portfolio include?",
        answer:
          "At minimum, include the problem, workflow, tools, outputs, artifacts, and outcome for each project. A useful portfolio also includes build logs, iteration notes, and links to related proof.",
      },
      {
        question: "How many projects should be in an AI portfolio?",
        answer:
          "Three strong projects are usually enough to make a portfolio credible. Depth matters more than volume. Each project should show a different workflow or problem type.",
      },
      {
        question: "Do screenshots count as AI portfolio proof?",
        answer:
          "Screenshots help, but they are stronger when paired with context, links, build notes, metrics, or other artifacts that show how the workflow was built and used.",
      },
      {
        question: "Can non-engineers build a strong AI portfolio?",
        answer:
          "Yes. Strong AI portfolios exist in marketing, operations, product, support, design, and sales. The key is showing useful systems, not pretending every project needs to be a full software product.",
      },
    ],
    relatedSlugs: ["ai-upskilling-roadmap", "prove-ai-skills-to-employers"],
  },
  {
    slug: "prove-ai-skills-to-employers",
    category: "Career Proof",
    title: "How to Prove AI Skills to Employers Without a Computer Science Degree",
    description:
      "A practical guide to showing AI skills through projects, artifacts, workflow evidence, and employer-friendly narratives instead of generic certifications.",
    heroSummary:
      "Most employers do not need a perfect theory explanation of AI. They need confidence that you can use AI tools to improve work quality and ship reliable outputs. The best proof is visible, specific, and tied to real workflows.",
    readingTime: "8 min read",
    publishedAt: "2026-03-06",
    updatedAt: "2026-03-06",
    takeaways: [
      "Proof beats claims, especially for AI-adjacent roles.",
      "Projects, artifacts, and build logs matter more than generic course completion.",
      "Translate your work into business outcomes, not just tool names.",
      "Prepare portfolio, resume, LinkedIn, and interview narratives from the same proof base.",
    ],
    keywords: [
      "prove AI skills",
      "show AI skills to employers",
      "AI skills for non technical professionals",
      "AI portfolio proof",
      "AI interview examples",
    ],
    sections: [
      {
        id: "what-employers-trust",
        title: "1. Employers trust evidence they can inspect",
        paragraphs: [
          "Certificates and courses can help, but they rarely create strong differentiation on their own. Employers are trying to answer a different question: can this person use AI to improve the quality, speed, or reliability of work in a real environment?",
          "That is why inspectable proof matters. A portfolio page, workflow summary, shipped artifact, demo, or public build log gives people something concrete to evaluate. It reduces ambiguity and makes your skill easier to trust.",
        ],
        bullets: [
          "Projects with clear use cases",
          "Visible artifacts or outputs",
          "Documented workflows and iteration notes",
          "Role-specific explanations of impact",
        ],
      },
      {
        id: "best-proof-signals",
        title: "2. Use proof signals that match the role",
        paragraphs: [
          "Different employers care about different signals. A support team may care about triage quality, response consistency, or escalation logic. A marketing team may care about research systems, briefs, publishing velocity, and content quality. A product team may care about insight synthesis, specification generation, or prototype workflows.",
          "The strongest proof is role-shaped. Instead of saying you are good at AI, show how you used AI in the exact kind of work the employer already understands.",
        ],
        bullets: [
          "Operations: automations, QA flows, reporting systems",
          "Marketing: content engines, research workflows, personalization",
          "Product: insight summaries, PRD generation, prototype systems",
          "Sales and success: enrichment, support drafting, follow-up workflows",
        ],
      },
      {
        id: "make-proof-portable",
        title: "3. Turn one project into multiple proof assets",
        paragraphs: [
          "A single strong AI project should feed multiple surfaces. The full story belongs on a portfolio page. A compressed version belongs on LinkedIn. A results-oriented bullet belongs on your resume. Two or three short talking points belong in your interview prep.",
          "This is the easiest way to create consistency. When your resume, LinkedIn, portfolio, and interview answers all reinforce the same project proof, your skill story becomes much more believable.",
        ],
        bullets: [
          "Portfolio page: full workflow, artifacts, metrics, and lessons learned",
          "LinkedIn: one short before-and-after story plus link to proof",
          "Resume: one quantified bullet tied to the workflow outcome",
          "Interview: one narrative about what you built, tested, and improved",
        ],
      },
      {
        id: "talk-about-ai-work",
        title: "4. Describe AI work in business language",
        paragraphs: [
          "A lot of candidates lose credibility by overloading their descriptions with tool names. Tools matter, but they are not the whole story. A hiring manager cares more about what the workflow achieved than whether you used five model providers.",
          "Lead with the problem and result. Then mention the system design. Then mention the tools. That order keeps your story grounded in impact instead of hype.",
        ],
        bullets: [
          "Start with the workflow problem.",
          "Explain the output or decision the workflow improved.",
          "Mention the tools only after the context is clear.",
        ],
      },
      {
        id: "prepare-for-interviews",
        title: "5. Prepare employer-facing examples before interviews",
        paragraphs: [
          "If you want to prove AI skill in an interview, prepare two or three detailed examples before the conversation starts. Each example should cover the problem, your workflow, the tools involved, what broke, how you improved it, and what result came out of the final version.",
          "Interviewers often use follow-up questions to test whether you actually built the system. Build logs, artifacts, and reflective notes make those follow-ups much easier to answer confidently.",
        ],
        bullets: [
          "Prepare one example about speed or efficiency.",
          "Prepare one example about quality or decision support.",
          "Prepare one example about iteration, failure, and improvement.",
        ],
      },
      {
        id: "skip-the-weak-signals",
        title: "6. Stop relying on weak signals alone",
        paragraphs: [
          "Listing ChatGPT on a resume is not strong proof. Neither is a vague claim like \"familiar with AI tools.\" Those signals are too common and too hard to verify. The market is moving toward proof of execution.",
          "You do not need a computer science degree to compete here. You need a documented pattern of useful work. If your portfolio shows practical workflows and your narratives explain them well, you can stand out in many AI-adjacent roles.",
        ],
        bullets: [
          "Avoid generic claims without examples.",
          "Avoid portfolios with no artifacts or no context.",
          "Avoid presenting AI as novelty instead of workflow improvement.",
        ],
      },
    ],
    faq: [
      {
        question: "Can I prove AI skills without being an engineer?",
        answer:
          "Yes. Employers often care more about useful workflow improvement than deep model engineering. If you can show how you used AI to improve real work, you can create strong proof in many non-technical roles.",
      },
      {
        question: "Are AI certifications enough to get hired?",
        answer:
          "Usually not on their own. Certifications can support your story, but projects, artifacts, portfolio pages, and employer-friendly examples are stronger proof of execution.",
      },
      {
        question: "What is the best evidence of AI skill?",
        answer:
          "The best evidence is a documented project with a clear problem statement, visible workflow, artifacts or outputs, and a short explanation of the result and what changed after iteration.",
      },
      {
        question: "How should I talk about AI skills on my resume?",
        answer:
          "Use specific bullets tied to business outcomes. Mention the workflow, the output, and the result. Avoid generic phrases like \"experienced with AI tools\" without concrete examples.",
      },
    ],
    relatedSlugs: ["ai-upskilling-roadmap", "how-to-build-an-ai-portfolio"],
  },
  {
    slug: "ai-skills-for-product-managers",
    category: "Role Guide",
    title: "AI Skills for Product Managers Who Want Real Career Leverage",
    description:
      "The most useful AI skills for product managers, which workflows to learn first, what projects to build, and how to show the work to employers.",
    heroSummary:
      "Product managers do not need to become full-time ML engineers to benefit from AI. They need a working system for research synthesis, specification drafting, prioritization support, and visible proof that they can turn AI into better product execution.",
    readingTime: "8 min read",
    publishedAt: "2026-03-06",
    updatedAt: "2026-03-06",
    takeaways: [
      "The highest-value PM AI skills are synthesis, evaluation, and workflow design.",
      "Strong PM projects create better briefs, specs, feedback analysis, or decision support.",
      "Employers care more about shipped workflows than generic AI fluency claims.",
      "Your portfolio should show problem framing, judgment, and iteration.",
    ],
    keywords: [
      "AI skills for product managers",
      "AI for product managers",
      "product manager AI upskilling",
      "AI projects for product managers",
      "product management AI portfolio",
    ],
    sections: [
      {
        id: "where-ai-helps-pms",
        title: "1. Where AI helps product managers most",
        paragraphs: [
          "The best use of AI in product management is not replacing product judgment. It is reducing the manual work around synthesis, draft creation, and repetitive decision support. That includes turning research notes into themes, turning themes into spec drafts, and turning roadmap discussions into cleaner communication.",
          "This matters because PM work already sits at the intersection of ambiguity and coordination. A product manager who can structure AI workflows well can move faster without losing clarity. That skill becomes especially valuable when the team is overloaded or when cross-functional context is spread across many documents and conversations.",
        ],
        bullets: [
          "Research and feedback clustering",
          "PRD and brief generation",
          "Roadmap and prioritization support",
          "Release communication and stakeholder summaries",
        ],
      },
      {
        id: "top-workflows",
        title: "2. The workflows product managers should learn first",
        paragraphs: [
          "Start with workflows that compress messy inputs into cleaner decisions. A feedback synthesis flow that groups call notes, support tickets, or survey responses into recurring themes is more useful than a generic chatbot. A spec-drafting assistant that turns product context into a first-pass PRD is also high leverage because it saves time without removing human review.",
          "Another strong workflow is decision summarization. Product managers spend a lot of time translating one meeting into next steps for executives, design, and engineering. AI helps when it turns raw notes into a structured summary that is easier to verify and send.",
        ],
        bullets: [
          "Interview notes to insight themes",
          "Theme summary to PRD draft",
          "Roadmap notes to stakeholder update",
          "Launch inputs to release notes draft",
        ],
      },
      {
        id: "starter-stack",
        title: "3. A practical starter stack for PMs",
        paragraphs: [
          "Most PMs should start with one primary model, one document system, and one build surface. The build surface can be a lightweight coding environment like Cursor or a no-code workflow tool if the goal is process automation rather than product engineering. What matters is building repeatable flows, not assembling a complicated stack.",
          "The stack should be simple enough that you can ship a first workflow in one or two weeks. If the system is too complex, you end up learning tooling instead of learning the PM-specific AI skills that create immediate leverage.",
        ],
        bullets: [
          "Primary AI assistant for synthesis and drafting",
          "Knowledge source such as Notion, Drive, or docs",
          "One build tool such as Cursor, Zapier, Make, or a scriptable environment",
        ],
      },
      {
        id: "best-projects",
        title: "4. Three strong AI portfolio projects for product managers",
        paragraphs: [
          "The first strong PM project is a voice-of-customer synthesizer. Feed in interview notes, support tickets, or survey responses and produce a ranked summary of themes, edge cases, and possible next actions. This demonstrates synthesis and evaluation, which are central to strong PM work.",
          "The second is a PRD copilot that turns context into a first-pass spec with clear assumptions, open questions, and success criteria. The third is a stakeholder update generator that converts meeting notes or launch data into tailored summaries for leadership and cross-functional teams. Together, those projects show product thinking, not just tool usage.",
        ],
        bullets: [
          "Voice-of-customer synthesis workflow",
          "PRD or experiment brief generator",
          "Stakeholder update or release communication assistant",
        ],
      },
      {
        id: "prove-the-work",
        title: "5. How PMs should prove AI skill to employers",
        paragraphs: [
          "Product employers want evidence that you can make ambiguity easier to manage. That means your proof should show the messy input, the structured output, and the judgment layer you added on top. Screenshots alone are not enough. Show the workflow logic, the evaluation criteria, and what changed after you improved the first version.",
          "Your portfolio entry should explain the problem, the source materials, the workflow steps, the output format, and the decision quality improvements. That turns the project into a believable signal of PM leverage instead of a novelty demo.",
        ],
        bullets: [
          "Include the problem and audience for the workflow.",
          "Show example outputs and iteration notes.",
          "Explain how the workflow improved clarity, speed, or decision quality.",
        ],
      },
    ],
    faq: [
      {
        question: "Do product managers need to learn to code to use AI well?",
        answer:
          "No. Coding helps, but the core PM advantage comes from structuring information, defining evaluation criteria, and building repeatable workflows around research, planning, and communication.",
      },
      {
        question: "What is the best first AI project for a product manager?",
        answer:
          "A voice-of-customer or feedback synthesis workflow is usually the best first project because it solves a real PM pain point and creates visible proof of product judgment.",
      },
      {
        question: "How should product managers show AI work on a portfolio?",
        answer:
          "Show the workflow input, the output, the review logic, and what improved after iteration. Product employers want to see how the system supported clearer decisions.",
      },
      {
        question: "Which AI skills matter most for PM hiring?",
        answer:
          "Research synthesis, workflow design, evaluation, structured drafting, and communication support are usually more valuable than generic prompt tricks.",
      },
    ],
    relatedSlugs: ["ai-upskilling-roadmap", "prompt-engineering-for-workflows"],
  },
  {
    slug: "ai-skills-for-marketers",
    category: "Role Guide",
    title: "AI Skills for Marketers: What to Learn, Build, and Publish",
    description:
      "A practical guide to the AI skills marketers should learn first, the workflows that matter most, and the projects that create portfolio proof.",
    heroSummary:
      "Marketers do not need more generic AI tips. They need repeatable systems for research, briefing, repurposing, and campaign execution that produce measurable output and clear proof of skill.",
    readingTime: "8 min read",
    publishedAt: "2026-03-06",
    updatedAt: "2026-03-06",
    takeaways: [
      "The best marketing AI skills combine strategy, workflow design, and quality control.",
      "The strongest projects improve research, briefs, personalization, or repurposing.",
      "Employers trust proof when it includes artifacts, process notes, and measurable output.",
      "A marketer’s AI portfolio should feel operational, not experimental.",
    ],
    keywords: [
      "AI skills for marketers",
      "AI for marketers",
      "marketing AI upskilling",
      "AI projects for marketers",
      "AI marketing portfolio",
    ],
    sections: [
      {
        id: "where-ai-helps-marketing",
        title: "1. Where AI creates the most leverage in marketing",
        paragraphs: [
          "Marketing teams win with AI when they use it to improve throughput without losing positioning, quality, or consistency. The highest-value use cases are usually research summarization, content briefing, asset repurposing, campaign analysis, and personalization support.",
          "These are good starting points because they already exist inside most marketing workflows. You are not inventing a new job. You are making existing work more scalable and more structured.",
        ],
        bullets: [
          "Research and competitor synthesis",
          "Content and campaign brief generation",
          "Cross-channel content repurposing",
          "Audience messaging variation and testing support",
        ],
      },
      {
        id: "top-marketing-workflows",
        title: "2. The marketing workflows worth learning first",
        paragraphs: [
          "The best first marketing workflow is usually a research-to-brief system. It takes notes, source documents, or transcripts and turns them into a campaign brief with positioning angles, target audience insights, and suggested content directions. That project teaches summarization, prompt structure, and editorial control all at once.",
          "A second strong workflow is repurposing. Turn one webinar, case study, or founder memo into LinkedIn posts, email angles, landing page copy ideas, and ad concepts. The challenge is not generating more text. The challenge is keeping the system aligned with brand voice and audience intent.",
        ],
        bullets: [
          "Research notes to campaign brief",
          "Long-form asset to multi-channel content set",
          "Customer quotes to messaging themes",
          "Performance notes to testing ideas",
        ],
      },
      {
        id: "starter-stack",
        title: "3. A simple starter stack for marketers",
        paragraphs: [
          "Marketers usually do best with one model for drafting and synthesis, one source-of-truth content system, and one automation or spreadsheet layer to organize inputs and outputs. The best stack is the one that helps you move from source material to approved deliverable quickly.",
          "You do not need a giant martech rebuild to start. If the system helps you produce better briefs, stronger draft sets, or more consistent repurposing, it is already valuable.",
        ],
        bullets: [
          "Primary AI assistant for summarization and drafting",
          "Content source system like Notion, docs, or transcripts",
          "Workflow layer such as Zapier, Make, Airtable, or light scripting",
        ],
      },
      {
        id: "best-projects",
        title: "4. Three AI portfolio projects marketers can ship quickly",
        paragraphs: [
          "One strong project is a content brief generator that turns research inputs into a campaign-ready brief with angle recommendations and CTA ideas. Another is a repurposing engine that takes a single asset and outputs a structured multi-channel package. A third is a messaging QA workflow that checks outputs for voice, positioning, banned claims, and audience fit.",
          "These projects work because they are easy to explain and easy to inspect. A recruiter or hiring manager immediately understands why each one is useful.",
        ],
        bullets: [
          "Content brief generator",
          "Cross-channel repurposing engine",
          "Brand and messaging QA assistant",
        ],
      },
      {
        id: "portfolio-proof",
        title: "5. How marketers should package proof",
        paragraphs: [
          "Marketing AI proof should include the source material, the workflow logic, the output, and the review standard. If you only show the final copy, the work looks generic. If you show how the system transformed raw inputs into useful deliverables, the project becomes credible.",
          "Strong marketing portfolio pages also mention output volume, speed, quality improvements, or consistency gains. Even simple metrics help if they are believable and tied to the workflow.",
        ],
        bullets: [
          "Show before-and-after examples when possible.",
          "Include one artifact from the system, not just a summary.",
          "Explain what the reviewer still had to do and what the system automated.",
        ],
      },
    ],
    faq: [
      {
        question: "What AI skills matter most for marketers?",
        answer:
          "Research synthesis, content briefing, repurposing, quality control, and brand-consistent workflow design are some of the highest-value marketing AI skills.",
      },
      {
        question: "What should marketers build first for an AI portfolio?",
        answer:
          "A research-to-brief workflow or a cross-channel repurposing system is usually the best starting point because it is easy to inspect and clearly useful.",
      },
      {
        question: "How do marketers avoid generic AI output?",
        answer:
          "They use tighter source material, clearer rubrics, better review loops, and workflow designs that encode brand voice and audience context instead of asking for generic drafts.",
      },
      {
        question: "How can a marketer prove AI skill to employers?",
        answer:
          "Use project pages with the workflow input, output examples, QA process, and outcome. Employers want evidence that you can produce better marketing systems, not just more copy.",
      },
    ],
    relatedSlugs: ["how-to-build-an-ai-portfolio", "ai-project-ideas-for-your-portfolio"],
  },
  {
    slug: "ai-skills-for-operations-managers",
    category: "Role Guide",
    title: "AI Skills for Operations Managers: Workflows That Actually Matter",
    description:
      "The most useful AI skills for operations managers, which automations to learn first, and how to turn process improvement into public proof.",
    heroSummary:
      "Operations teams get the most value from AI when they turn messy recurring work into reliable systems. That means better handoffs, faster reporting, cleaner SOPs, and less manual triage.",
    readingTime: "8 min read",
    publishedAt: "2026-03-06",
    updatedAt: "2026-03-06",
    takeaways: [
      "Operations AI skill is mostly about repeatability, structure, and QA.",
      "The best first projects reduce manual steps in existing workflows.",
      "Ops portfolios should highlight process reliability, not just novelty.",
      "Good proof includes workflow diagrams, artifacts, and measurable time savings.",
    ],
    keywords: [
      "AI skills for operations managers",
      "AI for operations managers",
      "operations AI workflows",
      "AI projects for operations",
      "ops AI portfolio",
    ],
    sections: [
      {
        id: "ops-opportunities",
        title: "1. Where AI helps operations teams most",
        paragraphs: [
          "Operations work often involves intake, routing, standardization, exception handling, and reporting. Those are all strong places for AI if the system is paired with clear structure and review rules. The opportunity is not to remove process. It is to make process faster and more consistent.",
          "This is why operations teams often get quick wins with AI. They already manage repeatable workflows with many steps and handoffs. AI becomes useful when it reduces the manual formatting, sorting, summarizing, or triage work inside those systems.",
        ],
        bullets: [
          "Ticket or request triage",
          "SOP and runbook drafting",
          "Status updates and summaries",
          "Exception detection and QA support",
        ],
      },
      {
        id: "workflows-to-learn",
        title: "2. Which workflows ops managers should learn first",
        paragraphs: [
          "The most practical first workflow is intake-to-routing. That means taking a request, classifying it, extracting key fields, and sending it to the right destination or owner. Another strong workflow is summary generation for recurring meetings, incidents, or shift handoffs.",
          "A third good workflow is SOP support. AI can turn notes, changes, or process observations into cleaner first-pass documentation, which the ops lead can then review and publish.",
        ],
        bullets: [
          "Request intake to classification and routing",
          "Meeting, incident, or handoff summaries",
          "SOP draft generation and maintenance support",
          "Reporting support from recurring source data",
        ],
      },
      {
        id: "starter-stack",
        title: "3. A starter stack for operations AI",
        paragraphs: [
          "Operations teams usually do well with a model layer, one system of record, and one automation layer. The automation layer can be no-code if the process is straightforward. The important part is defining the trigger, the transformation, the QA step, and the destination.",
          "Ops leaders should resist overbuilding at the start. A small reliable workflow that runs cleanly is more valuable than a complicated system no one trusts.",
        ],
        bullets: [
          "Model for extraction, summarization, or drafting",
          "Source system such as forms, spreadsheets, ticketing tools, or docs",
          "Automation layer such as Zapier, Make, scripts, or internal tooling",
        ],
      },
      {
        id: "project-ideas",
        title: "4. Three strong AI projects for operations portfolios",
        paragraphs: [
          "One useful project is an intake classifier that reads requests and routes them based on category, urgency, or department. Another is an ops summary assistant that turns handoff notes or meeting logs into a structured update with owners and next steps. A third is an SOP update helper that turns process changes into documentation drafts.",
          "These projects are strong because they are legible to hiring managers. They clearly connect AI to operational efficiency and process quality.",
        ],
        bullets: [
          "Request triage and routing workflow",
          "Ops summary and handoff assistant",
          "SOP draft and update generator",
        ],
      },
      {
        id: "show-proof",
        title: "5. How operations managers should show AI skill",
        paragraphs: [
          "Ops proof should show the original bottleneck, the steps in the workflow, the failure points you considered, and the quality controls you added. Operations leaders are often judged on reliability, so that reliability story needs to show up in the portfolio page.",
          "Show the trigger, the decision step, the output, the exception path, and the business value. If you saved time, reduced misroutes, improved handoff quality, or created more consistent documentation, say so directly.",
        ],
        bullets: [
          "Show the process map or workflow stages.",
          "Document one QA rule or exception path.",
          "Explain how the system affected speed, accuracy, or consistency.",
        ],
      },
    ],
    faq: [
      {
        question: "What AI skills matter most in operations roles?",
        answer:
          "Workflow design, structured extraction, triage logic, summarization, QA thinking, and automation discipline are usually the most valuable AI skills for operations managers.",
      },
      {
        question: "What is the best first AI ops project?",
        answer:
          "A request intake and routing workflow is a strong first project because it has clear inputs, clear decisions, and a visible operational outcome.",
      },
      {
        question: "Do operations AI projects need to be technical?",
        answer:
          "Not always. Many effective ops AI projects use no-code tools or lightweight scripts. The main value is process design and reliability, not technical complexity for its own sake.",
      },
      {
        question: "How should ops managers present AI proof to employers?",
        answer:
          "Show the workflow stages, the review logic, the exception handling, and the measurable operational improvement. Reliability is a major trust signal in ops hiring.",
      },
    ],
    relatedSlugs: ["workflow-automation-with-ai", "prove-ai-skills-to-employers"],
  },
  {
    slug: "prompt-engineering-for-workflows",
    category: "Skill Guide",
    title: "Prompt Engineering for Workflows, Not Just One-Off Outputs",
    description:
      "A practical guide to prompt engineering when the goal is reliable workflows, better outputs, and proof-based AI projects instead of isolated prompt tricks.",
    heroSummary:
      "Prompt engineering is most useful when it helps a workflow become more repeatable, more testable, and easier to improve. The goal is not writing clever prompts. The goal is designing prompts that make systems work better.",
    readingTime: "7 min read",
    publishedAt: "2026-03-06",
    updatedAt: "2026-03-06",
    takeaways: [
      "Good prompts are part of a system, not a magic trick.",
      "Context, task definition, rubric, and output format matter more than style flourishes.",
      "Reliable prompt work requires testing and iteration.",
      "Prompt assets become stronger when documented and paired with examples.",
    ],
    keywords: [
      "prompt engineering for workflows",
      "prompt engineering",
      "AI prompt engineering skills",
      "workflow prompt design",
      "prompt engineering projects",
    ],
    sections: [
      {
        id: "what-it-really-is",
        title: "1. What prompt engineering actually means in workflow design",
        paragraphs: [
          "Prompt engineering is often presented like a collection of hacks. In practice, the useful version is much simpler and more disciplined. It means defining the task clearly, providing the right context, specifying the output format, and giving the model a standard it can work against.",
          "Inside a workflow, prompts are not isolated. They interact with source material, formatting rules, downstream steps, and review logic. That is why good prompt engineering is closer to system design than creative writing.",
        ],
        bullets: [
          "Define the job clearly.",
          "Provide enough context to complete it well.",
          "Constrain the format when consistency matters.",
          "Add a review or verification step when quality matters.",
        ],
      },
      {
        id: "prompt-structure",
        title: "2. The four-part structure that improves most prompts",
        paragraphs: [
          "Most workflow prompts improve when they include four ingredients: objective, context, constraints, and output shape. The objective explains what the system should do. The context provides the information it should use. The constraints define what must or must not happen. The output shape makes the response easier to review and reuse.",
          "This structure is especially helpful when a prompt is reused across many inputs. It makes the system easier to debug because you can see which part is missing when the output drifts.",
        ],
        bullets: [
          "Objective: what the prompt must accomplish",
          "Context: what information the model should consider",
          "Constraints: what the response must avoid or preserve",
          "Output shape: how the answer should be formatted",
        ],
      },
      {
        id: "testing-prompts",
        title: "3. How to test prompts like workflow components",
        paragraphs: [
          "A prompt is only good if it performs across multiple realistic inputs. That means testing it with edge cases, incomplete inputs, noisy data, and examples that are likely to confuse the model. If the prompt only works once, it is not workflow-ready.",
          "Testing prompt behavior is also what turns a simple experiment into a portfolio-worthy skill. The moment you show how you compared versions, tightened criteria, and improved consistency, your work becomes much more credible.",
        ],
        bullets: [
          "Test against multiple realistic input types.",
          "Save examples of weak and strong outputs.",
          "Document what changed between prompt versions.",
        ],
      },
      {
        id: "projects-to-build",
        title: "4. Prompt engineering projects that create strong proof",
        paragraphs: [
          "A good prompt engineering project is one where output quality matters and can be inspected. That includes brief generation, QA rubrics, research synthesis, ticket triage, or content transformation. The best projects make it obvious why a better prompt leads to a better workflow.",
          "Document the prompt, the use case, the examples tested, and the improvement you made after iteration. That is much more persuasive than posting a screenshot of one impressive answer.",
        ],
        bullets: [
          "Research synthesis prompt set",
          "Content brief generator with rubric checks",
          "Triage classifier with structured output",
          "Quality-review prompt with pass/fail criteria",
        ],
      },
      {
        id: "common-mistakes",
        title: "5. Common mistakes in prompt engineering",
        paragraphs: [
          "The biggest mistake is writing prompts that are too vague and then blaming the model when outputs drift. Another is overfitting to a single example without testing different inputs. A third is focusing on tone tricks while ignoring evaluation and output structure.",
          "Strong prompt engineering is less about sounding clever and more about making the system legible. If another person cannot understand why the prompt works, it will be harder to maintain and harder to trust.",
        ],
        bullets: [
          "Do not skip output formatting rules.",
          "Do not rely on one golden example.",
          "Do not treat prompt quality as separate from workflow quality.",
        ],
      },
    ],
    faq: [
      {
        question: "Is prompt engineering still a useful skill?",
        answer:
          "Yes, especially when it is applied to workflows that need repeatable structure, better evaluation, and clearer outputs. It is most valuable as part of a system, not as a one-off trick.",
      },
      {
        question: "How do I prove prompt engineering skill to employers?",
        answer:
          "Show the workflow, the prompt versions, the test examples, and the improvements in output quality or reliability after iteration.",
      },
      {
        question: "What makes a prompt good for a workflow?",
        answer:
          "A good workflow prompt has a clear objective, enough context, explicit constraints, and a defined output format that makes the next step easier.",
      },
      {
        question: "What projects best demonstrate prompt engineering?",
        answer:
          "Projects with inspectable outputs and clear quality standards, such as synthesis systems, brief generators, classifiers, and QA assistants, usually make the skill easiest to prove.",
      },
    ],
    relatedSlugs: ["workflow-automation-with-ai", "ai-upskilling-roadmap"],
  },
  {
    slug: "workflow-automation-with-ai",
    category: "Skill Guide",
    title: "Workflow Automation With AI: Where to Start and What to Build",
    description:
      "How to use AI inside real workflows, choose the right first automations, and package the results into credible portfolio proof.",
    heroSummary:
      "Workflow automation with AI works best when you start with one repeatable process, one useful transformation, and one quality check. The fastest wins are usually not giant agents. They are simple systems that save time and improve consistency.",
    readingTime: "8 min read",
    publishedAt: "2026-03-06",
    updatedAt: "2026-03-06",
    takeaways: [
      "The best first AI automations sit inside existing workflows.",
      "Every automation needs a trigger, transformation, output, and review standard.",
      "Simple reliable systems beat complicated brittle ones.",
      "The strongest proof shows the before state, the workflow, and the result.",
    ],
    keywords: [
      "workflow automation with AI",
      "AI workflow automation",
      "AI automation skills",
      "AI workflow projects",
      "automation portfolio projects",
    ],
    sections: [
      {
        id: "what-good-automation-looks-like",
        title: "1. What good AI workflow automation looks like",
        paragraphs: [
          "A useful AI automation starts with a repeatable task that already has a clear input and a useful output. The AI piece should do one specific job in the middle of the process: classify, summarize, extract, draft, transform, or evaluate.",
          "This matters because AI automations fail when the job is too vague. If the system is supposed to \"handle everything,\" it usually becomes hard to trust. If it handles one defined transformation well, it becomes much easier to adopt and improve.",
        ],
        bullets: [
          "Trigger: what starts the process",
          "Transformation: what AI does",
          "Destination: where the output goes",
          "Review: how the result is checked",
        ],
      },
      {
        id: "best-first-automations",
        title: "2. The best first AI automations to build",
        paragraphs: [
          "The best first automations usually involve summarization, classification, or structured drafting. These tasks are common across teams and produce outputs that are easy to inspect. Support triage, meeting summaries, brief generation, lead enrichment notes, and request routing are all good starting points.",
          "These projects are also strong for portfolios because they are legible. A hiring manager can understand the problem quickly and see how the automation improved the workflow.",
        ],
        bullets: [
          "Meeting notes to structured summary",
          "Request or ticket intake to routing",
          "Source material to brief or draft",
          "Research input to categorized insight set",
        ],
      },
      {
        id: "tooling-and-architecture",
        title: "3. Pick simple tooling before complex orchestration",
        paragraphs: [
          "Most people should start with one model provider, one workflow layer, and one destination system. That can be a script, Zapier, Make, or another lightweight tool. You do not need agent orchestration to get real value from AI automation.",
          "Simple architecture is helpful because it makes debugging easier. If the automation fails, you can quickly inspect the input, prompt, output, and destination instead of searching across many moving parts.",
        ],
        bullets: [
          "Keep the number of tools low at the start.",
          "Log the input and output when possible.",
          "Add a manual review step before full trust.",
        ],
      },
      {
        id: "how-to-measure",
        title: "4. Measure automation quality, not just activity",
        paragraphs: [
          "Many AI automations look exciting in demos and fail in production because no one defined success. Measurement should include accuracy, usability, speed, consistency, and the amount of human cleanup still required. A workflow that produces more output but increases review burden may not be a real improvement.",
          "This is another reason automation projects are good portfolio material. When you explain how you measured the system, your work sounds more mature and more useful.",
        ],
        bullets: [
          "Time saved",
          "Output quality or correctness",
          "Reduction in manual formatting",
          "Consistency across repeated runs",
        ],
      },
      {
        id: "portfolio-proof",
        title: "5. Turn the automation into employer-facing proof",
        paragraphs: [
          "To make an automation project valuable for hiring, document the pre-automation workflow, the new system, the artifacts, and the result. Include one screenshot, one output sample, and one note about what you changed after testing. That makes the project feel real instead of abstract.",
          "A strong automation portfolio page should let another person understand the business problem in under thirty seconds. Clarity is a trust multiplier.",
        ],
        bullets: [
          "Document the before state.",
          "Show the workflow steps clearly.",
          "Publish one real output or artifact.",
          "State the improvement in plain language.",
        ],
      },
    ],
    faq: [
      {
        question: "What is the best first AI automation project?",
        answer:
          "A workflow with clear inputs and outputs, such as summarization, classification, routing, or draft generation, is usually the best place to start.",
      },
      {
        question: "Do I need to build an agent to automate work with AI?",
        answer:
          "No. Most valuable first projects are simpler than that. A single transformation step inside a clear workflow often creates more reliable value than a large autonomous system.",
      },
      {
        question: "How should I measure an AI automation?",
        answer:
          "Measure output quality, time saved, review burden, and consistency. Activity alone is not enough to show the workflow is actually better.",
      },
      {
        question: "How can I show AI automation skill in a portfolio?",
        answer:
          "Show the original process, the automated process, the tool stack, example outputs, and the measurable change after the workflow shipped.",
      },
    ],
    relatedSlugs: ["prompt-engineering-for-workflows", "ai-project-ideas-for-your-portfolio"],
  },
  {
    slug: "ai-project-ideas-for-your-portfolio",
    category: "Project Ideas",
    title: "AI Project Ideas for Your Portfolio That Actually Prove Skill",
    description:
      "A practical list of AI project ideas that create credible portfolio proof for professionals in product, marketing, operations, support, sales, and more.",
    heroSummary:
      "A good AI portfolio project is small enough to finish, useful enough to matter, and visible enough to prove skill. The goal is not building the flashiest demo. The goal is building something another person can inspect and immediately understand.",
    readingTime: "9 min read",
    publishedAt: "2026-03-06",
    updatedAt: "2026-03-06",
    takeaways: [
      "Pick projects that solve a real workflow problem.",
      "Prioritize inspectable outputs over abstract demos.",
      "Package each project with artifacts, build notes, and results.",
      "Choose projects that match the type of role you want next.",
    ],
    keywords: [
      "AI project ideas for portfolio",
      "AI portfolio projects",
      "AI project ideas",
      "AI projects for beginners",
      "proof based AI portfolio",
    ],
    sections: [
      {
        id: "what-makes-a-good-project",
        title: "1. What makes an AI project good for a portfolio",
        paragraphs: [
          "Portfolio projects should make your skill easy to evaluate. That usually means a clear problem, a repeatable workflow, and a visible output. The strongest projects also include some kind of judgment, such as evaluation criteria, QA logic, or a documented iteration process.",
          "This is why many flashy AI demos are weak portfolio pieces. They may look novel, but they do not tell an employer whether you can improve real work. A smaller, more practical project usually does a better job.",
        ],
        bullets: [
          "Clear business or workflow problem",
          "Visible artifact or output",
          "Repeatable process",
          "Short explanation of iteration and result",
        ],
      },
      {
        id: "best-project-types",
        title: "2. Project types that create believable proof",
        paragraphs: [
          "The best project categories for most professionals are research synthesis, brief generation, support copilots, routing and triage, content repurposing, reporting support, enrichment, and internal knowledge workflows. These all connect AI to existing work patterns.",
          "Each category can be adapted to your role. A marketer can build a brief generator. A PM can build a research synthesizer. An ops lead can build a routing workflow. A support leader can build a ticket summary assistant.",
        ],
        bullets: [
          "Research synthesis systems",
          "Brief and draft generators",
          "Triage and routing assistants",
          "Knowledge retrieval or summary workflows",
          "Repurposing and transformation systems",
        ],
      },
      {
        id: "twelve-ideas",
        title: "3. Twelve portfolio-ready AI project ideas",
        paragraphs: [
          "Use these as starting points, not strict templates. The strongest version of each project will be tied to the work you already do or the role you want next.",
        ],
        bullets: [
          "Customer interview notes to insight themes",
          "Support ticket summary and escalation assistant",
          "Campaign brief generator from raw research",
          "Cross-channel content repurposing workflow",
          "Lead qualification note generator",
          "Meeting notes to action-item summary system",
          "Request intake and routing workflow",
          "SOP draft and update assistant",
          "PRD draft generator from product context",
          "Release-note summary builder",
          "Knowledge-base answer draft assistant",
          "Quality-review workflow for AI-generated outputs",
        ],
      },
      {
        id: "how-to-choose-one",
        title: "4. How to choose the right project for your role",
        paragraphs: [
          "Choose the project that sits closest to your target role. If you want product roles, build around research synthesis, specs, or communication. If you want marketing roles, build around briefs, repurposing, or messaging systems. If you want operations roles, build around routing, SOPs, or reporting flows.",
          "Another useful filter is inspectability. Ask whether you will be able to show the input, the output, and the logic clearly on a public page. If not, the project may be harder to use as proof even if it is internally useful.",
        ],
        bullets: [
          "Match the project to the role you want.",
          "Prefer workflows with clear inputs and outputs.",
          "Pick something you can actually finish in a few weeks.",
        ],
      },
      {
        id: "publish-the-proof",
        title: "5. How to package each project into proof",
        paragraphs: [
          "Every project should become a portfolio page with the problem, workflow, tools, output examples, and result. Add one or two build-log notes showing what changed after the first version. That is where much of the trust comes from.",
          "If possible, also turn the project into a LinkedIn story or resume bullet. One good project can power several hiring surfaces if the proof is packaged well.",
        ],
        bullets: [
          "Problem statement",
          "Workflow steps",
          "Tools used",
          "Artifacts or output samples",
          "Outcome and iteration note",
        ],
      },
    ],
    faq: [
      {
        question: "What is the best AI project for a first portfolio piece?",
        answer:
          "The best first project is usually a narrow workflow that solves a recurring problem in your current job or target role, such as synthesis, routing, summarization, or structured drafting.",
      },
      {
        question: "How many AI projects should I publish?",
        answer:
          "Three strong projects are usually enough to create a credible portfolio if each project solves a distinct workflow problem and includes visible proof.",
      },
      {
        question: "Should AI portfolio projects be role-specific?",
        answer:
          "Yes. Role-specific projects are easier for employers to evaluate because they immediately understand why the workflow matters.",
      },
      {
        question: "What makes an AI project weak for a portfolio?",
        answer:
          "Projects are usually weak when they are too generic, too large to finish, too hard to inspect, or disconnected from a real workflow problem.",
      },
    ],
    relatedSlugs: ["how-to-build-an-ai-portfolio", "workflow-automation-with-ai"],
  },
];

export function getLearnArticles() {
  return learnArticles;
}

export function getFeaturedLearnArticles(count = 3) {
  return learnArticles.slice(0, count);
}

export function getLearnArticleBySlug(slug: string) {
  return learnArticles.find((article) => article.slug === slug) ?? null;
}
