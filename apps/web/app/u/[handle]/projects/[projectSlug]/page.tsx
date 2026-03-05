import type { Metadata } from "next";
import { GeminiStaticPage } from "@/components/gemini-static-page";
import { runtimeFindProjectBySlug, runtimeFindUserByHandle } from "@/lib/runtime";
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

export async function generateMetadata({ params }: { params: Promise<{ handle: string; projectSlug: string }> }): Promise<Metadata> {
  const { handle, projectSlug } = await params;
  const profile = await runtimeFindUserByHandle(handle);
  const project = await runtimeFindProjectBySlug(projectSlug);

  if (!profile || !profile.published || !project || project.userId !== profile.id) {
    if (handle === "alex-chen-ai" && projectSlug === "customer-support-copilot") {
      return {
        title: `Customer Support Copilot | Alex Chen | ${BRAND_NAME}`,
        description: "Customer Support Copilot build log and active implementation proof.",
      };
    }
    return {
      title: "Project not found",
      robots: {
        index: false,
        follow: false,
      },
    };
  }

  return {
    title: `${project.title} | ${profile.name}`,
    description: project.description,
    alternates: { canonical: `/u/${handle}/projects/${projectSlug}` },
    openGraph: {
      title: `${project.title} | project proof`,
      description: `System-Verified project proof for ${project.title}`,
      url: `/u/${handle}/projects/${projectSlug}`,
      type: "article",
      images: [
        {
          url: DEFAULT_OG_IMAGE_PATH,
          width: DEFAULT_OG_IMAGE_WIDTH,
          height: DEFAULT_OG_IMAGE_HEIGHT,
          alt: DEFAULT_OG_IMAGE_ALT,
          type: "image/png",
        },
        {
          url: `/api/og/project/${handle}/${projectSlug}`,
          width: DEFAULT_OG_IMAGE_WIDTH,
          height: DEFAULT_OG_IMAGE_HEIGHT,
          alt: `${project.title} project preview`,
          type: "image/svg+xml",
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      site: BRAND_X_HANDLE,
      creator: BRAND_X_HANDLE,
      title: `${project.title} | project proof`,
      description: project.description,
      images: [DEFAULT_OG_IMAGE_PATH],
    },
  };
}

export default async function PublicProjectPage({ params }: { params: Promise<{ handle: string; projectSlug: string }> }) {
  const { handle, projectSlug } = await params;
  const profile = await runtimeFindUserByHandle(handle);
  const project = await runtimeFindProjectBySlug(projectSlug);

  if (!profile || !profile.published || !project || project.userId !== profile.id) {
    if (handle === "alex-chen-ai" && projectSlug === "customer-support-copilot") {
      return <GeminiStaticPage template="u/alex-chen-ai/projects/customer-support-copilot/index.html" />;
    }
    return notFound();
  }

  const replacements: Record<string, string> = {
    "/u/alex-chen-ai/": `/u/${profile.handle}/`,
    "Alex Chen": escapeHtml(profile.name),
    "Customer Support Copilot": escapeHtml(project.title),
    "An automated email responder using RAG to fetch CRM context before drafting replies. Designed to reduce manual ticket triaging time by 60%.": escapeHtml(project.description),
  };

  const avatarUrl = safeHttpUrl(profile.avatarUrl ?? undefined);
  if (avatarUrl) {
    replacements["/assets/avatar.png"] = avatarUrl;
  }

  const creativeWorkLd = {
    "@context": "https://schema.org",
    "@type": "CreativeWork",
    name: project.title,
    description: project.description,
    url: `${appBaseUrl()}/u/${handle}/projects/${projectSlug}`,
    creator: {
      "@type": "Person",
      name: profile.name,
    },
  };

  return (
    <>
      <GeminiStaticPage
        template="u/alex-chen-ai/projects/customer-support-copilot/index.html"
        replacements={replacements}
      />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(creativeWorkLd) }} />
    </>
  );
}
