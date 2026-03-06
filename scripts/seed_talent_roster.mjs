#!/usr/bin/env node

import { randomUUID } from "node:crypto";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { createClient } from "../apps/web/node_modules/@supabase/supabase-js/dist/index.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));

try {
  process.loadEnvFile(resolve(__dirname, "../.env"));
} catch {
  // Root env is optional if the shell already provided credentials.
}

const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  throw new Error("SUPABASE_ENV_MISSING");
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const SITE_URL = "https://www.myaiskilltutor.com";
const SEEDED_PREFIX = "seed:talent:";

const careerCatalog = {
  "product-management": {
    modules: ["Synthetic User Research", "AI Wireframing", "PRD Generation", "Sentiment Analysis"],
    tools: ["Cursor", "v0.dev", "Claude 3.5", "OpenAI API"],
  },
  "marketing-seo": {
    modules: ["Programmatic SEO", "Bulk Content Generation", "AI Keyword Clustering", "Copywriting Agents"],
    tools: ["Jasper", "ChatGPT", "Python (Pandas/Scripts)"],
  },
  "branding-design": {
    modules: ["Image Synthesis", "Style-consistent Training", "Vector Generation", "Video AI"],
    tools: ["Midjourney", "Stable Diffusion", "Runway", "Recraft"],
  },
  "quality-assurance": {
    modules: ["Edge-case Discovery via LLMs", "Visual Regression", "NLP-driven Test Scripts"],
    tools: ["Playwright + Local LLMs", "GitHub Copilot"],
  },
  "sales-revops": {
    modules: ["Predictive Lead Scoring", "Deep Data Enrichment", "Hyper-personalized Cold Outreach"],
    tools: ["Clay", "Apollo + AI", "Zapier", "Make.com"],
  },
  "customer-support": {
    modules: ["RAG Document Retrieval", "Intelligent Ticket Routing", "Tone & Sentiment Detection"],
    tools: ["Zendesk AI", "Pinecone", "Custom Python Flask APIs"],
  },
  operations: {
    modules: ["Cross-application Data Sync", "OCR Document Processing", "Intelligent Extraction"],
    tools: ["Zapier", "Make.com", "OpenAI Vision API"],
  },
  "software-engineering": {
    modules: ["API Integration", "System Architecture", "RAG Setup", "Prompt Engineering in Code"],
    tools: ["Python", "Node.js", "Langchain", "Cursor IDE"],
  },
};

