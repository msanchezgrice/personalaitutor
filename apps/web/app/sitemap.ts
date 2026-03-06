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
import { getSiteUrl } from "@/lib/site";

const appBaseUrl = getSiteUrl();

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();
  const learnArticles = getLearnArticles();
  const learnLastModified = new Map(
    learnArticles.map((article) => [`${appBaseUrl}/learn/${article.slug}`, new Date(`${article.updatedAt}T12:00:00Z`)]),
  );
  const urls = new Set<string>([
    `${appBaseUrl}/`,
    `${appBaseUrl}/employers`,
    `${appBaseUrl}/employers/talent`,
    `${appBaseUrl}/learn`,
    `${appBaseUrl}/u/${EXAMPLE_PROFILE_HANDLE}`,
  ]);

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

  return [...urls].map((url) => ({
    url,
    lastModified: learnLastModified.get(url) ?? now,
    changeFrequency: url.includes("/u/") ? "daily" : "weekly",
    priority:
      url === `${appBaseUrl}/`
        ? 1
        : url === `${appBaseUrl}/learn`
          ? 0.8
          : url.startsWith(`${appBaseUrl}/learn/`)
            ? 0.75
            : 0.7,
  }));
}
