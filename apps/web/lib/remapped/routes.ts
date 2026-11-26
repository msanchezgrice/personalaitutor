import { getCareerMapTitle, type CareerMapTitle, type RemappedRoute } from "@aitutor/shared";

/**
 * Remapped: the public library of career routes (old job -> AI-era title).
 *
 * One route goes public each Monday. A route whose `publishAt` is in the future
 * is hidden everywhere: the index, the route page (404), the sitemap and the
 * landing page section. Dates are calendar days in UTC; a route becomes public
 * at 00:00 UTC on its date.
 *
 * Editorial rules for every route: no statistics, no salary figures, no hiring
 * demand claims, no named companies or products, and never a promise of a job.
 * Every `toTitleId` must exist in CAREER_MAP_TITLES (tests enforce this).
 */

export const REMAPPED_ROUTES: readonly RemappedRoute[] = [
  {
    slug: "marketing-manager-to-go-to-market-engineer",
    publishAt: "2026-11-23",
    fromTitle: "Marketing Manager",
    fromField: "Marketing",
    toTitleId: "gtm-engineer",
    intro:
      "A lot of what a marketing manager coordinated by hand, from launch checklists to weekly reports, is now run by automated workflows. Someone has to design those workflows and know when they are wrong. A good marketing manager already knows what they should do.",
    translations: [
      {
        before: "Planned launches across channels with briefs, timelines and sign-offs",
        now: "Builds AI launch workflows",
        explanation:
          "A launch plan is a sequence of briefs, assets and approvals with an owner for each. That sequence is what a workflow tool automates, and you already know where it stalls.",
      },
      {
        before: "Kept the brand voice consistent in every channel",
        now: "Writes brand-voice prompts and review rules",
        explanation:
          "You can already tell on-voice from off-voice. A system prompt and a short review checklist are that judgment written down so a model can follow it.",
      },
      {
        before: "Built target lists and audience segments in the CRM",
        now: "Runs enrichment and outreach pipelines",
        explanation:
          "Segmenting is deciding who gets which message. A pipeline now does the research and the first draft per account. You set the rules and check what comes out.",
      },
      {
        before: "Pulled the weekly campaign report from several dashboards",
        now: "Automates reporting and readouts",
        explanation:
          "The hard part of a weekly report was never the copying. It was knowing which number mattered. Automate the copying and keep the judgment.",
      },
    ],
    gaps: [
      {
        gap: "You have not built a workflow that runs without you.",
        closeWith: "Build one in a no-code automation tool and let it run for a week.",
      },
      {
        gap: "You have little practice checking AI output in bulk.",
        closeWith: "Write a small test set of good and bad outputs, with a rule for what passes.",
      },
      {
        gap: "Your best work lives in decks nobody outside your old team can open.",
        closeWith: "Publish one write-up with screenshots of the workflow and what broke.",
      },
    ],
    firstProject: {
      title: "Turn one launch checklist into a working workflow",
      steps: [
        "Pick a launch you know well. Write its checklist as numbered steps, each with an owner.",
        "Mark the steps that are copying, drafting or chasing people. Those are the ones to automate.",
        "In an automation tool, build the trigger and the first three steps, with a model drafting the brief and the announcement copy.",
        "Add a human approval step before anything is sent or published.",
        "Run it twice on a made-up launch and write down every place it failed.",
        "Write a one-page build log: the checklist, the workflow, what broke and what you changed.",
      ],
    },
    watchOuts: [
      "The title is new and used loosely. Some postings mean marketing operations, some mean sales engineering. Read the tasks, not the title.",
      "Much of the job is fixing dull breakages: expired connections, renamed fields, tools that change. If that sounds tiring, try it for a month before you commit.",
      "A workflow you ran on a test launch is a start, not a track record. Do not describe it as if it ran a real one.",
    ],
  },
  {
    slug: "qa-tester-to-model-evaluator",
    publishAt: "2026-11-16",
    fromTitle: "QA Tester",
    fromField: "Game Studio",
    toTitleId: "model-evaluator",
    intro:
      "Automated checks now cover more of a test pass. What they still miss is the strange case. The instinct a good tester has, finding the input that breaks the thing, is exactly what teams building AI need when they test a model.",
    translations: [
      {
        before: "Wrote repro steps a developer could follow the first time",
        now: "Writes evaluation cases",
        explanation:
          "An eval case is a repro step for a model: an input, the expected behavior and a clear way to tell pass from fail.",
      },
      {
        before: "Ran regression passes on every new build",
        now: "Runs model regression suites",
        explanation:
          "A model update can break something that worked yesterday, just like a new build. You already know to re-check the old bugs first.",
      },
      {
        before: "Hunted edge cases: clipping, soft locks, strange input orders",
        now: "Red-teams AI behavior",
        explanation:
          "Pushing a model with odd or hostile prompts is the same habit as jumping at a wall until you fall through it.",
      },
      {
        before: "Triaged bugs by severity in the bug database",
        now: "Classifies model failures",
        explanation:
          "AI teams need failures sorted into kinds and ranked by harm. That is a severity scale, applied to answers instead of crashes.",
      },
    ],
    gaps: [
      {
        gap: "You have not graded model answers against a written rubric.",
        closeWith: "Write a short rubric for one task and grade a batch of answers against it.",
      },
      {
        gap: "You may not have scripted anything outside your test tools.",
        closeWith: "Learn enough scripting to send a batch of prompts and save the answers to a sheet.",
      },
      {
        gap: "Your test plans are under NDA, so nobody outside can see how you think.",
        closeWith: "Build a public eval on a task you choose.",
      },
    ],
    firstProject: {
      title: "Build a small public eval for one AI task",
      steps: [
        "Pick one narrow task, such as summarizing patch notes or answering questions about a board game's rules.",
        "Write thirty test cases: easy ones, edge cases and a few designed to trip the model.",
        "For each case, write what a passing answer must contain and what makes it fail.",
        "Run every case through two models and grade each answer against your rules.",
        "Sort the failures into kinds and rank them by how much harm they would do.",
        "Publish the cases, the grades and a short write-up of what failed and why.",
      ],
    },
    watchOuts: [
      "Some evaluation work is contract rating paid by the task. It is a real way in, but it is not the same as a staff evaluator role. Know which one you are applying for.",
      "Grading is easy to do and hard to do consistently. Expect long debates about what pass means.",
      "Model teams expect some comfort with scripts and data. You do not need to be an engineer, but you cannot avoid it entirely.",
    ],
  },
  {
    slug: "game-designer-to-ai-environment-designer",
    publishAt: "2026-11-09",
    fromTitle: "Game Designer",
    fromField: "Game Studio",
    toTitleId: "ai-environment-designer",
    intro:
      "Game design is the craft of building rules, goals and feedback that hold up when someone tries to break them. AI agents are now trained and tested inside designed environments, and those environments need exactly that craft.",
    translations: [
      {
        before: "Wrote level goals, win states and fail states",
        now: "Defines agent tasks and success criteria",
        explanation:
          "An environment for an agent needs a goal it can reach, a clear end and a way to fail. You have written all three for players.",
      },
      {
        before: "Tuned economies and difficulty curves from playtest data",
        now: "Designs reward and scoring rules",
        explanation:
          "Scoring an agent has the same trap as tuning a reward loop. Reward the wrong thing and you get the wrong behavior, fast.",
      },
      {
        before: "Found and closed exploits players used to skip content",
        now: "Hunts reward hacking",
        explanation:
          "Agents find shortcuts the way speedrunners do. Spotting the exploit before it is used is a skill many engineers lack.",
      },
      {
        before: "Wrote design docs engineers built from",
        now: "Writes environment specs",
        explanation:
          "An environment spec lists the world, the allowed actions, the rules and the scoring. It is a design doc with less room for interpretation.",
      },
    ],
    gaps: [
      {
        gap: "You have not watched a model act inside a task you designed.",
        closeWith: "Run an AI agent through a simple text task and read every move it makes.",
      },
      {
        gap: "Specs for agents must be more precise than specs for people.",
        closeWith: "Rewrite one of your design docs so a script could check every rule.",
      },
      {
        gap: "Your shipped work belongs to your old studio.",
        closeWith: "Make a small public environment that you own and can show.",
      },
    ],
    firstProject: {
      title: "Design a tiny text environment and watch an agent play it",
      steps: [
        "Design a small puzzle with a clear goal, a handful of allowed actions and a scoring rule. A text inventory puzzle works well.",
        "Write the rules as a spec precise enough that a script could check every move.",
        "Give the spec to a model acting as the player and have it attempt the puzzle ten times. Save each run.",
        "Read the runs. Note where it got stuck, where it cheated and where your rules were unclear.",
        "Close one loophole, change the scoring once, and run it ten more times.",
        "Publish the spec, the runs before and after, and what you learned about your own rules.",
      ],
    },
    watchOuts: [
      "This is a young specialty and the title is not standard. Postings may say task designer, eval designer or environment engineer. Read the work described.",
      "Many of these roles sit close to research teams and expect some coding. Plan to learn enough to read and edit simple scripts.",
      "The work rewards precision more than feel. If designing for fun was the part you loved, it may feel dry.",
    ],
  },
  {
    slug: "producer-to-ai-product-manager",
    publishAt: "2026-11-02",
    fromTitle: "Producer",
    fromField: "Game Studio",
    toTitleId: "ai-product-manager",
    intro:
      "Producers keep a game moving through scope, schedule, risk and the people in between. AI features need someone who does that and also decides when a model is good enough to ship, which is most of an AI product manager's job.",
    translations: [
      {
        before: "Ran milestone reviews and cut scope to hit dates",
        now: "Sets ship criteria for AI features",
        explanation:
          "An AI feature is never perfect. Someone has to decide what good enough means and hold the line. You made that call at every milestone.",
      },
      {
        before: "Kept the risk list and escalated before things slipped",
        now: "Manages model risk and failure modes",
        explanation:
          "Models fail in new ways: wrong answers, odd tone, rising costs. A living risk list with owners is still the right tool.",
      },
      {
        before: "Ran playtests and turned feedback into priorities",
        now: "Runs evaluations and user tests",
        explanation:
          "Playtest notes and eval results are the same kind of input. Both tell you what to fix first, if you read them carefully.",
      },
      {
        before: "Coordinated art, design, engineering and outsource vendors",
        now: "Coordinates model, data and product work",
        explanation:
          "AI work adds new handoffs: data, evals, prompt changes, model updates. Keeping them in sync is producer work under new names.",
      },
    ],
    gaps: [
      {
        gap: "You have not written a spec for a feature that runs on a model.",
        closeWith: "Write one for a small feature, including how it will be tested.",
      },
      {
        gap: "You have not defined an evaluation yourself.",
        closeWith: "Build a short test set for that feature and agree the pass rules with someone else.",
      },
      {
        gap: "Product roles ask for user and business judgment, not only delivery.",
        closeWith: "In your spec, say who the feature is for and what would make you stop building it.",
      },
    ],
    firstProject: {
      title: "Spec and test one AI feature for a game you know",
      steps: [
        "Pick one feature, such as a patch-notes summary for players or a help bot inside a game launcher.",
        "Write a one-page spec: who it is for, what it must do, what it must never do, and the ship criteria.",
        "Build a rough version with a general-purpose model and a written prompt. No code is needed.",
        "Write twenty test cases and grade the outputs against your criteria.",
        "Decide ship or no ship, and write down why in one paragraph.",
        "Publish the spec, the test results and the decision as one short post.",
      ],
    },
    watchOuts: [
      "Product manager roles are competitive, and hiring teams often ask for software shipped outside games. Your spec and test results are how you close that distance.",
      "Producing and product management overlap but are not the same job. Expect questions about strategy, users and the business, not only schedules.",
      "Calling yourself an AI product manager before you have shipped an AI feature invites hard interview questions. Be exact about what you built and what you only planned.",
    ],
  },
  {
    slug: "concept-artist-to-ai-art-director",
    publishAt: "2026-10-26",
    fromTitle: "Concept Artist",
    fromField: "Game Studio",
    toTitleId: "ai-art-director",
    intro:
      "Generative tools now turn out early exploration images in bulk, and that has changed what studios ask of concept artists. What those tools cannot do is decide what a game should look like and keep every image on one look. That is art direction, and concept artists are trained for it.",
    translations: [
      {
        before: "Painted exploration sheets to find a game's look",
        now: "Directs generative exploration",
        explanation:
          "Making a hundred options is cheap now. Knowing which three to push, and why, is still the hard part.",
      },
      {
        before: "Built style guides and art bibles for the team",
        now: "Builds style references and prompt systems",
        explanation:
          "A style guide for a model needs reference images, banned traits and plain rules. You have already written the human version.",
      },
      {
        before: "Did paintovers on outsourced and junior work",
        now: "Curates and corrects generated output",
        explanation:
          "Most generated images need fixing before they are usable. Your paintover skill becomes quality control at speed.",
      },
      {
        before: "Gave feedback in art reviews that kept the look consistent",
        now: "Runs visual review for AI-assisted pipelines",
        explanation:
          "Someone has to reject the image that is almost right. Consistent review is what keeps a game from looking generated.",
      },
    ],
    gaps: [
      {
        gap: "You may have avoided generative tools, for good reasons.",
        closeWith: "Learn one image tool well enough to control style, composition and variation, so your critique of it is informed.",
      },
      {
        gap: "Art direction means making decisions in writing, not only in paint.",
        closeWith: "Write a visual direction document that a model and a junior artist could both follow.",
      },
      {
        gap: "The rights questions around generated images are unsettled.",
        closeWith: "Learn your options: tools trained on licensed data, your own reference sets, and clear disclosure.",
      },
    ],
    firstProject: {
      title: "Direct one small asset set from brief to final",
      steps: [
        "Write a short visual brief for one location or character set, with a few reference images you made or own.",
        "Turn the brief into a style reference: rules, banned traits and a fixed prompt structure.",
        "Generate a batch of variations and pick the few worth pushing. Write one line on why for each.",
        "Paint over or correct the picks until they match the brief.",
        "Publish the brief, the rejected batch, the picks and the final set side by side.",
      ],
    },
    watchOuts: [
      "Many artists object to generative tools on ethical and legal grounds, and some studios ban them. Decide where you stand before you build a portfolio around them.",
      "Art director is a senior title that people usually reach after leading other artists. A first project shows direction skill. It does not make you a director.",
      "Your painting still matters. A director who cannot fix an image by hand loses the room in reviews.",
    ],
  },
  {
    slug: "recruiter-to-ai-trainer",
    publishAt: "2026-10-19",
    fromTitle: "Recruiter",
    fromField: "Recruiting",
    toTitleId: "ai-trainer",
    intro:
      "Sourcing and first-round screening are now often done with AI tools. The judgment a recruiter uses every day, reading work against a clear standard and explaining the call, is what an AI trainer uses to teach a model a domain.",
    translations: [
      {
        before: "Screened résumés against a hiring scorecard",
        now: "Rates model answers against a rubric",
        explanation: "A scorecard is a rubric. Rating answers consistently against one is the core task of an AI trainer.",
      },
      {
        before: "Wrote job descriptions that hiring managers signed off",
        now: "Writes example prompts and ideal answers",
        explanation:
          "Models learn from clear examples of what good looks like. You have spent years turning a vague need into a clear description.",
      },
      {
        before: "Ran structured interviews and wrote candid debriefs",
        now: "Writes critiques that explain why an answer fails",
        explanation:
          "Trainers do not just mark an answer wrong. They explain what was wrong in a way the next round can use, like a good debrief.",
      },
      {
        before: "Flagged biased language and unfair screening criteria",
        now: "Checks model output for bias",
        explanation:
          "Hiring is a domain where model bias does real harm. Knowing what unfair looks like in practice is worth a lot here.",
      },
    ],
    gaps: [
      {
        gap: "Trainer work is usually matched to a clear area of expertise.",
        closeWith: "Name your domain: hiring, HR policy, or the industry you recruited for.",
      },
      {
        gap: "You have not rated model output in bulk.",
        closeWith: "Rate a batch of answers against a rubric you wrote, then rate them again a few days later and compare.",
      },
      {
        gap: "Writing a model's ideal answer is different from writing for a person.",
        closeWith: "Practice writing complete, checkable ideal answers to hard questions in your domain.",
      },
    ],
    firstProject: {
      title: "Build a hiring-domain training set of twenty examples",
      steps: [
        "Choose one task in your domain, such as writing interview questions for a role or checking a résumé against criteria.",
        "Write a rubric with four or five criteria and what each score means.",
        "Give a model the task twenty times with varied, made-up inputs and save every answer.",
        "Rate each answer, write a short critique, and rewrite the worst five as ideal answers.",
        "Rate the whole set again a few days later and note where you disagreed with yourself.",
        "Publish the rubric, the critiques and your consistency check.",
      ],
    },
    watchOuts: [
      "Much AI trainer work is contract work paid per task, and the volume can be uneven. It can be a useful bridge, but plan for income that varies.",
      "Never use real candidate data, even in practice. Make up your examples or remove every identifying detail.",
      "The work is repetitive and solitary. If the conversations were your favorite part of recruiting, you may miss them.",
    ],
  },
  {
    slug: "copywriter-to-ai-content-strategist",
    publishAt: "2026-11-30",
    fromTitle: "Copywriter",
    fromField: "Copywriting",
    toTitleId: "ai-content-strategist",
    intro:
      "First drafts are cheap now, and that changes what a writer is paid for. Someone still has to decide what gets written, in what voice, and what is good enough to publish. That is a content strategist's job, and writers are best placed to do it.",
    translations: [
      {
        before: "Wrote from creative briefs on tight deadlines",
        now: "Writes the briefs AI drafts from",
        explanation:
          "A model is only as good as its brief. You know what a useful brief contains because you have suffered through the bad ones.",
      },
      {
        before: "Held a brand's tone of voice across every piece",
        now: "Defines voice rules and examples",
        explanation:
          "A voice guide for a model needs on-voice and off-voice lines side by side. Writers are the people who can choose them well.",
      },
      {
        before: "Edited drafts from other writers",
        now: "Edits and approves AI drafts",
        explanation:
          "Editing in volume means fast, consistent calls on what to fix and what to cut. You already make those calls every day.",
      },
      {
        before: "Wrote headline and subject line variants for tests",
        now: "Plans content tests",
        explanation:
          "Variants are easy to generate now. Choosing what to test and reading the result honestly is the skill.",
      },
    ],
    gaps: [
      {
        gap: "Strategy work asks why a piece exists, not only how it reads.",
        closeWith: "For one brand you know, write a short content plan that says who each piece is for and what it should do.",
      },
      {
        gap: "You may not have built a review process for drafts you did not write.",
        closeWith: "Write the checklist an AI draft must pass before it goes out, including a fact check.",
      },
      {
        gap: "Your portfolio shows finished pieces, not the system behind them.",
        closeWith: "Show the brief, the voice rules, the draft and your edit together.",
      },
    ],
    firstProject: {
      title: "Build a voice kit and test it on real drafts",
      steps: [
        "Pick a brand you know or invent one. Write a one-page voice guide with rules and paired examples.",
        "Write three briefs for different pieces using one template.",
        "Generate drafts from each brief, once with the voice guide and once without.",
        "Edit the best drafts and mark every change you made and why.",
        "Turn your most common edits into new rules in the guide, then generate again.",
        "Publish the kit, the before and after drafts, and what the guide still misses.",
      ],
    },
    watchOuts: [
      "A team usually needs one content strategist, not several. Expect to compete with editors and marketers for the same seat.",
      "Fact-checking AI drafts is slow, unglamorous work, and you will own the mistakes that slip through.",
      "Some clients will still want you to write. Keep your craft sharp. It is what makes your edits credible.",
    ],
  },
  {
    slug: "community-manager-to-ai-community-lead",
    publishAt: "2026-12-07",
    fromTitle: "Community Manager",
    fromField: "Community",
    toTitleId: "ai-community-lead",
    intro:
      "In many communities, AI agents now answer routine questions and do first-pass moderation. They need someone to write their rules, watch what they say, and step in when they get it wrong. A community manager already knows the people and the edge cases.",
    translations: [
      {
        before: "Wrote the server rules and enforced them",
        now: "Writes moderation policies for agents",
        explanation:
          "An agent needs rules for the edge cases, not just the obvious ones. You know the edge cases because you handled them at midnight.",
      },
      {
        before: "Answered the same questions in every channel",
        now: "Builds the knowledge an answer bot uses",
        explanation:
          "An answer bot is only as good as its source pages. You know which questions come up and which answers actually land.",
      },
      {
        before: "Escalated serious issues to the right team",
        now: "Designs escalation paths for agents",
        explanation:
          "The most important rule for an agent is when to stop and hand off to a person. You have made that call many times.",
      },
      {
        before: "Read community sentiment and reported it upward",
        now: "Monitors agent conversations for problems",
        explanation:
          "Someone has to read what the agent said and spot the pattern before it turns into a pile-on. That is sentiment reading with a new source.",
      },
    ],
    gaps: [
      {
        gap: "You have not set up an AI agent yourself.",
        closeWith: "Set up a simple answer bot on a test server using pages you wrote.",
      },
      {
        gap: "Agent policies need testing, not just writing.",
        closeWith: "Write a set of tricky messages and check how the agent handles each one.",
      },
      {
        gap: "Your reports may rest on screenshots and gut feel.",
        closeWith: "Learn to tag conversations by type so your reports show patterns.",
      },
    ],
    firstProject: {
      title: "Set up and test an answer agent for a small community",
      steps: [
        "Write a short FAQ and rules page for a community you know or invent.",
        "Set up an answer agent on a test server with those pages as its only source.",
        "Write the escalation rules: the topics and tones where it must hand off to a person.",
        "Send it twenty-five test messages, including hostile, off-topic and borderline ones.",
        "Log every bad answer, fix the source pages or the rules, and test again.",
        "Publish the rules, the test log and what you changed.",
      ],
    },
    watchOuts: [
      "Communities can turn on AI quickly if it feels like the team stopped listening. Part of the job is knowing where not to use it.",
      "Moderation agents make mistakes that hurt real people, and you will be accountable for them. Test more than you think you need to.",
      "The title is new, and many teams still post this work as community manager. Look at the tasks in the posting.",
    ],
  },
  {
    slug: "support-lead-to-ai-support-operations-lead",
    publishAt: "2026-12-14",
    fromTitle: "Support Lead",
    fromField: "Customer Support",
    toTitleId: "ai-support-ops-lead",
    intro:
      "In many support teams, an AI agent now answers the first message. Someone has to decide what it may answer, keep its sources accurate, and catch the tickets it gets wrong. A support lead already does most of that for a team of people.",
    translations: [
      {
        before: "Wrote and maintained macros and help articles",
        now: "Maintains the knowledge base AI answers from",
        explanation:
          "An AI agent repeats whatever its sources say. Keeping help articles accurate is now the most direct way to fix its answers.",
      },
      {
        before: "Set routing rules and queue priorities",
        now: "Designs AI and human handoff rules",
        explanation: "Deciding which tickets the AI keeps and which go to a person is routing, with one new queue.",
      },
      {
        before: "Reviewed agent replies for quality",
        now: "Audits AI conversations",
        explanation:
          "Quality review still matters. The difference is volume, so you learn to sample well and look for patterns instead of single tickets.",
      },
      {
        before: "Trained new hires on tone and policy",
        now: "Writes the AI agent's instructions",
        explanation: "Agent instructions are onboarding notes for a model. They need the same clarity you gave new hires.",
      },
    ],
    gaps: [
      {
        gap: "You may not have graded an AI agent against a quality bar.",
        closeWith: "Write a short rubric for a good answer and grade a sample of AI replies against it.",
      },
      {
        gap: "Operations roles expect you to pull data and spot trends yourself.",
        closeWith: "Learn to export tickets and group them by topic and outcome.",
      },
      {
        gap: "You need a clear view on when AI should not answer at all.",
        closeWith: "Write a policy listing the topics that always go to a person, and why.",
      },
    ],
    firstProject: {
      title: "Audit an AI support agent and fix its worst failures",
      steps: [
        "Write ten short help articles for a product you know well or invent.",
        "Set up an AI answer agent that uses only those articles.",
        "Write thirty realistic customer messages, including angry, vague and out-of-scope ones.",
        "Grade each answer as right, wrong, or should have handed off to a person.",
        "Fix the articles or instructions behind the most common failures and grade again.",
        "Publish the rubric, the before and after grades and your handoff policy.",
      ],
    },
    watchOuts: [
      "Some companies use AI to shrink support teams rather than to improve support. Ask how a team measures success before you join it.",
      "You will be judged on the AI's mistakes as well as the team's. Make sure the role gives you the authority to fix its sources.",
      "Customers can tell when they are stuck with a bot. Good support operations leads fight for an easy way to reach a person.",
    ],
  },
  {
    slug: "brand-designer-to-generative-brand-designer",
    publishAt: "2026-12-21",
    fromTitle: "Brand Designer",
    fromField: "Brand Design",
    toTitleId: "generative-brand-designer",
    intro:
      "Teams now generate social images, ad variants and campaign art with AI, often with no designer involved. The results drift off brand fast. A brand designer who can turn a brand system into rules a model follows becomes the person who stops the drift.",
    translations: [
      {
        before: "Built identity systems and brand guidelines",
        now: "Builds generative brand systems",
        explanation:
          "A brand guide for a model needs style references, color and type rules, and clear examples of what is off brand.",
      },
      {
        before: "Adapted campaign assets to every size and channel",
        now: "Produces variations from templates and prompts",
        explanation:
          "Resizing and versioning are where generation saves the most time. Your job moves to setting the template and checking the output.",
      },
      {
        before: "Checked other teams' work for brand compliance",
        now: "Reviews generated assets for brand fit",
        explanation: "Off-brand work now arrives in volume. Fast, consistent review is the skill most teams are missing.",
      },
      {
        before: "Kept the library of logos, photos and source files in order",
        now: "Curates reference sets for models",
        explanation:
          "Models follow the references you give them. A clean, tagged reference set is now part of the brand system itself.",
      },
    ],
    gaps: [
      {
        gap: "You may not have held a style steady in a generative tool.",
        closeWith: "Learn to keep one look across a batch using reference images and fixed prompt parts.",
      },
      {
        gap: "Generative systems need written rules as well as visual ones.",
        closeWith: "Write the rules a non-designer would need to make on-brand work.",
      },
      {
        gap: "Rights and disclosure questions are still unsettled.",
        closeWith: "Know which tools you would trust for commercial work and how you would disclose AI use.",
      },
    ],
    firstProject: {
      title: "Turn one brand into a generative kit and test it",
      steps: [
        "Pick a brand you designed or invent a small one. Collect on-brand and off-brand reference images.",
        "Write the generative rules: palette, type, composition, mood and banned traits.",
        "Build a prompt template and generate a batch of social images from it.",
        "Review the batch, note every off-brand result and tighten the rules.",
        "Give the kit to a friend who is not a designer and see what they make with it.",
        "Publish the kit, the batches before and after, and what your friend produced.",
      ],
    },
    watchOuts: [
      "Some brands ban generated imagery outright. This route fits teams that already use it, which narrows where you can apply.",
      "Volume work can get dull. Keep a craft project going so your eye stays sharp.",
      "A kit that works in your hands may fail in a marketer's. Test it with non-designers before you call it done.",
    ],
  },
  {
    slug: "product-manager-to-agent-operations-lead",
    publishAt: "2026-12-28",
    fromTitle: "Product Manager",
    fromField: "Product Management",
    toTitleId: "agent-ops-lead",
    intro:
      "Teams are putting AI agents into real workflows, and each agent needs an owner who watches its runs, fixes failures and decides what it should do next. A product manager already owns outcomes across teams.",
    translations: [
      {
        before: "Wrote requirements and acceptance criteria",
        now: "Writes agent instructions and success checks",
        explanation:
          "An agent needs what an engineer needs: what to do, what done looks like, and what never to do.",
      },
      {
        before: "Watched product dashboards and chose what to measure",
        now: "Monitors agent runs",
        explanation:
          "Agent runs need a dashboard too. You know how to pick the few signals that matter and ignore the rest.",
      },
      {
        before: "Ran bug triage and prioritized fixes",
        now: "Triages agent failures",
        explanation:
          "Agents fail by misreading the task, using the wrong tool or going in circles. Sorting those and fixing the costliest first is triage.",
      },
      {
        before: "Managed stakeholders across several teams",
        now: "Coordinates the owners of agent workflows",
        explanation:
          "Every agent touches a team that relies on it. Someone has to keep those teams informed and agree changes with them.",
      },
    ],
    gaps: [
      {
        gap: "You may not have run an agent yourself.",
        closeWith: "Build a small agent in a no-code tool and use it for a real task each day.",
      },
      {
        gap: "Fixing agents means reading run logs.",
        closeWith: "Learn to read a run log well enough to find the step where an agent went wrong.",
      },
      {
        gap: "Operations work is hands-on in a way product work often is not.",
        closeWith: "Plan to make the fixes yourself, not just file tickets for them.",
      },
    ],
    firstProject: {
      title: "Run one agent for a week and keep its operations log",
      steps: [
        "Pick a repeatable task you do, such as summarizing feedback or sorting an inbox, and build an agent for it in a no-code tool.",
        "Write its instructions, list its tools, and write a short list of things it must never do.",
        "Run it every day for a week and save every run.",
        "Log each failure with its cause: the instructions, a tool, the data or the model itself.",
        "Fix the two most common causes and compare the next runs.",
        "Publish the log, the fixes and what you would monitor if it ran for a whole team.",
      ],
    },
    watchOuts: [
      "This role is new and many teams have not defined it. You may have to describe the job to the people hiring for it.",
      "It can feel like a step away from strategy. The work is closer to operations than to setting a roadmap.",
      "Agents built on tools that change often can break without warning. Expect a steady stream of small fixes.",
    ],
  },
  {
    slug: "paralegal-to-legal-ai-operations-specialist",
    publishAt: "2027-01-04",
    fromTitle: "Paralegal",
    fromField: "Legal",
    toTitleId: "legal-ai-ops-specialist",
    intro:
      "Document review, first drafts and research summaries are moving onto AI tools in many legal teams. Those tools need someone who knows legal work, sets up the review steps, and checks the output before a lawyer relies on it. Paralegals already do the checking.",
    translations: [
      {
        before: "Ran first-pass document review in discovery",
        now: "Runs AI-assisted review with quality checks",
        explanation: "AI can sort documents fast. Someone has to design the sample checks that show the sorting is right.",
      },
      {
        before: "Drafted routine letters and filings from templates",
        now: "Builds drafting templates for AI",
        explanation:
          "A good template with clear rules makes AI drafts safer. You know which clauses change and which never should.",
      },
      {
        before: "Cite-checked briefs before filing",
        now: "Verifies AI research output",
        explanation:
          "AI research tools can invent cases that do not exist. Checking every citation is already your habit, and now it is a core safeguard.",
      },
      {
        before: "Kept case files organized and deadlines tracked",
        now: "Manages the documents AI tools draw on",
        explanation:
          "AI tools answer from the files you give them. Clean, current, well-labeled files are the base of good output.",
      },
    ],
    gaps: [
      {
        gap: "You may not have used AI tools on legal work beyond a demo.",
        closeWith: "Use a general model on published court opinions and check its summaries line by line.",
      },
      {
        gap: "Operations roles need written procedures, not only good habits.",
        closeWith: "Write a review procedure a lawyer could sign off on, including how errors are caught and fixed.",
      },
      {
        gap: "Confidentiality rules limit what you can practice on.",
        closeWith: "Use only public documents, such as published opinions, for every practice project.",
      },
    ],
    firstProject: {
      title: "Build a checked AI summary process for public court opinions",
      steps: [
        "Choose five published court opinions in an area of law you know.",
        "Write a summary template: parties, issue, holding, reasoning and cited authorities.",
        "Have a model summarize each opinion using the template.",
        "Check every statement and citation against the opinion and log each error.",
        "Change the template or instructions to prevent the most common errors, then run it again.",
        "Publish the template, the error log and your written review procedure.",
      ],
    },
    watchOuts: [
      "Legal teams move carefully with AI, and some will not use it on client work yet. Look for firms and in-house teams that already have a written AI policy.",
      "This role does not give legal advice, and your title should not suggest it does. Keep a lawyer as the final reviewer in anything you publish.",
      "Mistakes here have real consequences, so adoption is slow and heavily documented. Expect to write a lot of procedure.",
    ],
  },
];