const rawTalentRows = [
  ["zoe-smith", "Zoe Smith", "https://randomuser.me/api/portraits/women/41.jpg", "employed", "product-management", "Product Manager", "verified", 83, "Builds support and onboarding copilots that turn user research into shipped workflow changes.", "Support Copilot Sprint Room", "support-copilot-sprint-room", "A support copilot that converts interview notes, backlog pain points, and ticket themes into a scoped workflow pilot.", "Published a support copilot from discovery notes to working demo."],
  ["jeffery-williams", "Jeffery Williams", "https://randomuser.me/api/portraits/men/20.jpg", "career_switcher", "product-management", "Growth PM", "built", 71, "Career switcher using AI product experiments to prove he can move from ideas to measurable funnel wins.", "Lead Qualifier Microsite", "lead-qualifier-microsite", "A lightweight product funnel experiment that scores inbound leads and rewrites landing page prompts for better conversion.", "Shipped a lead-qualifier microsite with live experiment notes."],
  ["vera-hernandez", "Vera Hernandez", "https://randomuser.me/api/portraits/women/45.jpg", "employed", "product-management", "Product Lead", "verified", 86, "Leads platform work and uses AI to shorten spec cycles, clarify edge cases, and align cross-functional teams.", "Internal Knowledge Assistant", "internal-knowledge-assistant", "A knowledge assistant that routes policy and product questions into concise, role-aware answers for internal teams.", "Published an internal knowledge assistant spec and prototype."],
  ["anthony-cote", "Anthony Côté", "https://randomuser.me/api/portraits/men/80.jpg", "employed", "product-management", "Product Manager", "built", 69, "Owns product operations and turns release noise into clearer priorities, summaries, and execution briefs.", "Release Review Copilot", "release-review-copilot", "A product ops assistant that summarizes release notes, tags risk, and drafts stakeholder review briefs.", "Runs a weekly release-note summarizer for product reviews."],
  ["madison-park", "Madison Park", "https://randomuser.me/api/portraits/women/9.jpg", "unemployed", "product-management", "Product Manager", "in_progress", 52, "Job-seeking PM building public product proof around onboarding flows, user friction, and workflow redesign.", "Onboarding Diagnosis Assistant", "onboarding-diagnosis-assistant", "An assistant that clusters onboarding friction, drafts fixes, and turns qualitative notes into product recommendations.", "Portfolio project focused on diagnosing onboarding drop-off."],
  ["david-palmer", "David Palmer", "https://randomuser.me/api/portraits/men/41.jpg", "student", "product-management", "Product Manager", "in_progress", 49, "Student builder using AI analysis projects to prove product judgment and decision-making with messy feedback data.", "Churn Feedback Clusterer", "churn-feedback-clusterer", "A feedback analysis tool that groups churn comments and suggests product themes worth investigating.", "Built a churn-feedback clustering project with public proof."],
  ["alison-jennings", "Alison Jennings", "https://randomuser.me/api/portraits/women/55.jpg", "employed", "product-management", "Product Lead", "built", 66, "Product lead focused on customer experience and self-serve journeys that reduce support load and improve activation.", "Help Center Recommender", "help-center-recommender", "A self-serve assistant that maps common friction to help center content and suggested product nudges.", "Built a self-serve help-center recommender."],
  ["logan-ouellet", "Logan Ouellet", "https://randomuser.me/api/portraits/men/54.jpg", "founder", "product-management", "Product Lead", "built", 68, "Founder building internal tooling that captures requests, scopes work quickly, and turns ops pain into product systems.", "AI Intake Portal", "ai-intake-portal", "An intake portal that turns messy internal requests into scoped product tickets with next-step recommendations.", "Shipped an AI intake portal for ops requests."],
  ["melissa-fox", "Melissa Fox", "https://randomuser.me/api/portraits/women/5.jpg", "employed", "marketing-seo", "Marketing Lead", "verified", 84, "Lifecycle marketer building campaign systems that turn raw inputs into briefs, segments, and launch-ready content.", "Email Brief Generator", "email-brief-generator", "An email planning system that turns campaign inputs into segmented briefs, draft copy, and testing ideas.", "Built an email brief generator tied to campaign data."],
  ["francisco-reid", "Francisco Reid", "https://randomuser.me/api/portraits/men/26.jpg", "freelancer", "marketing-seo", "SEO Manager", "built", 72, "Freelance SEO operator using AI to cluster search demand, scale briefs, and speed up editorial throughput.", "Long-tail Content Engine", "long-tail-content-engine", "A content engine that groups keywords, drafts outlines, and prioritizes pages for programmatic SEO.", "Shipped a long-tail content engine for SaaS pages."],
  ["angela-ward", "Angela Ward", "https://randomuser.me/api/portraits/women/76.jpg", "employed", "marketing-seo", "Marketing Lead", "verified", 81, "Product marketer turning win-loss calls and customer language into sharper positioning and launch collateral.", "Launch Messaging Pack Builder", "launch-messaging-pack-builder", "A workflow that converts call transcripts into launch messaging, objection handling, and GTM draft assets.", "Turns win-loss calls into launch messaging packs."],
  ["remi-porto", "Remi Porto", "https://randomuser.me/api/portraits/men/39.jpg", "employed", "marketing-seo", "Marketing Lead", "built", 67, "Demand gen operator building AI systems for campaign angles, testing velocity, and weekly reporting loops.", "Campaign Angle Generator", "campaign-angle-generator", "A campaign ideation tool that drafts paid media angles, landing hooks, and conversion hypotheses.", "Built a campaign-angle generator for paid media."],
  ["claudia-iglesias", "Claudia Iglesias", "https://randomuser.me/api/portraits/women/33.jpg", "career_switcher", "marketing-seo", "Content Strategist", "built", 65, "Career switcher proving editorial judgment through AI-assisted repurposing, research synthesis, and multi-format distribution.", "Webinar Repurposing Engine", "webinar-repurposing-engine", "A system that turns webinars into blog drafts, social outlines, and nurture sequence building blocks.", "Repurposes webinars into multi-channel draft sets."],
  ["gary-warren", "Gary Warren", "https://randomuser.me/api/portraits/men/59.jpg", "founder", "marketing-seo", "Marketing Lead", "verified", 82, "Founder using AI growth systems to compress reporting, copy iteration, and weekly execution across a lean team.", "Growth Reporting Copilot", "growth-reporting-copilot", "A reporting workflow that converts raw funnel metrics into weekly takeaways, opportunities, and experiment prompts.", "Built a weekly growth reporting copilot."],
  ["abigail-carrasco", "Abigail Carrasco", "https://randomuser.me/api/portraits/women/68.jpg", "freelancer", "marketing-seo", "Content Strategist", "in_progress", 54, "Freelance operator building proof around B2B social workflows, repurposing systems, and prompt-driven content testing.", "B2B Social Post Engine", "b2b-social-post-engine", "A content workflow that turns source material into hooks, post drafts, and testing variants for social channels.", "Portfolio project centered on a B2B social post engine."],
  ["vera-bailey", "Vera Bailey", "https://randomuser.me/api/portraits/women/88.jpg", "employed", "marketing-seo", "SEO Manager", "built", 70, "SEO content lead combining competitor analysis, clustering, and AI briefs to speed up high-quality page production.", "Competitor Brief Workflow", "competitor-brief-workflow", "A workflow that converts SERP patterns and competitor notes into actionable content briefs.", "Built a competitor-summary to content-brief workflow."],
  ["maeva-jean-baptiste", "Maeva Jean-Baptiste", "https://randomuser.me/api/portraits/women/4.jpg", "freelancer", "branding-design", "Brand Designer", "built", 64, "Brand designer using image generation and system prompts to deliver startup identity concepts faster.", "AI Brand Kit Packages", "ai-brand-kit-packages", "A repeatable brand workflow that outputs concept boards, style directions, and asset-ready brand kits.", "Built AI-assisted brand kit packages for startups."],
  ["charlie-walker", "Charlie Walker", "https://randomuser.me/api/portraits/men/14.jpg", "employed", "branding-design", "Visual Designer", "built", 63, "Visual designer turning campaign needs into generated concept boards, motion sketches, and reusable creative systems.", "Campaign Concept Board Lab", "campaign-concept-board-lab", "A visual ideation workflow for producing campaign directions, mockups, and fast-turn creative explorations.", "Ships campaign concept boards in hours, not days."],
  ["laurine-moulin", "Laurine Moulin", "https://randomuser.me/api/portraits/women/26.jpg", "founder", "branding-design", "Creative Director", "verified", 80, "Creative leader documenting a reusable AI ad-creative pipeline with prompts, QA steps, and client-ready outputs.", "Ad Creative Pipeline", "ad-creative-pipeline", "A creative production system that standardizes prompt patterns, art direction review, and final handoff assets.", "Publicly documents a reusable ad-creative pipeline."],
  ["theo-knight", "Theo Knight", "https://randomuser.me/api/portraits/men/7.jpg", "career_switcher", "branding-design", "Visual Designer", "in_progress", 50, "Career switcher building public design proof through AI-driven prototype visuals and interface storytelling.", "Onboarding Redesign Variants", "onboarding-redesign-variants", "A visual exploration project that generates interface concepts and copy directions for onboarding improvements.", "Portfolio project for onboarding redesign with AI-generated variants."],
  ["corinna-erb", "Corinna Erb", "https://randomuser.me/api/portraits/women/23.jpg", "employed", "quality-assurance", "QA Engineer", "verified", 85, "QA engineer using LLMs to expand edge-case coverage and create more durable release checks.", "Checkout Test Pack", "checkout-test-pack", "A prompt-driven QA workflow that discovers checkout edge cases and turns them into actionable test coverage.", "Built a prompt-driven checkout test pack."],
  ["victor-loffler", "Victor Löffler", "https://randomuser.me/api/portraits/men/84.jpg", "employed", "quality-assurance", "Test Automation Engineer", "built", 68, "Automation engineer focused on reducing flaky tests, generating realistic cases, and tightening regression signals.", "Flaky Test Reduction Program", "flaky-test-reduction-program", "A test automation project that adds synthetic coverage, visual checks, and clearer failure triage.", "Publishes flaky-test reduction metrics from live suites."],
  ["summer-green", "Summer Green", "https://randomuser.me/api/portraits/women/0.jpg", "unemployed", "quality-assurance", "QA Engineer", "in_progress", 48, "Job-seeking QA builder creating public proof around bug discovery, acceptance tests, and AI-assisted exploratory coverage.", "App QA Copilot", "app-qa-copilot", "A QA helper that drafts acceptance criteria, summarizes defects, and suggests missing exploratory checks.", "Portfolio centers on an app QA copilot."],
  ["nathaniel-pena", "Nathaniel Pena", "https://randomuser.me/api/portraits/men/45.jpg", "founder", "quality-assurance", "Quality Lead", "built", 69, "Quality lead building scorecards and release gates for teams shipping AI-assisted product experiences.", "QA Scorecard Pipeline", "qa-scorecard-pipeline", "A release-readiness system that combines test evidence, prompt evals, and quality gate summaries.", "Built a QA scorecard pipeline for AI features."],
  ["kelly-sullivan", "Kelly Sullivan", "https://randomuser.me/api/portraits/women/42.jpg", "employed", "sales-revops", "RevOps Manager", "verified", 84, "RevOps builder creating transparent scoring, routing, and enrichment workflows for inbound and outbound systems.", "Inbound Qualification Engine", "inbound-qualification-engine", "A qualification workflow that scores inbound leads, enriches records, and routes follow-up with clear rules.", "Built inbound qualification with transparent scoring rules."],
  ["oswaldo-barreto", "Oswaldo Barreto", "https://randomuser.me/api/portraits/men/55.jpg", "employed", "sales-revops", "Outbound Lead", "built", 71, "Outbound operator using AI research and personalization to make prospecting faster without sounding generic.", "Research to Email Sequencer", "research-to-email-sequencer", "A sequencing workflow that converts account research into tailored outreach angles and follow-up drafts.", "Public proof project for research-to-email sequence generation."],
  ["victoria-kennedy", "Victoria Kennedy", "https://randomuser.me/api/portraits/women/83.jpg", "career_switcher", "sales-revops", "Sales Manager", "built", 66, "Career switcher using AI to standardize follow-up, summarize calls, and improve CRM consistency after demos.", "Demo Follow-up Standardizer", "demo-follow-up-standardizer", "A post-demo workflow that extracts objections, writes follow-ups, and keeps CRM notes cleaner.", "Uses AI to standardize rep follow-up after demos."],
  ["enrique-dixon", "Enrique Dixon", "https://randomuser.me/api/portraits/men/29.jpg", "employed", "sales-revops", "RevOps Manager", "verified", 82, "GTM systems operator building AI checks around stage exits, routing rules, and enrichment quality.", "Stage Exit Audit Bot", "stage-exit-audit-bot", "A RevOps tool that audits pipeline stage movement and flags missing data or weak handoffs.", "Built a stage-exit audit bot for RevOps."],
  ["monica-jaimes", "Mónica Jaimes", "https://randomuser.me/api/portraits/women/25.jpg", "employed", "sales-revops", "Sales Manager", "built", 65, "Revenue-oriented sales manager turning weekly numbers into clear narratives and focused next actions.", "Forecast Commentary Builder", "forecast-commentary-builder", "A reporting workflow that turns pipeline metrics into leadership commentary and rep guidance.", "Turns weekly numbers into executive-ready narrative."],
  ["raunak-bharanya", "Raunak Bharanya", "https://randomuser.me/api/portraits/men/35.jpg", "student", "sales-revops", "Outbound Lead", "in_progress", 51, "Student builder learning outbound systems through public projects on research, personalization, and prep automation.", "Outbound Prep Assistant", "outbound-prep-assistant", "A workflow that prepares SDRs with account research, objection notes, and personalization ideas before outreach.", "Portfolio project focused on an outbound prep assistant."],
  ["hannah-ouellet", "Hannah Ouellet", "https://randomuser.me/api/portraits/women/16.jpg", "employed", "customer-support", "Support Operations", "verified", 85, "Support operator building retrieval, routing, and escalation systems that make help flows faster and safer.", "Support Copilot with Escalation", "support-copilot-with-escalation", "A support copilot that retrieves documentation, drafts answers, and routes risky cases to a human.", "Built a support copilot with escalation rules."],
  ["bastien-mercier", "Bastien Mercier", "https://randomuser.me/api/portraits/men/93.jpg", "employed", "customer-support", "Customer Success Manager", "built", 68, "Success manager using AI to prep QBRs, summarize customer history, and surface renewal risk early.", "QBR Prep Assistant", "qbr-prep-assistant", "A customer-success workflow that builds account summaries, risk notes, and renewal prep materials.", "Uses AI to prep QBRs and save plans."],
  ["kate-sims", "Kate Sims", "https://randomuser.me/api/portraits/women/59.jpg", "freelancer", "customer-support", "Support Operations", "built", 64, "Freelance onboarding operator building FAQ, summary, and tone systems for SaaS customer teams.", "Onboarding Email Assistant", "onboarding-email-assistant", "An onboarding workflow that drafts account-specific summaries, FAQs, and follow-up messages.", "Built an onboarding-email assistant for SaaS clients."],
  ["william-cooper", "William Cooper", "https://randomuser.me/api/portraits/men/76.jpg", "employed", "customer-support", "Support Lead", "built", 67, "Technical support lead improving troubleshooting speed with AI triage, KB suggestions, and confidence controls.", "Confidence-based Triage Workflow", "confidence-based-triage-workflow", "A support triage system that suggests KB articles and escalates low-confidence answers.", "Published a triage workflow with confidence thresholds."],
  ["aria-jones", "Aria Jones", "https://randomuser.me/api/portraits/women/35.jpg", "career_switcher", "customer-support", "Support Operations", "in_progress", 53, "Career switcher building proof around knowledge-base cleanup, article clustering, and support content quality.", "Help Center Rewrite Engine", "help-center-rewrite-engine", "A content quality workflow that clusters articles, rewrites drafts, and spots missing support coverage.", "Portfolio project for a help-center rewrite engine."],
  ["steve-griffin", "Steve Griffin", "https://randomuser.me/api/portraits/men/12.jpg", "employed", "customer-support", "Support Lead", "verified", 80, "Support systems manager building routing, macros, and SLA awareness into day-to-day support operations.", "SLA Risk Escalation Assistant", "sla-risk-escalation-assistant", "A support ops system that flags SLA risk, drafts next actions, and recommends escalation timing.", "Built an SLA-risk escalation assistant."],
  ["susana-clement", "Susana Clement", "https://randomuser.me/api/portraits/women/87.jpg", "employed", "operations", "Operations Manager", "verified", 83, "Operations manager automating messy intake, OCR-heavy workflows, and exception handling with human review.", "Invoice Intake Automation", "invoice-intake-automation", "An operations workflow that extracts invoice data, flags exceptions, and routes edge cases for approval.", "Built invoice-intake automation with human review."],
  ["abhinav-shenoy", "Abhinav Shenoy", "https://randomuser.me/api/portraits/men/62.jpg", "employed", "operations", "Process Analyst", "built", 67, "Process analyst using AI extraction and reporting summaries to speed up reconciliations and monthly ops reviews.", "Month-end Exception Scanner", "month-end-exception-scanner", "A finance-ops workflow that scans documents, finds reconciliation mismatches, and summarizes exceptions.", "Built a month-end exception scanner."],
  ["riley-flores", "Riley Flores", "https://randomuser.me/api/portraits/women/89.jpg", "career_switcher", "operations", "Process Analyst", "built", 63, "Career switcher turning SOPs and intake requests into automation-ready maps and repeatable operating flows.", "SOP to Automation Builder", "sop-to-automation-builder", "A workflow that converts SOP text into process maps, extraction rules, and automation candidates.", "Portfolio project for an SOP-to-automation builder."],
  ["alicia-meyer", "Alicia Meyer", "https://randomuser.me/api/portraits/women/75.jpg", "employed", "operations", "Operations Manager", "built", 64, "People ops manager building internal assistants for policy lookup, FAQ drafting, and cleaner handoffs across teams.", "Internal HR Knowledge Assistant", "internal-hr-knowledge-assistant", "A people-ops assistant that summarizes policy content and drafts employee-ready responses.", "Built an internal HR knowledge assistant."],
  ["santiago-leon", "Santiago León", "https://randomuser.me/api/portraits/men/31.jpg", "founder", "operations", "BizOps Lead", "verified", 81, "Founder-level operator using AI to distill meetings, route actions, and keep leadership aligned on priorities.", "Weekly Leadership Brief", "weekly-leadership-brief", "A business ops workflow that turns meetings and metrics into a concise weekly leadership brief.", "Runs an AI weekly brief for leadership."],
  ["lois-foster", "Lois Foster", "https://randomuser.me/api/portraits/women/58.jpg", "employed", "operations", "Operations Manager", "built", 66, "Recruiting ops builder creating cleaner intake, summaries, and recruiter handoffs using AI workflow support.", "Recruiter Handoff Copilot", "recruiter-handoff-copilot", "A recruiting ops workflow that turns notes into structured handoffs and next-step guidance.", "Built a recruiter handoff copilot."],
  ["lucas-laboy", "Lucas Laboy", "https://randomuser.me/api/portraits/men/4.jpg", "employed", "operations", "Process Analyst", "in_progress", 55, "Compliance-oriented operator building document review and checklist evidence workflows with public proof.", "Policy Evidence Tracker", "policy-evidence-tracker", "A compliance support workflow that tracks checklist evidence and highlights missing documentation.", "Portfolio project for a policy evidence tracker."],
  ["adeline-robin", "Adeline Robin", "https://randomuser.me/api/portraits/women/73.jpg", "career_switcher", "operations", "BizOps Lead", "built", 65, "Career switcher using AI routing and dashboard summaries to prove operational thinking with real workflow outputs.", "Ops Command Center", "ops-command-center", "A business operations hub that summarizes intake, tracks follow-through, and highlights operational bottlenecks.", "Built an ops command center with AI summaries."],
  ["silvia-kranz", "Silvia Kranz", "https://randomuser.me/api/portraits/women/80.jpg", "employed", "software-engineering", "Full-Stack Engineer", "verified", 86, "Full-stack engineer shipping internal AI products with reliable APIs, retrieval, and prompt-driven workflows.", "Internal Support Assistant", "internal-support-assistant", "An internal support assistant that combines API integrations, retrieval, and structured response logic.", "Built an internal support assistant end to end."],
  ["aditya-keshri", "Aditya Keshri", "https://randomuser.me/api/portraits/men/53.jpg", "founder", "software-engineering", "Software Engineer", "verified", 84, "Solutions engineer building multi-step AI systems that turn vague requests into structured proposals and deliverables.", "Proposal Generator", "proposal-generator", "A multi-step proposal builder that collects inputs, reasons through requirements, and drafts polished outputs.", "Public proof project for a multi-step proposal generator."],
  ["ulku-gunday", "Ülkü Günday", "https://randomuser.me/api/portraits/women/14.jpg", "freelancer", "software-engineering", "Software Engineer", "built", 68, "Integration engineer building lightweight AI tools that sync systems, process events, and ship quickly for clients.", "SMB Workflow Integrator", "smb-workflow-integrator", "A client services workflow that ties forms, CRM events, and AI processing into a simple automation stack.", "Builds lightweight AI tools for SMB clients."],
  ["hunter-brown", "Hunter Brown", "https://randomuser.me/api/portraits/men/40.jpg", "employed", "software-engineering", "Software Engineer", "built", 69, "Automation-focused engineer building document-processing backends and background jobs for AI-heavy workflows.", "Document Processing Backend", "document-processing-backend", "A backend system that ingests documents, extracts structure, and routes next actions with job tracking.", "Built an AI document-processing backend."],
  ["hudson-liu", "Hudson Liu", "https://randomuser.me/api/portraits/men/22.jpg", "employed", "software-engineering", "Tech Lead", "verified", 88, "Technical lead documenting architecture, eval loops, and retrieval systems for AI products that need operational rigor.", "Knowledge Platform Build Log", "knowledge-platform-build-log", "A knowledge platform project focused on architecture, retrieval quality, and system evaluation loops.", "Maintains a public build log for an AI knowledge platform."],
  ["nicolas-arnaud", "Nicolas Arnaud", "https://randomuser.me/api/portraits/men/5.jpg", "career_switcher", "software-engineering", "Full-Stack Engineer", "built", 70, "Career switcher proving engineering range through rapid prototypes, frontend AI features, and clear product thinking.", "AI Onboarding Assistant", "ai-onboarding-assistant", "A product engineering project that guides onboarding, captures signals, and surfaces analytics-backed next steps.", "Portfolio project for an AI onboarding assistant with analytics."],
];

