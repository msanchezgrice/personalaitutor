import "server-only";
import { getCareerMapTitle } from "@aitutor/shared";
import { getFeaturedLearnArticles, getLearnArticleBySlug, type LearnArticle } from "@/lib/learn-content";
import { listRemappedRoutes } from "@/lib/remapped/routes";
import { LANDING_GUIDES } from "./landing-content";
import type { LandingGuide, LandingRemappedRoute } from "./landing-page";

/** Up to five published Remapped routes whose destination is in the title catalog. */
export function landingRemappedRoutes(now: Date = new Date()): LandingRemappedRoute[] {
  const routes: LandingRemappedRoute[] = [];
  for (const route of listRemappedRoutes(now)) {
    const title = getCareerMapTitle(route.toTitleId);
    if (!title) continue;
    routes.push({ slug: route.slug, fromTitle: route.fromTitle, toTitle: title.title });
    if (routes.length === 5) break;
  }
  return routes;
}

/** The three career-change guides, topped up from the featured list if any is missing. */
export function landingGuides(): LandingGuide[] {
  const picked: LearnArticle[] = [];
  for (const slug of LANDING_GUIDES.slugs) {
    const article = getLearnArticleBySlug(slug);
    if (article) picked.push(article);
  }
  for (const article of getFeaturedLearnArticles(6)) {
    if (picked.length >= 3) break;
    if (!picked.some((entry) => entry.slug === article.slug)) picked.push(article);
  }
  return picked.slice(0, 3).map((article) => ({
    slug: article.slug,
    title: article.title,
    description: article.description,
    category: article.category,
    readingTime: article.readingTime,
  }));
}
