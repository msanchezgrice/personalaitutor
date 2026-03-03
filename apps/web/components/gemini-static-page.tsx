import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { BRAND_NAME } from "@/lib/site";

type GeminiStaticPageProps = {
  template: string;
  replacements?: Record<string, string>;
  className?: string;
};

function loadTemplate(template: string) {
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
  const html = readFileSync(fullPath, "utf8");
  const bodyMatch = html.match(/<body([^>]*)>([\s\S]*?)<\/body>/i);

  if (!bodyMatch) {
    return {
      className: "",
      body: html,
    };
  }

  const attrs = bodyMatch[1] ?? "";
  const body = bodyMatch[2] ?? "";
  const classMatch = attrs.match(/class=["']([^"']+)["']/i);

  return {
    className: classMatch?.[1] ?? "",
    body,
  };
}

function applyReplacements(input: string, replacements?: Record<string, string>) {
  const merged: Record<string, string> = {
    "CareerGuard Networks": BRAND_NAME,
    "CareerGuard Network": `${BRAND_NAME} Network`,
    "CareerGuard Plan": `${BRAND_NAME} Plan`,
    "CareerGuard Recruiter": `${BRAND_NAME} Recruiter`,
    ">AI Tutor</span>": `>${BRAND_NAME}</span>`,
    "AI Tutor Session": `${BRAND_NAME} Session`,
    "AI Tutor Platform": BRAND_NAME,
    "AI Tutor platform": BRAND_NAME,
    "AI Tutor. All rights reserved.": `${BRAND_NAME}. All rights reserved.`,
    'href="/sign-in?redirect_url=/onboarding/" class="btn btn-secondary">Log In</a>':
      'href="/sign-in?redirect_url=/dashboard/" class="btn btn-secondary">Log In</a>',
    'href="#proof" class="nav-link">Public Proof</a>': 'href="#features" class="nav-link">Public Proof</a>',
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
    ...(replacements ?? {}),
  };

  let output = input;
  for (const [source, target] of Object.entries(merged)) {
    output = output.split(source).join(target);
  }
  return output;
}

export function GeminiStaticPage({ template, replacements, className }: GeminiStaticPageProps) {
  const extracted = loadTemplate(template);
  const html = applyReplacements(extracted.body, replacements);

  return (
    <div
      className={className ?? extracted.className}
      dangerouslySetInnerHTML={{ __html: html }}
      suppressHydrationWarning
    />
  );
}
