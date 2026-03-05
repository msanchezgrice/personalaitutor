import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import Script from "next/script";
import { BRAND_NAME } from "@/lib/site";

type GeminiStaticPageProps = {
  template: string;
  replacements?: Record<string, string>;
  className?: string;
  runtime?: "full" | "none";
};

const templateCache = new Map<string, { className: string; body: string }>();

function sanitizeTemplateHtml(input: string) {
  return input
    .replace(/\r\n?/g, "\n")
    .replace(/\u0001/g, "")
    .replace(/\\1/g, "")
    .replace(/\\n/g, "\n")
    .replace(/\\t/g, "\t");
}

function stripScripts(input: string) {
  return input.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, "");
}

function sanitizeTemplateBody(template: string, input: string) {
  let output = input;

  if (template === "dashboard/index.html") {
    output = output.replace(
      /<div class="p-10 max-w-6xl mx-auto w-full pb-24">[\s\S]*?<\/div>\s*<\/main>/i,
      `<div class="p-10 max-w-6xl mx-auto w-full pb-24">
            <div
                class="glass-panel p-6 rounded-2xl mb-8 flex flex-col md:flex-row items-center justify-between gap-6 border border-emerald-500/30 overflow-hidden relative">
                <div
                    class="absolute right-0 top-0 w-64 h-full bg-gradient-to-l from-emerald-500/10 to-transparent pointer-events-none">
                </div>
                <div class="flex items-center gap-4 relative z-10">
                    <div class="w-12 h-12 rounded-full border-2 border-emerald-500 p-1">
                        <div
                            class="w-full h-full bg-emerald-500 rounded-full flex items-center justify-center">
                            <i class="fa-solid fa-robot text-white text-xl"></i>
                        </div>
                    </div>
                    <div>
                        <h3 class="text-lg font-medium text-white mb-1"><span class="text-emerald-400">Today&apos;s update:</span> Loading your tutor summary...</h3>
                        <p class="text-sm text-gray-400">Continue where we left off: Loading your latest project context.</p>
                    </div>
                </div>
                <a href="/dashboard/chat/" class="btn btn-primary whitespace-nowrap relative z-10">Continue where we left off</a>
            </div>

            <div class="grid lg:grid-cols-3 gap-8">
                <div class="lg:col-span-2 space-y-8">
                    <section>
                        <div class="flex justify-between items-end mb-4">
                            <h2 class="text-lg font-[Outfit] font-medium text-white flex items-center gap-2"><i
                                    class="fa-solid fa-folder-open text-amber-400"></i> Active Projects</h2>
                            <a href="/dashboard/projects/" class="text-xs text-emerald-400 hover:text-emerald-300">View All</a>
                        </div>
                        <div class="grid sm:grid-cols-2 gap-4">
                            <a href="/dashboard/projects/"
                                class="glass p-5 rounded-xl hover:bg-white/5 border border-white/10 hover:border-emerald-500/40 transition group cursor-pointer block">
                                <div class="flex justify-between items-start mb-4">
                                    <div
                                        class="w-10 h-10 rounded bg-blue-500/20 text-blue-400 flex items-center justify-center text-lg">
                                        <i class="fa-solid fa-layer-group"></i></div>
                                    <span
                                        class="text-[10px] font-bold uppercase tracking-wider bg-amber-500/20 text-amber-500 px-2 py-1 rounded">Loading</span>
                                </div>
                                <h3 class="font-medium text-white mb-1 group-hover:text-emerald-400 transition-colors">Loading active project...</h3>
                                <p class="text-xs text-gray-400 mb-4 line-clamp-2">Fetching your first active module or project.</p>
                                <div class="w-full bg-black/40 h-1.5 rounded-full">
                                    <div class="bg-emerald-500 w-[20%] h-full rounded-full"></div>
                                </div>
                            </a>
                            <a href="/dashboard/projects/"
                                class="glass p-5 rounded-xl hover:bg-white/5 border border-emerald-500/30 bg-emerald-500/5 transition group cursor-pointer block relative overflow-hidden">
                                <div class="flex justify-between items-start mb-4 relative z-10">
                                    <div
                                        class="w-10 h-10 rounded bg-teal-500/20 text-teal-400 flex items-center justify-center text-lg">
                                        <i class="fa-solid fa-award"></i></div>
                                    <span
                                        class="text-[10px] font-bold uppercase tracking-wider bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 px-2 py-1 rounded">Syncing</span>
                                </div>
                                <h3 class="font-medium text-white mb-1 relative z-10">Latest proof artifact</h3>
                                <p class="text-xs text-gray-400 mb-4 line-clamp-2 relative z-10">Completed work appears here after the dashboard sync finishes.</p>
                                <div
                                    class="text-xs text-emerald-400 flex items-center gap-1 font-medium mt-auto relative z-10">
                                    <i class="fa-solid fa-award"></i> Proof syncing
                                </div>
                            </a>
                        </div>
                    </section>

                    <section>
                        <h2 class="text-lg font-[Outfit] font-medium text-white mb-4 flex items-center gap-2"><i
                                class="fa-solid fa-layer-group text-teal-400"></i> Verified Skill Stack</h2>
                        <div class="glass p-6 rounded-xl flex flex-wrap gap-2">
                            <div class="flex border border-emerald-500/30 bg-emerald-500/10 rounded-full items-center px-3 py-1.5">
                                <span class="text-xs font-medium text-emerald-400">Loading verified skills...</span>
                            </div>
                            <div class="flex border border-white/10 bg-white/5 rounded-full items-center px-3 py-1.5">
                                <span class="text-xs text-gray-300">Skills sync after hydration</span>
                            </div>
                            <div class="flex border border-white/5 border-dashed bg-transparent rounded-full items-center px-3 py-1.5">
                                <span class="text-xs text-gray-500"><i class="fa-solid fa-plus mr-1"></i> Add Target Skill</span>
                            </div>
                        </div>
                    </section>
                </div>

                <div class="space-y-8">
                    <section>
                        <div class="flex justify-between items-end mb-4">
                            <h2 class="text-lg font-[Outfit] font-medium text-white flex items-center gap-2"><i
                                    class="fa-brands fa-linkedin text-[#0077b5]"></i> Social Drafts</h2>
                        </div>
                        <div
                            class="glass border border-[#0077b5]/30 bg-gradient-to-b from-[#0077b5]/10 to-transparent p-5 rounded-xl">
                            <div class="flex items-center gap-2 mb-3">
                                <span class="runtime-loader-spinner runtime-loader-spinner-sm"></span>
                                <span class="text-xs font-medium text-[#0077b5] uppercase tracking-wider">Preparing today&apos;s draft</span>
                            </div>
                            <p class="text-sm text-gray-300 mb-4 italic border-l-2 border-[#0077b5] pl-3 py-1 bg-black/20 rounded-r">"Generating today&apos;s first-person social draft from your current project context."</p>
                            <a href="/dashboard/social/"
                                class="btn bg-[#0077b5] hover:bg-[#005582] text-white w-full py-2 text-sm">Open Social Drafts</a>
                        </div>
                    </section>

                    <section data-home-ai-news="1">
                        <div class="flex justify-between items-end mb-4">
                            <h2 class="text-lg font-[Outfit] font-medium text-white flex items-center gap-2"><i
                                    class="fa-solid fa-newspaper text-sky-400"></i> AI News</h2>
                            <a href="/dashboard/ai-news/" class="text-xs text-sky-300 hover:text-sky-200">View all</a>
                        </div>
                        <div class="space-y-3">
                            <a href="/dashboard/ai-news/"
                                class="block glass p-4 rounded-xl border border-sky-500/20 bg-sky-500/5 hover:bg-white/5 transition flex gap-3">
                                <div class="w-8 h-8 rounded shrink-0 bg-sky-500/20 flex items-center justify-center text-sky-400">
                                    <span class="runtime-loader-spinner runtime-loader-spinner-sm"></span>
                                </div>
                                <div>
                                    <h4 class="font-medium text-white text-sm mb-0.5">Preparing AI News</h4>
                                    <p class="text-xs text-gray-400 line-clamp-2">Fetching and caching today&apos;s personalized AI stories for this session.</p>
                                </div>
                            </a>
                            <a href="/dashboard/ai-news/"
                                class="block glass p-4 rounded-xl border border-sky-500/20 bg-sky-500/5 hover:bg-white/5 transition flex gap-3">
                                <div class="w-8 h-8 rounded shrink-0 bg-sky-500/20 flex items-center justify-center text-sky-400">
                                    <i class="fa-solid fa-wave-square text-xs"></i>
                                </div>
                                <div>
                                    <h4 class="font-medium text-white text-sm mb-0.5">Session cache warming</h4>
                                    <p class="text-xs text-gray-400 line-clamp-2">The feed is prepared in the background so the AI News tab opens warm.</p>
                                </div>
                            </a>
                        </div>
                    </section>
                </div>
            </div>
        </div>
    </main>`,
    );
  }

  if (template === "dashboard/chat/index.html") {
    output = output.replace(
      /<div class="flex-1 overflow-y-auto p-6 md:p-10 space-y-6 custom-scrollbar">[\s\S]*?<\/div>\s*<!-- Chat Input Area -->/i,
      `<div class="flex-1 overflow-y-auto p-6 md:p-10 space-y-6 custom-scrollbar">
            <div class="flex justify-center">
                <span
                    class="text-[10px] text-gray-500 uppercase tracking-widest font-semibold px-4 py-1 rounded-full bg-black/20 border border-white/5">Today</span>
            </div>
            <div class="flex items-start gap-4 max-w-4xl">
                <div
                    class="w-8 h-8 rounded-full bg-gradient-to-b from-emerald-500 to-teal-600 flex items-center justify-center flex-shrink-0 mt-1 shadow-[0_0_10px_rgba(16,185,129,0.3)]">
                    <i class="fa-solid fa-robot text-white text-[10px]"></i>
                </div>
                <div class="glass p-5 rounded-2xl rounded-tl-sm text-sm border-emerald-500/20 bg-emerald-500/5">
                    <p>Loading your latest tutor session...</p>
                </div>
            </div>
        </div>

        <!-- Chat Input Area -->`,
    );
  }

  if (template === "dashboard/social/index.html") {
    output = output.replace(
      /<div class="p-10 max-w-4xl mx-auto w-full pb-24 space-y-8">[\s\S]*?<\/div>\s*<\/main>/i,
      `<div class="p-10 max-w-4xl mx-auto w-full pb-24 space-y-8">
            <section class="glass p-6 md:p-8 rounded-2xl border border-white/10 bg-white/5 runtime-social-shell">
                <div class="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
                    <div>
                        <h2 class="text-lg font-[Outfit] font-semibold text-slate-900">Social Drafts</h2>
                        <p class="text-xs text-slate-600 mt-1">Generating today's first-person LinkedIn and Tweet drafts.</p>
                    </div>
                    <div class="inline-flex items-center gap-2 text-xs text-slate-600">
                        <span class="runtime-loader-spinner runtime-loader-spinner-sm"></span>
                        <span>Building drafts from your active project</span>
                    </div>
                </div>
                <div class="grid gap-4 md:grid-cols-2">
                    <div class="rounded-xl border border-[#0a66c2]/30 bg-[#eef5ff] p-4 runtime-social-card runtime-social-card-linkedin">
                        <div class="h-4 w-24 rounded bg-slate-200 animate-pulse mb-3"></div>
                        <div class="space-y-2">
                            <div class="h-3 rounded bg-slate-200 animate-pulse"></div>
                            <div class="h-3 rounded bg-slate-200 animate-pulse"></div>
                            <div class="h-3 w-5/6 rounded bg-slate-200 animate-pulse"></div>
                        </div>
                    </div>
                    <div class="rounded-xl border border-slate-300 bg-slate-50 p-4 runtime-social-card runtime-social-card-x">
                        <div class="h-4 w-20 rounded bg-slate-200 animate-pulse mb-3"></div>
                        <div class="space-y-2">
                            <div class="h-3 rounded bg-slate-200 animate-pulse"></div>
                            <div class="h-3 rounded bg-slate-200 animate-pulse"></div>
                            <div class="h-3 w-4/5 rounded bg-slate-200 animate-pulse"></div>
                        </div>
                    </div>
                </div>
            </section>
        </div>
    </main>`,
    );
  }

  if (template === "dashboard/projects/index.html") {
    output = output.replace(
      /<div class="p-10 max-w-6xl mx-auto w-full pb-24 space-y-12">[\s\S]*?<\/div>\s*<\/main>/i,
      `<div class="p-10 max-w-6xl mx-auto w-full pb-24 space-y-12">
            <section>
                <h2 class="text-lg font-[Outfit] font-medium text-white mb-6 uppercase tracking-wider text-sm text-gray-400 border-b border-white/10 pb-2">
                    Active Builds</h2>

                <a href="/dashboard/chat/"
                    class="glass-panel p-6 rounded-2xl flex flex-col md:flex-row items-center justify-between gap-6 border border-amber-500/30 overflow-hidden relative cursor-pointer hover:bg-white/5 transition">
                    <div class="absolute right-0 top-0 w-64 h-full bg-gradient-to-l from-amber-500/5 to-transparent pointer-events-none"></div>
                    <div class="flex items-center gap-6 relative z-10">
                        <div
                            class="w-16 h-16 rounded-xl border border-amber-500/50 p-1 flex-shrink-0 bg-black/40 shadow-[0_0_15px_rgba(251,191,36,0.2)] flex items-center justify-center">
                            <i class="fa-solid fa-spinner fa-spin text-3xl text-amber-400"></i>
                        </div>
                        <div>
                            <div class="flex gap-2 items-center mb-1">
                                <h3 class="text-xl font-medium text-white">Loading active build...</h3>
                                <span class="text-[10px] bg-amber-500/20 text-amber-500 font-bold uppercase px-2 py-0.5 rounded border border-amber-500/30">Syncing</span>
                            </div>
                            <p class="text-sm text-gray-400 max-w-xl">Fetching your live projects and progress from the latest dashboard summary.</p>
                        </div>
                    </div>
                    <div class="relative w-16 h-16 mr-4 flex-shrink-0 flex items-center justify-center text-xs font-bold text-amber-400">
                        ...
                    </div>
                </a>
            </section>

            <section>
                <h2 class="text-lg font-[Outfit] font-medium text-white mb-6 uppercase tracking-wider text-sm text-gray-400 border-b border-white/10 pb-2">
                    Completed & Published Proof</h2>

                <div class="grid md:grid-cols-2 gap-6">
                    <div class="glass flex flex-col p-6 rounded-xl border border-emerald-500/30 bg-emerald-500/5 relative overflow-hidden h-full">
                        <div class="flex justify-between items-start mb-4 relative z-10">
                            <div class="w-12 h-12 rounded-xl bg-teal-500/20 text-teal-400 flex items-center justify-center text-xl">
                                <i class="fa-solid fa-award"></i>
                            </div>
                            <div class="flex items-center gap-2">
                                <span class="text-[10px] font-bold uppercase tracking-wider bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 px-2 py-1 rounded">Syncing</span>
                            </div>
                        </div>
                        <h3 class="text-lg font-medium text-white mb-2 relative z-10">Loading completed projects...</h3>
                        <p class="text-sm text-gray-400 mb-6 flex-grow relative z-10">Published proof appears here after the project summary loads.</p>
                    </div>
                    <div class="glass flex flex-col p-6 rounded-xl border border-emerald-500/30 bg-emerald-500/5 relative overflow-hidden h-full">
                        <div class="flex justify-between items-start mb-4 relative z-10">
                            <div class="w-12 h-12 rounded-xl bg-cyan-500/20 text-cyan-400 flex items-center justify-center text-xl">
                                <i class="fa-solid fa-diagram-project"></i>
                            </div>
                            <div class="flex items-center gap-2">
                                <span class="text-[10px] font-bold uppercase tracking-wider bg-white/10 text-gray-300 border border-white/10 px-2 py-1 rounded">Waiting</span>
                            </div>
                        </div>
                        <h3 class="text-lg font-medium text-white mb-2 relative z-10">Next proof artifact</h3>
                        <p class="text-sm text-gray-400 mb-6 flex-grow relative z-10">Additional work appears here when another project is completed.</p>
                    </div>
                </div>
            </section>
        </div>
    </main>`,
    );
  }

  if (template === "dashboard/ai-news/index.html") {
    output = output.replace(
      /<div class="p-10 max-w-4xl mx-auto w-full pb-24 space-y-4">[\s\S]*?<\/div>\s*<\/main>/i,
      `<div class="p-10 max-w-4xl mx-auto w-full pb-24 space-y-4">
            <section class="glass p-6 rounded-xl border border-sky-300 bg-sky-50 runtime-loading-panel">
                <div class="flex items-center gap-3 text-sky-900 mb-2">
                    <span class="runtime-loader-spinner"></span>
                    <span class="font-semibold">Preparing today's AI news briefing</span>
                </div>
                <p class="text-sm text-slate-700">Fetching and caching personalized stories for this session.</p>
            </section>
        </div>
    </main>`,
    );
  }

  if (template === "dashboard/updates/index.html") {
    output = output.replace(
      /<div class="p-10 max-w-4xl mx-auto w-full pb-24 space-y-4">[\s\S]*?<\/div>\s*<\/main>/i,
      `<div class="p-10 max-w-4xl mx-auto w-full pb-24 space-y-4">
            <section class="glass p-6 rounded-xl border border-slate-300 bg-slate-50 runtime-loading-panel">
                <div class="flex items-center gap-3 text-slate-900 mb-2">
                    <span class="runtime-loader-spinner"></span>
                    <span class="font-semibold">Loading live activity</span>
                </div>
                <p class="text-sm text-slate-700">Pulling your latest tutor events and daily update.</p>
            </section>
        </div>
    </main>`,
    );
  }

  if (template === "dashboard/profile/index.html") {
    output = output.replace(
      /<div class="p-10 max-w-3xl mx-auto w-full pb-24 space-y-8">[\s\S]*?<\/div>\s*<\/main>/i,
      `<div class="p-10 max-w-3xl mx-auto w-full pb-24 space-y-8">
            <div class="glass p-8 w-full rounded-2xl">
                <h2 class="text-white font-[Outfit] text-lg mb-6 border-b border-white/10 pb-2">Basic Information</h2>
                <div class="flex items-center gap-6 mb-8">
                    <div class="relative inline-block">
                        <div class="w-24 h-24 rounded-full border-4 border-black box-content shadow-[0_0_20px_rgba(16,185,129,0.2)] bg-white/10 flex items-center justify-center">
                            <span class="runtime-loader-spinner"></span>
                        </div>
                    </div>
                    <div>
                        <h3 class="text-white text-lg font-medium">Loading profile...</h3>
                        <p class="text-sm text-gray-400 text-emerald-400 mb-2">Syncing your latest identity data</p>
                        <button class="btn btn-secondary text-xs px-3 py-1.5 rounded" type="button">Change Avatar</button>
                    </div>
                </div>
                <div class="space-y-4">
                    <div class="grid grid-cols-2 gap-4">
                        <div>
                            <label class="block text-xs font-medium text-gray-400 mb-1 uppercase tracking-wider">Full Name</label>
                            <input type="text" class="w-full bg-black/40 border border-white/10 rounded-lg px-4 py-2 text-white" value="">
                        </div>
                        <div>
                            <label class="block text-xs font-medium text-gray-400 mb-1 uppercase tracking-wider">Current Role</label>
                            <input type="text" class="w-full bg-black/40 border border-white/10 rounded-lg px-4 py-2 text-white" value="">
                        </div>
                    </div>
                    <div>
                        <label class="block text-xs font-medium text-gray-400 mb-1 uppercase tracking-wider">Public Bio</label>
                        <textarea class="w-full bg-black/40 border border-white/10 rounded-lg px-4 py-2 text-white resize-none" rows="4"></textarea>
                    </div>
                    <div>
                        <label class="block text-xs font-medium text-gray-400 mb-1 uppercase tracking-wider">LinkedIn URL</label>
                        <input type="text" class="w-full bg-black/40 border border-white/10 rounded-lg px-4 py-2 text-white" value="">
                    </div>
                    <div class="pt-4 mt-4 border-t border-white/10 flex justify-end">
                        <button type="button" class="btn btn-primary px-6 py-2">Save Changes</button>
                    </div>
                </div>
            </div>
        </div>
    </main>`,
    );
  }

  return output;
}