function rotate(arr, count) {
  return arr.map((_, index) => arr[(index + count) % arr.length]);
}

function buildRoster() {
  return rawTalentRows.map((row, index) => {
    const [handleBase, name, avatarUrl, situation, careerPathId, role, status, evidenceScore, bio, projectTitle, projectSlug, projectDescription, flagshipProof] = row;
    const path = careerCatalog[careerPathId];
    if (!path) {
      throw new Error(`UNKNOWN_CAREER_PATH:${careerPathId}`);
    }
    const topSkills = rotate(path.modules, index % path.modules.length).slice(0, Math.min(3, path.modules.length));
    const topTools = rotate(path.tools, index % path.tools.length).slice(0, Math.min(3, path.tools.length));
    return {
      handle: `${handleBase}-ai`,
      name,
      avatarUrl,
      situation,
      careerPathId,
      role,
      headline: role,
      status,
      evidenceScore,
      bio,
      topSkills,
      topTools,
      flagshipProject: {
        title: projectTitle,
        slug: projectSlug,
        description: projectDescription,
        proof: flagshipProof,
      },
    };
  });
}

function goalsForSituation(situation) {
  switch (situation) {
    case "founder":
    case "freelancer":
      return ["build_business", "ship_ai_projects"];
    case "student":
      return ["learn_foundations", "showcase_for_job"];
    case "career_switcher":
    case "unemployed":
      return ["showcase_for_job", "ship_ai_projects"];
    default:
      return ["upskill_current_job", "ship_ai_projects"];
  }
}