/**
 * Other stations on each destination's line, drawn on the route map and listed
 * under it. Hand-picked per route; every id is on the same line as `toTitleId`.
 */
const NEARBY_STOPS: Readonly<Record<string, readonly string[]>> = {
  "marketing-manager-to-go-to-market-engineer": ["lifecycle-automation-lead", "creative-ops-engineer"],
  "qa-tester-to-model-evaluator": ["ai-quality-lead", "ai-policy-analyst"],
  "game-designer-to-ai-environment-designer": ["model-evaluator", "ai-policy-analyst"],
  "producer-to-ai-product-manager": ["agent-ops-lead", "conversation-designer"],
  "concept-artist-to-ai-art-director": ["generative-brand-designer", "ai-technical-artist"],
  "recruiter-to-ai-trainer": ["annotation-program-lead", "model-evaluator"],
  "copywriter-to-ai-content-strategist": ["lifecycle-automation-lead", "creative-ops-engineer"],
  "community-manager-to-ai-community-lead": ["ai-content-strategist", "lifecycle-automation-lead"],
  "support-lead-to-ai-support-operations-lead": ["knowledge-ops-lead", "ai-automation-specialist"],
  "brand-designer-to-generative-brand-designer": ["ai-art-director", "ai-video-producer"],
  "product-manager-to-agent-operations-lead": ["ai-product-manager", "forward-deployed-engineer"],
  "paralegal-to-legal-ai-operations-specialist": ["knowledge-ops-lead", "ai-operations-lead"],
};