function extractFallbackBody(html: string) {
  const headEnd = html.search(/<\/head>/i);
  const htmlEnd = html.search(/<\/html>/i);

  let fallback = html;
  if (headEnd >= 0) {
    const start = headEnd + "</head>".length;
    fallback = html.slice(start, htmlEnd >= 0 ? htmlEnd : undefined);
  }

  return fallback
    .replace(/<!doctype[^>]*>/gi, "")
    .replace(/<html[^>]*>/gi, "")
    .replace(/<\/html>/gi, "")
    .replace(/<head[\s\S]*?<\/head>/gi, "")
    .replace(/<body[^>]*>/gi, "")
    .replace(/<\/body>/gi, "");
}

function loadTemplate(template: string) {
  const cached = templateCache.get(template);
  if (cached) return cached;

  const candidates = [
    path.join(process.cwd(), "mockups", "high_fidelity", template),
    path.join(process.cwd(), "..", "..", "mockups", "high_fidelity", template),
    path.join(process.cwd(), "Gemini Design", "high_fidelity_mockups", template),
    path.join(process.cwd(), "..", "Gemini Design", "high_fidelity_mockups", template),
    path.join(process.cwd(), "..", "..", "Gemini Design", "high_fidelity_mockups", template),
  ];
  const fullPath = candidates.find((candidate) => existsSync(candidate));
  if (!fullPath) {
    throw new Error(`GEMINI_TEMPLATE_NOT_FOUND:${template}`);
  }
  const html = sanitizeTemplateHtml(readFileSync(fullPath, "utf8"));
  const bodyMatch = html.match(/<body([^>]*)>([\s\S]*?)<\/body>/i);

  if (!bodyMatch) {
    const extracted = {
      className: "",
      body: stripScripts(extractFallbackBody(html)),
    };
    templateCache.set(template, extracted);
    return extracted;
  }

  const attrs = bodyMatch[1] ?? "";
  const body = stripScripts(bodyMatch[2] ?? "");
  const classMatch = attrs.match(/class=["']([^"']+)["']/i);

  const extracted = {
    className: classMatch?.[1] ?? "",
    body,
  };
  templateCache.set(template, extracted);
  return extracted;
}