function knowledgeScoreForStatus(status) {
  switch (status) {
    case "verified":
      return 0.82;
    case "built":
      return 0.63;
    default:
      return 0.38;
  }
}

function tokensUsedForCandidate(candidate) {
  const multiplier = candidate.status === "verified" ? 2300 : candidate.status === "built" ? 1800 : 1200;
  return Math.max(24000, candidate.evidenceScore * multiplier);
}

function projectStateForStatus(status) {
  return status === "in_progress" ? "building" : "showcased";
}

function skillRowsForCandidate(candidate, learnerProfileId) {
  const base = candidate.evidenceScore / 100;
  if (candidate.status === "verified") {
    return [
      { id: randomUUID(), learner_profile_id: learnerProfileId, skill_name: candidate.topSkills[0], status: "verified", score: Math.min(0.96, base), evidence_count: 5 },
      { id: randomUUID(), learner_profile_id: learnerProfileId, skill_name: candidate.topSkills[1], status: "verified", score: Math.max(0.7, base - 0.06), evidence_count: 4 },
      { id: randomUUID(), learner_profile_id: learnerProfileId, skill_name: candidate.topSkills[2], status: "built", score: Math.max(0.58, base - 0.14), evidence_count: 3 },
    ];
  }
  if (candidate.status === "built") {
    return [
      { id: randomUUID(), learner_profile_id: learnerProfileId, skill_name: candidate.topSkills[0], status: "built", score: Math.min(0.84, base), evidence_count: 3 },
      { id: randomUUID(), learner_profile_id: learnerProfileId, skill_name: candidate.topSkills[1], status: "built", score: Math.max(0.56, base - 0.07), evidence_count: 2 },
      { id: randomUUID(), learner_profile_id: learnerProfileId, skill_name: candidate.topSkills[2], status: "in_progress", score: Math.max(0.4, base - 0.18), evidence_count: 1 },
    ];
  }
  return [
    { id: randomUUID(), learner_profile_id: learnerProfileId, skill_name: candidate.topSkills[0], status: "in_progress", score: Math.min(0.58, base), evidence_count: 1 },
    { id: randomUUID(), learner_profile_id: learnerProfileId, skill_name: candidate.topSkills[1], status: "in_progress", score: Math.max(0.34, base - 0.06), evidence_count: 1 },
    { id: randomUUID(), learner_profile_id: learnerProfileId, skill_name: candidate.topSkills[2], status: "not_started", score: Math.max(0.16, base - 0.2), evidence_count: 0 },
  ];
}

