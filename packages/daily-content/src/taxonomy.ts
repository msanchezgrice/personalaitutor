import { CAREER_PATHS } from "@aitutor/shared";

/**
 * Career taxonomy mapping (rebuild Phase 3.1).
 *
 * MyDailyDownload ranked briefings against 15 flat career categories
 * (`newsletter-backend/config.py:27-43`). MAST has 9 career paths
 * (`packages/shared/src/matrix.ts`). This module maps the 15 MDD careers onto
 * the 9 MAST paths and merges/adapts each career's `search_terms` so the
 * ranking stage (keyword overlap) works per MAST path.
 *
 * The mapping is written as data so it is auditable and testable:
 * - every MDD career id appears exactly once (either mapped to a MAST path or
 *   explicitly retired with a reason),
 * - every MAST path has at least one non-empty search-term set.
 */

export type MddCareerMapping = {
  mddId: string;
  mddName: string;
  /** Original MDD search_terms, verbatim from config.py. */
  mddSearchTerms: string;
  /** MAST career path id this career folds into, or null when retired. */
  mastPathId: string | null;
  /** Why a career is retired instead of mapped (required when mastPathId is null). */
  retiredReason?: string;
};

export const MDD_CAREER_MAPPINGS: MddCareerMapping[] = [
  {
    mddId: "product-management",
    mddName: "Product Manager",
    mddSearchTerms: "AI product management, AI roadmap tools, product analytics AI",
    mastPathId: "product-management",
  },
  {
    mddId: "entrepreneurship",
    mddName: "Entrepreneurship",
    mddSearchTerms: "AI startups, founder AI tools, AI business",
    mastPathId: "product-management",
  },
  {
    mddId: "marketing",
    mddName: "Marketing",
    mddSearchTerms: "AI marketing tools, generative AI advertising, AI content marketing",
    mastPathId: "marketing-seo",
  },
  {
    mddId: "content-creation",
    mddName: "Content Creation",
    mddSearchTerms: "AI content creation, video AI, AI writing tools",
    mastPathId: "marketing-seo",
  },
  {
    mddId: "design",
    mddName: "Design",
    mddSearchTerms: "AI design tools, generative design, AI UX",
    mastPathId: "branding-design",
  },
  {
    mddId: "sales",
    mddName: "Sales",
    mddSearchTerms: "AI sales tools, AI prospecting, sales automation AI",
    mastPathId: "sales-revops",
  },
  {
    mddId: "customer-success",
    mddName: "Customer Success",
    mddSearchTerms: "AI customer success, support automation, AI CRM",
    mastPathId: "customer-support",
  },
  {
    mddId: "operations",
    mddName: "Operations",
    mddSearchTerms: "AI operations, workflow automation, RPA AI",
    mastPathId: "operations",
  },
  {
    mddId: "consulting",
    mddName: "Consulting",
    mddSearchTerms: "AI consulting, enterprise AI, digital transformation AI",
    mastPathId: "operations",
  },
  {
    mddId: "finance",
    mddName: "Finance",
    mddSearchTerms: "AI finance tools, fintech AI, accounting automation",
    mastPathId: "operations",
  },
  {
    mddId: "hr-people",
    mddName: "HR & People",
    mddSearchTerms: "AI HR tools, recruiting AI, people analytics",
    mastPathId: "human-resources",
  },
  {
    mddId: "engineering",
    mddName: "Engineering",
    mddSearchTerms: "AI coding tools, developer AI, AI DevOps",
    mastPathId: "software-engineering",
  },
  {
    mddId: "data-science",
    mddName: "Data Science",
    mddSearchTerms: "AI data science, ML tools, AI analytics",
    mastPathId: "software-engineering",
  },
  {
    mddId: "legal",
    mddName: "Legal",
    mddSearchTerms: "AI legal tools, legal tech AI, contract AI",
    mastPathId: null,
    retiredReason: "MAST has no legal career path; vertical retired with the MDD brand.",
  },
  {
    mddId: "healthcare",
    mddName: "Healthcare",
    mddSearchTerms: "AI healthcare, medical AI, health tech",
    mastPathId: null,
    retiredReason: "MAST has no healthcare career path; vertical retired with the MDD brand.",
  },
];

/**
 * Extra search terms per MAST path. Two purposes:
 * - paths with no direct MDD ancestor (quality-assurance) get adapted terms
 *   derived from the path's matrix.ts modules/tools,
 * - merged paths get connective vocabulary so both ancestors keep ranking.
 */
const MAST_PATH_EXTRA_TERMS: Record<string, string> = {
  "product-management": "PRD generation, synthetic user research, product discovery AI",
  "marketing-seo": "programmatic SEO, AI keyword clustering, copywriting agents, bulk content generation",
  "branding-design": "image synthesis, Midjourney, Stable Diffusion, vector generation, brand identity AI",
  "quality-assurance":
    "AI testing tools, test automation AI, QA automation, LLM evaluation, visual regression testing, edge case discovery, Playwright AI, software quality AI",
  "sales-revops": "lead scoring AI, revenue operations, data enrichment, cold outreach personalization",
  "customer-support": "AI ticket routing, RAG retrieval support, chatbot deflection, sentiment detection",
  operations: "OCR document processing, intelligent data extraction, business process automation",
  "human-resources": "interview automation, candidate screening AI, HR copilot, talent intelligence",
  "software-engineering": "coding agents, Cursor IDE, GitHub Copilot, RAG pipelines, prompt engineering, LLM APIs",
};

export type CareerPathCategory = {
  id: string;
  name: string;
  searchTerms: string;
  /** MDD career ids merged into this path (provenance). */
  mddSources: string[];
};

function buildCategories(): CareerPathCategory[] {
  return CAREER_PATHS.map((path) => {
    const sources = MDD_CAREER_MAPPINGS.filter((entry) => entry.mastPathId === path.id);
    const terms = [
      ...sources.map((entry) => entry.mddSearchTerms),
      MAST_PATH_EXTRA_TERMS[path.id] ?? "",
      // The path's own skill domain vocabulary keeps ranking anchored to MAST.
      path.coreSkillDomain,
    ]
      .map((entry) => entry.trim())
      .filter(Boolean)
      .join(", ");

    return {
      id: path.id,
      name: path.name,
      searchTerms: terms,
      mddSources: sources.map((entry) => entry.mddId),
    };
  });
}

export const CAREER_PATH_CATEGORIES: CareerPathCategory[] = buildCategories();

export const CAREER_PATH_CATEGORY_MAP: Record<string, CareerPathCategory> = Object.fromEntries(
  CAREER_PATH_CATEGORIES.map((category) => [category.id, category]),
);

export function getCareerPathCategory(pathId: string): CareerPathCategory | null {
  return CAREER_PATH_CATEGORY_MAP[pathId] ?? null;
}
