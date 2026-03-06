import type { LearnArticle } from "@/lib/learn-content";

export type LearningCollectionId =
  | "role-playbooks"
  | "workflow-guides"
  | "career-proof";

export type LearningCollection = {
  id: LearningCollectionId;
  label: string;
  title: string;
  description: string;
  href: string;
  categories: string[];
  featuredSlugs: string[];
  ctaLabel: string;
  theme: "emerald" | "cyan" | "amber";
};

export type LearningCollectionWithArticles = LearningCollection & {
  articleCount: number;
  articles: LearnArticle[];
};

const learningCollections: LearningCollection[] = [
  {
    id: "role-playbooks",
    label: "Role Playbooks",
    title: "Role-specific AI skill stacks",
    description:
      "Guides for product, marketing, and operations professionals who want AI leverage tied directly to the work they already own.",
    href: "/learn#collection-role-playbooks",
    categories: ["Role Guide"],
    featuredSlugs: [
      "ai-skills-for-product-managers",
      "ai-skills-for-marketers",
      "ai-skills-for-operations-managers",
    ],
    ctaLabel: "Start with the PM guide",
    theme: "emerald",
  },
  {
    id: "workflow-guides",
    label: "Workflow Guides",
    title: "Systems and workflow execution",
    description:
      "Prompting, automation, output evaluation, and project design for people turning AI into repeatable operating systems.",
    href: "/learn#collection-workflow-guides",
    categories: ["AI Upskilling", "Skill Guide", "Project Ideas"],
    featuredSlugs: [
      "ai-upskilling-roadmap",
      "prompt-engineering-for-workflows",
      "workflow-automation-with-ai",
      "how-to-evaluate-ai-output-quality",
    ],
    ctaLabel: "Start with the roadmap",
    theme: "cyan",
  },
  {
    id: "career-proof",
    label: "Career Proof",
    title: "Portfolio, resume, and hiring proof",
    description:
      "Portfolio strategy, resume framing, and trust signals that turn AI project work into something employers can actually inspect.",
    href: "/learn#collection-career-proof",
    categories: ["AI Portfolio", "Career Proof", "Comparison"],
    featuredSlugs: [
      "how-to-build-an-ai-portfolio",
      "prove-ai-skills-to-employers",
      "how-to-put-ai-projects-on-your-resume",
      "ai-certifications-vs-project-proof",
    ],
    ctaLabel: "Start with the portfolio guide",
    theme: "amber",
  },
];

function sortArticlesByFreshness(articles: LearnArticle[]) {
  return [...articles]
    .map((article, index) => ({ article, index }))
    .sort((left, right) => {
      const dateCompare = right.article.updatedAt.localeCompare(left.article.updatedAt);
      if (dateCompare !== 0) return dateCompare;
      return right.index - left.index;
    })
    .map((entry) => entry.article);
}

export function getLearningCollections() {
  return learningCollections;
}

export function getLearningCollectionsWithArticles(articles: LearnArticle[]) {
  const articleMap = new Map(articles.map((article) => [article.slug, article]));

  return learningCollections.map((collection) => {
    const matchingArticles = sortArticlesByFreshness(
      articles.filter((article) => collection.categories.includes(article.category)),
    );
    const featured = collection.featuredSlugs
      .map((slug) => articleMap.get(slug))
      .filter((article): article is LearnArticle => Boolean(article));
    const seen = new Set(featured.map((article) => article.slug));
    const orderedArticles = [...featured, ...matchingArticles.filter((article) => !seen.has(article.slug))];

    return {
      ...collection,
      articleCount: matchingArticles.length,
      articles: orderedArticles,
    };
  });
}

export function getLearningCollectionIdForCategory(category: string): LearningCollectionId | null {
  const match = learningCollections.find((collection) => collection.categories.includes(category));
  return match?.id ?? null;
}

export function getLatestLearningArticles(articles: LearnArticle[], limit = 4) {
  return sortArticlesByFreshness(articles).slice(0, limit);
}