function artifactsForCandidate(candidate, projectId) {
  const baseUrl = `${SITE_URL}/u/${candidate.handle}/projects/${candidate.flagshipProject.slug}`;
  const artifacts = [
    { id: randomUUID(), project_id: projectId, kind: "website", url: baseUrl, created_at: new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString() },
  ];
  if (candidate.status !== "in_progress") {
    artifacts.push({
      id: randomUUID(),
      project_id: projectId,
      kind: "pdf",
      url: `${baseUrl}#artifact-case-study`,
      created_at: new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString(),
    });
  }
  if (candidate.status === "verified") {
    artifacts.push({
      id: randomUUID(),
      project_id: projectId,
      kind: "pptx",
      url: `${baseUrl}#artifact-review-deck`,
      created_at: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
    });
  }
  return artifacts;
}

function buildLogRowsForCandidate(candidate, learnerProfileId, projectId) {
  return [
    {
      id: randomUUID(),
      project_id: projectId,
      learner_profile_id: learnerProfileId,
      level: "info",
      message: `Mapped ${candidate.flagshipProject.title.toLowerCase()} into a scoped workflow with clear success criteria.`,
      metadata: {},
      created_at: new Date(Date.now() - 5 * 60 * 60 * 1000).toISOString(),
    },
    {
      id: randomUUID(),
      project_id: projectId,
      learner_profile_id: learnerProfileId,
      level: candidate.status === "in_progress" ? "warn" : "success",
      message: `Integrated ${candidate.topTools[0]} and ${candidate.topTools[1]} to strengthen ${candidate.topSkills[0].toLowerCase()}.`,
      metadata: {},
      created_at: new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString(),
    },
    {
      id: randomUUID(),
      project_id: projectId,
      learner_profile_id: learnerProfileId,
      level: candidate.status === "verified" ? "success" : "info",
      message: candidate.flagshipProject.proof,
      metadata: {},
      created_at: new Date(Date.now() - 90 * 60 * 1000).toISOString(),
    },
  ];
}

