import type { Metadata } from "next";
import { GeminiStaticPage } from "@/components/gemini-static-page";
import { runtimeFindUserByHandle, runtimeListProjectsByUser } from "@/lib/runtime";
import { BRAND_NAME, getSiteUrl } from "@/lib/site";

function appBaseUrl() {
  return getSiteUrl();
}

export async function generateMetadata({ params }: { params: Promise<{ handle: string }> }): Promise<Metadata> {
  const { handle } = await params;
  const profile = await runtimeFindUserByHandle(handle);
  if (!profile) {
    if (handle === "alex-chen-ai") {
      return {
        title: `Alex Chen | Verified AI Builder Profile | ${BRAND_NAME}`,
        description: "View mapped skills, built projects, and verified AI implementation experience.",
        openGraph: {
          title: `Alex Chen - Verified AI Builder Profile | ${BRAND_NAME}`,
          description: "View mapped skills, built projects, and verified AI implementation experience.",
          url: "/u/alex-chen-ai",
          type: "profile",
          images: [{ url: "/assets/interface_macro_mockup.png" }],
        },
      };
    }
    return { title: "Profile not found" };
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
      images: [{ url: `/api/og/profile/${profile.handle}` }],
    },
    twitter: {
      card: "summary_large_image",
      title: `${profile.name} | ${BRAND_NAME} Profile`,
      description: profile.bio,
      images: [`/api/og/profile/${profile.handle}`],
    },
  };
}

export default async function PublicProfilePage({ params }: { params: Promise<{ handle: string }> }) {
  const { handle } = await params;
  const profile = await runtimeFindUserByHandle(handle);

  if (!profile) {
    if (handle === "alex-chen-ai") {
      return <GeminiStaticPage template="u/alex-chen-ai/index.html" />;
    }
    return (
      <main className="min-h-screen bg-[#0f111a] text-white p-10">
        <h1 className="text-2xl font-bold">Profile not found</h1>
        <p className="text-gray-400 mt-2">The requested handle does not exist.</p>
      </main>
    );
  }

  const projects = await runtimeListProjectsByUser(profile.id);
  const firstProject = projects[0];
  const secondProject = projects[1];

  const replacements: Record<string, string> = {
    "/u/alex-chen-ai/": `/u/${profile.handle}/`,
    "Alex Chen": profile.name,
    "Product Manager": profile.headline || "AI Builder",
    "I'm a PM learning how to automate workflows and build prototypes using AI. Building publicly to track my journey from non-technical to AI-fluent. Demonstrated ability to use Cursor, Python, and external APIs to build functional prototype workflows.": profile.bio,
  };

  if (firstProject) {
    replacements["/u/alex-chen-ai/projects/customer-support-copilot/"] = `/u/${profile.handle}/projects/${firstProject.slug}/`;
    replacements["Customer Support Copilot"] = firstProject.title;
  }

  if (secondProject) {
    replacements["Lead Scraper Pro"] = secondProject.title;
  }

  if (profile.avatarUrl) {
    replacements["/assets/avatar.png"] = profile.avatarUrl;
  }

  if (profile.socialLinks.linkedin) {
    replacements[
      'href="#" class="hover:text-white transition"><i class="fa-brands fa-linkedin text-[#0077b5] mr-1"></i> LinkedIn</a>'
    ] = `href="${profile.socialLinks.linkedin}" target="_blank" rel="noreferrer" class="hover:text-white transition"><i class="fa-brands fa-linkedin text-[#0077b5] mr-1"></i> LinkedIn</a>`;
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
