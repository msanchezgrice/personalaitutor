import type { Metadata } from "next";
import Link from "next/link";
import { CareerTools } from "@/components/career-tools";
import { LearningHeader } from "@/components/learning-header";
import { LearningFooter } from "@/components/learning-footer";

export const metadata: Metadata = {
  title: "Free Career Remapping Tools: Skills, Resume and Project Plans | My AI Skill Tutor",
  description: "Map your past tasks to possible career directions, draft resume evidence, and plan a proof project. Five free browser exercises with downloadable notes and no account required.",
  alternates: { canonical: "/tools/career-remapping" },
  openGraph: { title: "Free Career Remapping Tools", description: "Map experience, draft honest project evidence, and choose a next step.", url: "/tools/career-remapping", type: "website" },
};

export default function CareerRemappingToolsPage() {
  return <>
    <main data-gemini-shell="1" className="gemini-light-shell learning-shell relative min-h-screen overflow-hidden pt-48 text-white md:pt-36">
      <LearningHeader active="learning" activeTab="career-proof" secondaryAction={{ href: "/learn", label: "All Guides" }} />
      <div className="container max-w-6xl py-12">
        <p className="mb-4 text-sm text-slate-600"><Link href="/learn" className="underline">Learning Journal</Link> / Career tools</p>
        <h1 className="max-w-4xl text-4xl font-semibold sm:text-6xl">Your next move starts with the work you already know.</h1>
        <p className="mb-10 mt-6 max-w-3xl text-xl leading-8 text-slate-600">Five practical exercises for a changing job market. Start with real tasks, investigate possible directions, and build evidence you can explain.</p>
        <CareerTools />
        <section aria-labelledby="career-guides-title" className="rounded-3xl border border-slate-200 bg-white p-6 text-slate-900 sm:p-8">
          <h2 id="career-guides-title" className="text-2xl font-semibold">Read the guides behind the exercises</h2>
          <ul className="mt-5 space-y-4 text-base leading-7">
            <li><Link className="text-emerald-800 underline" href="/learn/career-mapping-transferable-skills">Map old job titles to possible new directions</Link></li>
            <li><Link className="text-emerald-800 underline" href="/learn/ai-skills-for-resume">Reframe your resume around real AI skills and evidence</Link></li>
            <li><Link className="text-emerald-800 underline" href="/learn/my-job-is-disappearing">Choose a next step when your work is changing</Link></li>
            <li><Link className="text-emerald-800 underline" href="/learn/career-change-after-gaming-layoff">Restart your search after a gaming layoff</Link></li>
            <li><Link className="text-emerald-800 underline" href="/learn/how-to-get-a-job-in-the-age-of-ai">Build inspectable proof for an AI-era job search</Link></li>
          </ul>
        </section>
      </div>
    </main>
    <LearningFooter />
  </>;
}
