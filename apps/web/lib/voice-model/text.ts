/**
 * Small text helpers shared by tune.ts and run.ts. Pure.
 */

/** Strips ```json fences the model sometimes adds around JSON output. */
export function stripJsonFences(raw: string): string {
  return raw
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();
}

/**
 * Puts untrusted text (learner samples, visitor tasks) inside a tagged block.
 * Any tag-like sequence that could close or open our delimiters is defused so
 * the text cannot break out of its block.
 */
export function fenceUntrusted(tag: string, text: string, attributes = ""): string {
  const safe = text.replace(/<(\/?)\s*(sample|task|samples|purpose)\b/gi, "‹$1$2");
  return `<${tag}${attributes ? ` ${attributes}` : ""}>\n${safe}\n</${tag}>`;
}

function words(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[‘’]/g, "'")
    .split(/[^a-z0-9']+/)
    .filter(Boolean);
}

/**
 * Returns the first run of at least `minWords` consecutive words that appears
 * in both `text` and one of `sources` (case and punctuation ignored), or null.
 * Used to catch output that copies a learner's sentences.
 */
export function findCopiedSpan(text: string, sources: string[], minWords: number): string | null {
  const target = words(text);
  if (target.length < minWords) return null;
  const grams = new Set<string>();
  for (const source of sources) {
    const sourceWords = words(source);
    for (let index = 0; index + minWords <= sourceWords.length; index += 1) {
      grams.add(sourceWords.slice(index, index + minWords).join(" "));
    }
  }
  if (grams.size === 0) return null;
  for (let index = 0; index + minWords <= target.length; index += 1) {
    const gram = target.slice(index, index + minWords).join(" ");
    if (grams.has(gram)) return gram;
  }
  return null;
}

export function countWords(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}
