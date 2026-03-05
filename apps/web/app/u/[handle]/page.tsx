import type { Metadata } from "next";
import { GeminiStaticPage } from "@/components/gemini-static-page";
import { runtimeFindUserByHandle, runtimeListProjectsByUser } from "@/lib/runtime";
import { notFound } from "next/navigation";
import {
  BRAND_NAME,
  BRAND_X_HANDLE,
  DEFAULT_OG_IMAGE_ALT,
  DEFAULT_OG_IMAGE_HEIGHT,
  DEFAULT_OG_IMAGE_PATH,
  DEFAULT_OG_IMAGE_WIDTH,
  getSiteUrl,
} from "@/lib/site";

export const revalidate = 300;

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function safeHttpUrl(value: string | undefined) {
  if (!value) return null;
  try {
    const parsed = new URL(value);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return null;
    return parsed.toString();
  } catch {
    return null;
  }
}

function appBaseUrl() {
  return getSiteUrl();
}

export async function generateMetadata({ params }: { params: Promise<{ handle: string }> }): Promise<Metadata> {
  const { handle } = await params;
  const profile = await runtimeFindUserByHandle(handle);
  if (!profile || !profile.published) {
    if (handle === "alex-chen-ai") {
      return {
        title: `Alex Chen | Verified AI Builder Profile | ${BRAND_NAME}`,
        description: "View mapped skills, built projects, and verified AI implementation experience.",
        openGraph: {
          title: `Alex Chen - Verified AI Builder Profile | ${BRAND_NAME}`,
          description: "View mapped skills, built projects, and verified AI implementation experience.",
          url: "/u/alex-chen-ai",
          type: "profile",
          images: [{
            url: DEFAULT_OG_IMAGE_PATH,
            width: DEFAULT_OG_IMAGE_WIDTH,
            height: DEFAULT_OG_IMAGE_HEIGHT,
            alt: DEFAULT_OG_IMAGE_ALT,
            type: "image/png",
          }],
        },
        twitter: {
          card: "summary_large_image",
          site: BRAND_X_HANDLE,
          creator: BRAND_X_HANDLE,
          title: `Alex Chen - Verified AI Builder Profile | ${BRAND_NAME}`,
          description: "View mapped skills, built projects, and verified AI implementation experience.",
          images: [DEFAULT_OG_IMAGE_PATH],
        },
      };
    }
    return {
      title: "Profile not found",
      robots: {
        index: false,
        follow: false,
      },
    };
  }

  return {
    title: `${profile.name} | ${BRAND_NAME} Profile`,
    description: profile.bio,
    alternates: { canonical: `/u/${profile.handle}` },
    openGraph: {
      title: `${profile.name} | ${BRAND_NAME} Profile`,
      description: profile.bio,
      url: `/u/${profile.handle}`,
      type: "profile",
      images: [
        {
          url: DEFAULT_OG_IMAGE_PATH,
          width: DEFAULT_OG_IMAGE_WIDTH,
          height: DEFAULT_OG_IMAGE_HEIGHT,
          alt: DEFAULT_OG_IMAGE_ALT,
          type: "image/png",
        },
        {
          url: `/api/og/profile/${profile.handle}`,
          width: DEFAULT_OG_IMAGE_WIDTH,
          height: DEFAULT_OG_IMAGE_HEIGHT,
          alt: `${profile.name} profile preview`,
          type: "image/svg+xml",
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      site: BRAND_X_HANDLE,
      creator: BRAND_X_HANDLE,
      title: `${profile.name} | ${BRAND_NAME} Profile`,
      description: profile.bio,
      images: [DEFAULT_OG_IMAGE_PATH],
    },
  };
}

export default async function PublicProfilePage({ params }: { params: Promise<{ handle: string }> }) {
  const { handle } = await params;
  const profile = await runtimeFindUserByHandle(handle);

  if (!profile || !profile.published) {
    if (handle === "alex-chen-ai") {
      return <GeminiStaticPage template="u/alex-chen-ai/index.html" />;
    }
    return notFound();
  }

  const projects = await runtimeListProjectsByUser(profile.id);
  const firstProject = projects[0];
  const secondProject = projects[1];

  const replacements: Record<string, string> = {
    "/u/alex-chen-ai/": `/u/${profile.handle}/`,
    "/u/alex-chen-ai": `/u/${profile.handle}/`,
    "Alex Chen": escapeHtml(profile.name),
    "Product Manager": escapeHtml(profile.headline || "AI Builder"),
    "Contact Alex": escapeHtml(`Contact ${profile.name.split(" ")[0] || profile.name}`),
    "I'm a PM learning how to automate workflows and build prototypes using AI. Building publicly to track my journey from non-technical to AI-fluent. Demonstrated ability to use Cursor, Python, and external APIs to build functional prototype workflows.": escapeHtml(profile.bio),
  };

  if (firstProject) {
    replacements["/u/alex-chen-ai/projects/customer-support-copilot/"] = `/u/${profile.handle}/projects/${firstProject.slug}/`;
    replacements["Customer Support Copilot"] = escapeHtml(firstProject.title);
  }

  if (secondProject) {
    replacements["Lead Scraper Pro"] = escapeHtml(secondProject.title);
  }

  if (safeHttpUrl(profile.avatarUrl ?? undefined)) {
    replacements["/assets/avatar.png"] = safeHttpUrl(profile.avatarUrl ?? undefined) as string;
  }

  const linkedInUrl = safeHttpUrl(profile.socialLinks.linkedin);
  if (linkedInUrl) {
    replacements[
      'href="#" class="hover:text-white transition"><i class="fa-brands fa-linkedin text-[#0077b5] mr-1"></i> LinkedIn</a>'
    ] = `href="${linkedInUrl}" target="_blank" rel="noreferrer" class="hover:text-white transition"><i class="fa-brands fa-linkedin text-[#0077b5] mr-1"></i> LinkedIn</a>`;
    replacements[
      'href="#" class="hover:text-gray-300 transition"><i class="fa-brands fa-linkedin text-[#0077b5] mr-1"></i> LinkedIn</a>'
    ] = `href="${linkedInUrl}" target="_blank" rel="noreferrer" class="hover:text-gray-300 transition"><i class="fa-brands fa-linkedin text-[#0077b5] mr-1"></i> LinkedIn</a>`;
  }

  const personLd = {
    "@context": "https://schema.org",
    "@type": "Person",
    name: profile.name,
    description: profile.headline,
    url: `${appBaseUrl()}/u/${profile.handle}`,
    sameAs: Object.values(profile.socialLinks).filter(Boolean),
    knowsAbout: profile.skills.map((entry) => entry.skill),
  };

  return (
    <>
      <GeminiStaticPage template="u/alex-chen-ai/index.html" replacements={replacements} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(personLd) }} />
    </>
  );
}