function escapeRegExp(input: string) {
  return input.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function replaceWithWhitespaceTolerance(input: string, source: string, target: string) {
  const exact = input.split(source).join(target);
  if (exact !== input || !/\s/.test(source)) {
    return exact;
  }

  const tokens = source.trim().split(/\s+/).map(escapeRegExp);
  if (!tokens.length) return exact;
  const pattern = new RegExp(tokens.join("\\s+"), "g");
  return exact.replace(pattern, target);
}

function applyReplacements(input: string, replacements?: Record<string, string>) {
  const brandLockup =
    '<span class="inline-flex items-center gap-2">' +
    '<img src="/assets/branding/brand_brain_icon.svg" alt="My AI Skill Tutor" class="h-11 w-11 object-contain" />' +
    '<span class="font-[Outfit] font-bold text-[1.9rem] leading-none tracking-tight text-[var(--text-main)]">My AI Skill Tutor</span>' +
    "</span>";

  const merged: Record<string, string> = {
    "CareerGuard Networks": BRAND_NAME,
    "CareerGuard Network": `${BRAND_NAME} Network`,
    "CareerGuard Plan": `${BRAND_NAME} Plan`,
    "CareerGuard Recruiter": `${BRAND_NAME} Recruiter`,
    '<img src="/assets/branding/brand_wordmark_logo.png" alt="My AI Skill Tutor" class="h-8 w-auto object-contain" />':
      brandLockup,
    ">AI Tutor</span>": `>${BRAND_NAME}</span>`,
    "AI Tutor Session": `${BRAND_NAME} Session`,
    "AI Tutor Platform": BRAND_NAME,
    "AI Tutor platform": BRAND_NAME,
    "AI Tutor. All rights reserved.": `${BRAND_NAME}. All rights reserved.`,
    'href="/sign-in?redirect_url=/onboarding/" class="btn btn-secondary">Log In</a>':
      'href="/sign-in?redirect_url=/dashboard/" class="btn btn-secondary">Log In</a>',
    'href="#proof" class="nav-link">Public Proof</a>': 'href="#public-proof" class="nav-link">Public Proof</a>',
    'href="/employers/talent/" class="btn btn-secondary text-lg px-8 py-4">See Example Profiles</a>':
      'href="/u/alex-chen-ai/" class="btn btn-secondary text-lg px-8 py-4">See Example Profiles</a>',
    'href="#how" class="nav-link text-gray-300">How it works</a>':
      'href="/employers/" class="nav-link text-gray-300">How it works</a>',
    'href="#talent" class="nav-link text-gray-300">Browse Talent</a>':
      'href="/employers/talent/" class="nav-link text-gray-300">Browse Talent</a>',
    'href="#" class="btn btn-secondary text-lg px-8 py-4">Post a Role</a>':
      'href="/sign-up?redirect_url=/employers/" class="btn btn-secondary text-lg px-8 py-4">Post a Role</a>',
    'id="theme-toggle"': 'id="theme-toggle" aria-label="Toggle dark mode"',
    "https://x.com/myaiskilltu": "https://x.com/myaiskilltutor",
    "http://linkedin.com/company/myaiskilltutor": "https://www.linkedin.com/company/myaiskilltutor",
    "https://linkedin.com/company/myaiskilltutor": "https://www.linkedin.com/company/myaiskilltutor",
    "fa-x-twitter": "fa-twitter",
    'href="/assessment/"': 'href="/sign-up?redirect_url=/onboarding/"',
    'href="/assessment"': 'href="/sign-up?redirect_url=/onboarding/"',
    ...(replacements ?? {}),
  };

  let output = input;
  for (const [source, target] of Object.entries(merged)) {
    output = replaceWithWhitespaceTolerance(output, source, target);
  }

  output = output.replace(
    /href="\/sign-in\?redirect_url=\/onboarding\/?"/g,
    'href="/sign-in?redirect_url=/dashboard/"',
  );
  output = output.replace(
    /<div class="mt-8 text-center border-t border-white\/10 pt-6">[\s\S]*?Go directly to\s*Dashboard[\s\S]*?<\/div>/gi,
    "",
  );
  output = output.replace(/<!-- AI Message -->[\s\S]*?<!-- User Message -->/gi, "<!-- AI Message --><!-- User Message -->");
  output = output.replace(/<!-- User Message -->[\s\S]*?<!-- AI Typing Indicator -->/gi, "<!-- User Message --><!-- AI Typing Indicator -->");
  output = output.replace(/<!-- AI Typing Indicator -->[\s\S]*?<!-- Chat Input Area -->/gi, "<!-- AI Typing Indicator --><!-- Chat Input Area -->");
  output = output.replace(
    /<div[^>]*class="fixed top-4 right-4 z-\[100\]"[^>]*>[\s\S]*?id="theme-toggle"[\s\S]*?<\/div>/gi,
    "",
  );
  output = output.replace(/<button[^>]*id="theme-toggle"[\s\S]*?<\/button>/gi, "");
  output = output.replace(/<img[^>]+src="\/assets\/branding\/brand_wordmark_logo\.png"[^>]*>/gi, brandLockup);
  output = output.replace(/\/assets\/branding\/brand_logo_icon\.png/g, "/assets/branding/brand_brain_icon.svg");
  output = output
    .replace(/\\n/g, "")
    .replace(/\\1/g, "")
    .replace(/href="\/sign-in\?redirect_url=(?:%2F)?onboarding\/?"/gi, 'href="/sign-in?redirect_url=/dashboard/"');
  return output;
}

export function GeminiStaticPage({ template, replacements, className, runtime = "full" }: GeminiStaticPageProps) {
  const extracted = loadTemplate(template);
  const sanitizedBody = sanitizeTemplateBody(template, extracted.body);
  const html = applyReplacements(sanitizedBody, replacements);

  return (
    <>
      <div
        data-gemini-shell="1"
        className={className ?? extracted.className}
        dangerouslySetInnerHTML={{ __html: html }}
        suppressHydrationWarning
      />
      {runtime === "full" ? <Script src="/gemini-runtime.js" strategy="afterInteractive" /> : null}
    </>
  );
}
