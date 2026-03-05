import type { Metadata } from "next";
import { GeminiStaticPage } from "@/components/gemini-static-page";
import { runtimeGetTalentByHandle } from "@/lib/runtime";
import {
  BRAND_NAME,
  BRAND_X_HANDLE,
  DEFAULT_OG_IMAGE_ALT,
  DEFAULT_OG_IMAGE_HEIGHT,
  DEFAULT_OG_IMAGE_PATH,
  DEFAULT_OG_IMAGE_WIDTH,
} from "@/lib/site";

function fallbackCandidate(handle: string) {
  if (handle !== "alex-chen-ai") return null;
  return {
    handle: "alex-chen-ai",
    name: "Alex Chen",
    avatarUrl: "/assets/avatar.png",
    careerType: "Employed",
    role: "Product Manager",
    status: "verified" as const,
    topSkills: ["Prompt Engineering", "API Integrations"],
    topTools: ["Python", "Cursor IDE"],
    evidenceScore: 83,
  };
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ handle: string }>;
}): Promise<Metadata> {
  const { handle } = await params;
  const candidate = (await runtimeGetTalentByHandle(handle)) ?? fallbackCandidate(handle);
  if (!candidate) {
    return {
      title: `${BRAND_NAME} | Candidate Not Found`,
      robots: {
        index: false,
        follow: false,
      },
    };
  }

  const title = `${candidate.name} | ${candidate.role} | ${BRAND_NAME} Talent`;
  const description = `Verified AI skill profile for ${candidate.name}: ${candidate.topSkills.join(
    ", ",
  )}. Tools: ${candidate.topTools.join(", ")}.`;
  const images: NonNullable<NonNullable<Metadata["openGraph"]>["images"]> = [{
    url: DEFAULT_OG_IMAGE_PATH,
    width: DEFAULT_OG_IMAGE_WIDTH,
    height: DEFAULT_OG_IMAGE_HEIGHT,
    alt: DEFAULT_OG_IMAGE_ALT,
    type: "image/png",
  }];
  if (candidate.avatarUrl) {
    images.push({
      url: candidate.avatarUrl,
      width: DEFAULT_OG_IMAGE_WIDTH,
      height: DEFAULT_OG_IMAGE_HEIGHT,
      alt: `${candidate.name} profile`,
    });
  }

  return {
    title,
    description,
    alternates: {
      canonical: `/employers/talent/${candidate.handle}`,
    },
    openGraph: {
      title,
      description,
      url: `/employers/talent/${candidate.handle}`,
      type: "profile",
      images,
    },
    twitter: {
      card: "summary_large_image",
      site: BRAND_X_HANDLE,
      creator: BRAND_X_HANDLE,
      title,
      description,
      images: [candidate.avatarUrl || DEFAULT_OG_IMAGE_PATH],
    },
  };
}

export default async function TalentDetailPage({ params }: { params: Promise<{ handle: string }> }) {
  const { handle } = await params;
  const candidate = (await runtimeGetTalentByHandle(handle)) ?? fallbackCandidate(handle);

  if (!candidate) {
    return (
      <main className="min-h-screen bg-[#0f111a] text-white p-10">
        <h1 className="text-2xl font-bold">Candidate not found</h1>
        <p className="text-gray-400 mt-2">Invalid handle for talent profile.</p>
      </main>
    );
  }

  const replacements: Record<string, string> = {
    "/u/alex-chen-ai/": `/u/${candidate.handle}/`,
    "Alex Chen": candidate.name,
    "Product Manager based in San Francisco, CA": `${candidate.role} (${candidate.careerType})`,
  };

  if (candidate.avatarUrl) {
    replacements["/assets/avatar.png"] = candidate.avatarUrl;
  }

  if (candidate.topSkills[0]) {
    replacements["Prompt Engineering"] = candidate.topSkills[0];
  }
  if (candidate.topSkills[1]) {
    replacements["Python Scripting"] = candidate.topSkills[1];
  }
  if (candidate.topTools[0]) {
    replacements["Cursor IDE"] = candidate.topTools[0];
  }

  return <GeminiStaticPage template="employers/talent/alex-chen-ai/index.html" replacements={replacements} />;
}
