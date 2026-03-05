import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import Script from "next/script";
import { BRAND_NAME } from "@/lib/site";

type GeminiStaticPageProps = {
  template: string;
  replacements?: Record<string, string>;
  className?: string;
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

export function GeminiStaticPage({ template, replacements, className }: GeminiStaticPageProps) {
  const extracted = loadTemplate(template);
  const html = applyReplacements(extracted.body, replacements);

  return (
    <>
      <div
        data-gemini-shell="1"
        className={className ?? extracted.className}
        dangerouslySetInnerHTML={{ __html: html }}
        suppressHydrationWarning
      />
      <Script src="/gemini-runtime.js" strategy="afterInteractive" />
    </>
  );
}
