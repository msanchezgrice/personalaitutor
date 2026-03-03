import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { BRAND_NAME } from "@/lib/site";

type GeminiStaticPageProps = {
  template: string;
  replacements?: Record<string, string>;
  className?: string;
};

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
    return {
      className: "",
      body: stripScripts(extractFallbackBody(html)),
    };
  }

  const attrs = bodyMatch[1] ?? "";
  const body = stripScripts(bodyMatch[2] ?? "");
  const classMatch = attrs.match(/class=["']([^"']+)["']/i);

  return {
    className: classMatch?.[1] ?? "",
    body,
  };
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
    "https://linkedin.com/company/myaiskilltutor": "https://www.linkedin.com/company/myaiskilltutor",
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
  output = output
    .replace(/\\n/g, "")
    .replace(/\\1/g, "")
    .replace(/href="\/sign-in\?redirect_url=(?:%2F)?onboarding\/?"/gi, 'href="/sign-in?redirect_url=/dashboard/"');
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
