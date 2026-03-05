import type { Metadata } from "next";
import Link from "next/link";
import { BRAND_NAME } from "@/lib/site";

export const metadata: Metadata = {
  title: `${BRAND_NAME} | Generated Artifact`,
  description: "Generated artifact placeholder route.",
  robots: {
    index: false,
    follow: false,
  },
};

export default async function GeneratedArtifactPage({
  params,
}: {
  params: Promise<{ slug?: string[] }>;
}) {
  const { slug = [] } = await params;
  const safeParts = slug
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => part.replace(/[^a-zA-Z0-9._/-]/g, ""));
  const artifactPath = safeParts.length ? safeParts.join("/") : "unknown";
  const artifactName = safeParts[safeParts.length - 1] || "artifact";
  const extension = artifactName.includes(".") ? artifactName.split(".").pop()?.toLowerCase() : null;

  return (
    <main className="min-h-screen bg-[#0f111a] text-white flex items-center justify-center px-6 py-12">
      <div className="glass max-w-2xl w-full p-8 rounded-2xl border border-white/10">
        <h1 className="text-2xl font-semibold mb-3">Generated Artifact</h1>
        <p className="text-gray-300 mb-5">
          This artifact route is wired, but direct file delivery is not yet configured for this environment.
        </p>
        <div className="rounded-xl border border-white/10 bg-black/30 p-4 mb-6">
          <p className="text-xs uppercase tracking-wide text-gray-400 mb-2">Artifact Path</p>
          <p className="font-mono text-sm break-all">/generated/{artifactPath}</p>
          <p className="text-xs text-gray-400 mt-2">
            Type: {extension ? extension.toUpperCase() : "Unknown"}
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <Link className="btn btn-primary" href="/dashboard/projects">
            Back to Projects
          </Link>
          <Link className="btn btn-secondary" href="/">
            Go home
          </Link>
        </div>
      </div>
    </main>
  );
}