function externalUserIdForHandle(handle) {
  return `${SEEDED_PREFIX}${handle}`;
}

function assertNoError(label, error) {
  if (error) {
    throw new Error(`${label}:${error.message}`);
  }
}

async function main() {
  const roster = buildRoster();
  if (roster.length !== 50) {
    throw new Error(`EXPECTED_50_CANDIDATES_GOT_${roster.length}`);
  }

  const isDryRun = process.argv.includes("--dry-run");
  if (isDryRun) {
    console.log(JSON.stringify({
      total: roster.length,
      sampleHandles: roster.slice(0, 5).map((candidate) => candidate.handle),
      sampleProfiles: roster.slice(0, 3).map((candidate) => ({
        name: candidate.name,
        role: candidate.role,
        skills: candidate.topSkills,
        tools: candidate.topTools,
      })),
    }, null, 2));
    return;
  }

  const { data: existingSeeded, error: existingError } = await supabase
    .from("learner_profiles")
    .select("id,external_user_id,handle")
    .like("external_user_id", `${SEEDED_PREFIX}%`);
  assertNoError("FETCH_EXISTING_SEEDED_PROFILES_FAILED", existingError);

  const seededExternalIds = new Set(roster.map((candidate) => externalUserIdForHandle(candidate.handle)));
  const staleSeededIds = (existingSeeded ?? [])
    .filter((row) => row.external_user_id && !seededExternalIds.has(row.external_user_id))
    .map((row) => row.id);

  if (staleSeededIds.length) {
    const { error: staleDeleteError } = await supabase
      .from("learner_profiles")
      .delete()
      .in("id", staleSeededIds);
    assertNoError("DELETE_STALE_SEEDED_PROFILES_FAILED", staleDeleteError);
  }

  const profileRows = roster.map((candidate) => ({
    auth_user_id: externalUserIdForHandle(candidate.handle),
    external_user_id: externalUserIdForHandle(candidate.handle),
    handle: candidate.handle,
    full_name: candidate.name,
    headline: candidate.headline,
    bio: candidate.bio,
    career_path_id: candidate.careerPathId,
    published: true,
    tokens_used: tokensUsedForCandidate(candidate),
    tools: candidate.topTools,
    social_links: {
      avatar: candidate.avatarUrl,
      website: `${SITE_URL}/u/${candidate.handle}`,
    },
    goals: goalsForSituation(candidate.situation),
    updated_at: new Date().toISOString(),
  }));

  const { error: profileUpsertError } = await supabase
    .from("learner_profiles")
    .upsert(profileRows, { onConflict: "handle" });
  assertNoError("UPSERT_PROFILES_FAILED", profileUpsertError);

  const { data: seededProfiles, error: seededProfilesError } = await supabase
    .from("learner_profiles")
    .select("id,handle,external_user_id")
    .in("external_user_id", Array.from(seededExternalIds));
  assertNoError("FETCH_SEEDED_PROFILES_FAILED", seededProfilesError);

  if (!seededProfiles || seededProfiles.length !== roster.length) {
    throw new Error(`SEEDED_PROFILE_COUNT_MISMATCH:${seededProfiles?.length ?? 0}`);
  }

  const profileIdByExternalId = new Map(seededProfiles.map((profile) => [profile.external_user_id, profile.id]));
  const profileIds = seededProfiles.map((profile) => profile.id);

  const deletions = [
    supabase.from("onboarding_sessions").delete().in("learner_profile_id", profileIds),
    supabase.from("user_skill_evidence").delete().in("learner_profile_id", profileIds),
    supabase.from("projects").delete().in("learner_profile_id", profileIds),
  ];
  const deletionResults = await Promise.all(deletions);
  assertNoError("DELETE_ONBOARDING_FAILED", deletionResults[0].error);
  assertNoError("DELETE_SKILLS_FAILED", deletionResults[1].error);
  assertNoError("DELETE_PROJECTS_FAILED", deletionResults[2].error);

  const onboardingRows = roster.map((candidate) => ({
    id: randomUUID(),
    learner_profile_id: profileIdByExternalId.get(externalUserIdForHandle(candidate.handle)),
    situation: candidate.situation,
    career_path_id: candidate.careerPathId,
    linkedin_url: null,
    resume_filename: null,
    ai_knowledge_score: knowledgeScoreForStatus(candidate.status),
    goals: goalsForSituation(candidate.situation),
    status: "ready_for_dashboard",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }));

  const skillRows = roster.flatMap((candidate) =>
    skillRowsForCandidate(candidate, profileIdByExternalId.get(externalUserIdForHandle(candidate.handle))),
  );

  const projectRows = roster.map((candidate) => ({
    id: randomUUID(),
    learner_profile_id: profileIdByExternalId.get(externalUserIdForHandle(candidate.handle)),
    slug: candidate.flagshipProject.slug,
    title: candidate.flagshipProject.title,
    description: candidate.flagshipProject.description,
    state: projectStateForStatus(candidate.status),
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }));

  const { error: onboardingInsertError } = await supabase.from("onboarding_sessions").insert(onboardingRows);
  assertNoError("INSERT_ONBOARDING_FAILED", onboardingInsertError);

  const { error: skillInsertError } = await supabase.from("user_skill_evidence").insert(skillRows);
  assertNoError("INSERT_SKILLS_FAILED", skillInsertError);

  const { error: projectInsertError } = await supabase.from("projects").insert(projectRows);
  assertNoError("INSERT_PROJECTS_FAILED", projectInsertError);

  const { data: insertedProjects, error: insertedProjectsError } = await supabase
    .from("projects")
    .select("id,learner_profile_id,slug")
    .in("learner_profile_id", profileIds);
  assertNoError("FETCH_PROJECTS_FAILED", insertedProjectsError);

  const projectIdByProfileAndSlug = new Map(
    (insertedProjects ?? []).map((project) => [`${project.learner_profile_id}:${project.slug}`, project.id]),
  );

  const artifactRows = [];
  const buildLogRows = [];
  for (const candidate of roster) {
    const learnerProfileId = profileIdByExternalId.get(externalUserIdForHandle(candidate.handle));
    const projectId = projectIdByProfileAndSlug.get(`${learnerProfileId}:${candidate.flagshipProject.slug}`);
    if (!learnerProfileId || !projectId) {
      throw new Error(`PROJECT_LOOKUP_FAILED:${candidate.handle}`);
    }
    artifactRows.push(...artifactsForCandidate(candidate, projectId));
    buildLogRows.push(...buildLogRowsForCandidate(candidate, learnerProfileId, projectId));
  }

  const { error: artifactInsertError } = await supabase.from("project_artifacts").insert(artifactRows);
  assertNoError("INSERT_ARTIFACTS_FAILED", artifactInsertError);

  const { error: buildLogInsertError } = await supabase.from("build_log_entries").insert(buildLogRows);
  assertNoError("INSERT_BUILD_LOGS_FAILED", buildLogInsertError);

  console.log(`Seeded ${roster.length} AI builder profiles into ${new URL(supabaseUrl).host}.`);
  console.log(`Talent board: ${SITE_URL}/employers/talent`);
  console.log(`Sample profile: ${SITE_URL}/u/${roster[0].handle}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
