import type { Metadata } from "next";
import { GeminiStaticPage } from "@/components/gemini-static-page";
import { runtimeFindProjectBySlug, runtimeFindUserByHandle } from "@/lib/runtime";
import { BRAND_NAME, getSiteUrl } from "@/lib/site";

export const dynamic = "force-dynamic";

function appBaseUrl() {
  return getSiteUrl();
}

export async function generateMetadata({ params }: { params: Promise<{ handle: string; projectSlug: string }> }): Promise<Metadata> {
  const { handle, projectSlug } = await params;
  const profile = await runtimeFindUserByHandle(handle);
  const project = await runtimeFindProjectBySlug(projectSlug);

  if (!profile || !project || project.userId !== profile.id) {
    if (handle === "alex-chen-ai" && projectSlug === "customer-support-copilot") {
      return {
        title: `Customer Support Copilot | Alex Chen | ${BRAND_NAME}`,
        description: "Customer Support Copilot build log and active implementation proof.",
      };
    }
    return { title: "Project not found" };
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
      images: [{ url: `/api/og/project/${handle}/${projectSlug}` }],
    },
    twitter: {
      card: "summary_large_image",
      title: `${project.title} | project proof`,
      description: project.description,
      images: [`/api/og/project/${handle}/${projectSlug}`],
    },
  };
}

export default async function PublicProjectPage({ params }: { params: Promise<{ handle: string; projectSlug: string }> }) {
  const { handle, projectSlug } = await params;
  const profile = await runtimeFindUserByHandle(handle);
  const project = await runtimeFindProjectBySlug(projectSlug);

  if (!profile || !project || project.userId !== profile.id) {
    if (handle === "alex-chen-ai" && projectSlug === "customer-support-copilot") {
      return <GeminiStaticPage template="u/alex-chen-ai/projects/customer-support-copilot/index.html" />;
    }
    return (
      <main className="min-h-screen bg-[#0f111a] text-white p-10">
        <h1 className="text-2xl font-bold">Project not found</h1>
        <p className="text-gray-400 mt-2">The requested project does not exist for this profile.</p>
      </main>
    );
  }

  const replacements: Record<string, string> = {
    "/u/alex-chen-ai/": `/u/${profile.handle}/`,
    "Alex Chen": profile.name,
    "Customer Support Copilot": project.title,
    "An automated email responder using RAG to fetch CRM context before drafting replies. Designed to reduce manual ticket triaging time by 60%.": project.description,
  };

  if (profile.avatarUrl) {
    replacements["/assets/avatar.png"] = profile.avatarUrl;
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