/** Milliseconds at which a route goes public (00:00 UTC on its publish date). */
export function remappedRoutePublishTime(route: Pick<RemappedRoute, "publishAt">): number {
  return Date.parse(`${route.publishAt.slice(0, 10)}T00:00:00Z`);
}

export function isRemappedRoutePublished(route: Pick<RemappedRoute, "publishAt">, now: Date = new Date()): boolean {
  const publishTime = remappedRoutePublishTime(route);
  return Number.isFinite(publishTime) && publishTime <= now.getTime();
}

/** Routes whose publishAt is on or before `now`, newest first. */
export function listRemappedRoutes(now: Date = new Date()): RemappedRoute[] {
  return REMAPPED_ROUTES.filter((route) => isRemappedRoutePublished(route, now)).sort(
    (a, b) => remappedRoutePublishTime(b) - remappedRoutePublishTime(a),
  );
}

export function getRemappedRoute(slug: string, now: Date = new Date()): RemappedRoute | null {
  const route = REMAPPED_ROUTES.find((entry) => entry.slug === slug);
  if (!route || !isRemappedRoutePublished(route, now)) return null;
  return route;
}

/** Catalog entry for a route's destination title. Throws if the catalog is missing it (tests guard this). */
export function getRemappedDestination(route: RemappedRoute): CareerMapTitle {
  const title = getCareerMapTitle(route.toTitleId);
  if (!title) throw new Error(`REMAPPED_UNKNOWN_TITLE:${route.toTitleId}`);
  return title;
}

