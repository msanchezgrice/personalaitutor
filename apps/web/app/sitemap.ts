import type { MetadataRoute } from "next";
import {
  runtimeFindUserByHandle,
  runtimeListProjectsByUser,
  runtimeListTalent,
} from "@/lib/runtime";
import { getSiteUrl } from "@/lib/site";

const appBaseUrl = getSiteUrl();

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();
  const urls = new Set<string>([
    `${appBaseUrl}/`,
    `${appBaseUrl}/assessment`,
    `${appBaseUrl}/employers`,
    `${appBaseUrl}/employers/talent`,
  ]);

  try {
    const talentRows = await runtimeListTalent();
    const handles = [...new Set(talentRows.map((row) => row.handle).filter(Boolean))].slice(0, 200);
    await Promise.all(
      handles.map(async (handle) => {
        urls.add(`${appBaseUrl}/employers/talent/${handle}`);
        urls.add(`${appBaseUrl}/u/${handle}`);

        const profile = await runtimeFindUserByHandle(handle);
        if (!profile || !profile.published) return;
        const projects = await runtimeListProjectsByUser(profile.id);
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
    lastModified: now,
    changeFrequency: url.includes("/u/") ? "daily" : "weekly",
    priority: url === `${appBaseUrl}/` ? 1 : 0.7,
  }));
}
