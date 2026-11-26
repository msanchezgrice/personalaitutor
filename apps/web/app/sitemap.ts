import type { MetadataRoute } from "next";
import {
  runtimeFindUserByHandle,
  runtimeListProjectsByUser,
  runtimeListTalent,
} from "@/lib/runtime";
import {
  EXAMPLE_PROFILE_HANDLE,
  exampleProjects,
} from "@/app/u/public-profile-utils";
import { getLearnArticles } from "@/lib/learn-content";
import { listRemappedRoutes } from "@/lib/remapped/routes";
import { getSiteUrl } from "@/lib/site";

const appBaseUrl = getSiteUrl();

// Rebuilt daily so each Monday's Remapped route appears without a deploy.
export const revalidate = 86400;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();
  const learnArticles = getLearnArticles();
  const learnLastModified = new Map(
    learnArticles.map((article) => [`${appBaseUrl}/learn/${article.slug}`, new Date(`${article.updatedAt}T12:00:00Z`)]),
  );
  const remappedRoutes = listRemappedRoutes(now);
  const remappedLastModified = new Map(
    remappedRoutes.map((route) => [`${appBaseUrl}/remapped/${route.slug}`, new Date(`${route.publishAt}T00:00:00Z`)]),
  );
  const urls = new Set<string>([
    `${appBaseUrl}/`,
    `${appBaseUrl}/map`,
    `${appBaseUrl}/remapped`,
    `${appBaseUrl}/employers`,
    `${appBaseUrl}/employers/talent`,
    `${appBaseUrl}/learn`,
    `${appBaseUrl}/tools/career-remapping`,
    `${appBaseUrl}/u/${EXAMPLE_PROFILE_HANDLE}`,
  ]);

  for (const route of remappedRoutes) {
    urls.add(`${appBaseUrl}/remapped/${route.slug}`);
  }

  for (const article of learnArticles) {
    urls.add(`${appBaseUrl}/learn/${article.slug}`);
  }

  for (const project of exampleProjects()) {
    urls.add(`${appBaseUrl}/u/${EXAMPLE_PROFILE_HANDLE}/projects/${project.slug}`);
  }

  try {
    const talentRows = await runtimeListTalent({ realOnly: true });
    const handles = [...new Set(talentRows.map((row) => row.handle).filter(Boolean))].slice(0, 200);
    await Promise.all(
      handles.map(async (handle) => {
        urls.add(`${appBaseUrl}/u/${handle}`);

        const publishedProfile = await runtimeFindUserByHandle(handle);
        if (!publishedProfile || !publishedProfile.published) return;
        const projects = await runtimeListProjectsByUser(publishedProfile.id);
        for (const project of projects) {
          urls.add(`${appBaseUrl}/u/${handle}/projects/${project.slug}`);
        }
      }),
    );
  } catch {
    // Keep base routes if runtime-backed sitemap expansion fails.
  }

  const remappedIndexModified = remappedRoutes[0] ? new Date(`${remappedRoutes[0].publishAt}T00:00:00Z`) : now;

  return [...urls].map((url) => ({
    url,
    lastModified:
      learnLastModified.get(url) ??
      remappedLastModified.get(url) ??
      (url === `${appBaseUrl}/remapped` ? remappedIndexModified : now),
    changeFrequency: url.includes("/u/") ? "daily" : "weekly",
    priority: sitemapPriority(url),
  }));
}

function sitemapPriority(url: string): number {
  if (url === `${appBaseUrl}/`) return 1;
  if (url === `${appBaseUrl}/map`) return 0.9;
  if (url === `${appBaseUrl}/learn` || url === `${appBaseUrl}/remapped`) return 0.8;
  if (url.startsWith(`${appBaseUrl}/learn/`) || url.startsWith(`${appBaseUrl}/remapped/`)) return 0.75;
  return 0.7;
}