/** Other catalog titles on the destination's line, for the route map. */
export function getRemappedNearbyStops(route: RemappedRoute): CareerMapTitle[] {
  const destination = getRemappedDestination(route);
  return (NEARBY_STOPS[route.slug] ?? [])
    .map((id) => getCareerMapTitle(id))
    .filter((title): title is CareerMapTitle => title !== null && title.line === destination.line && title.id !== destination.id);
}

/** Other published routes to read next: same destination line first, then newest. */
export function getRelatedRemappedRoutes(route: RemappedRoute, now: Date = new Date(), limit = 3): RemappedRoute[] {
  const line = getCareerMapTitle(route.toTitleId)?.line;
  const others = listRemappedRoutes(now).filter((entry) => entry.slug !== route.slug);
  const sameLine = others.filter((entry) => getCareerMapTitle(entry.toTitleId)?.line === line);
  const rest = others.filter((entry) => !sameLine.includes(entry));
  return [...sameLine, ...rest].slice(0, limit);
}

/** "November 23, 2026" for a route's publish date. */
export function formatRemappedDate(publishAt: string): string {
  return new Intl.DateTimeFormat("en-US", { month: "long", day: "numeric", year: "numeric", timeZone: "UTC" }).format(
    new Date(`${publishAt.slice(0, 10)}T12:00:00Z`),
  );
}

/** One-line description used in metadata and JSON-LD. */
export function describeRemappedRoute(route: RemappedRoute): string {
  const destination = getRemappedDestination(route);
  return `${route.fromTitle} to ${destination.title}: the skills that carry over, the gaps to close, and a first project you can finish in a week.`;
}
