import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

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
  if (!replacements) return input;

  let output = input;
  for (const [source, target] of Object.entries(replacements)) {
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
