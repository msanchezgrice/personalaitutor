/**
 * Tiny hand-rolled RSS 2.0 / Atom parser (rebuild Phase 3.1).
 *
 * MDD used Python's `feedparser`; this port intentionally avoids heavy XML
 * dependencies. It extracts only what the briefing engine needs from each
 * entry: title, link, summary/description, published timestamp. It is
 * tolerant of malformed feeds — a parse failure yields zero entries, never a
 * throw (per-feed isolation happens in the engine).
 */

export type ParsedFeedEntry = {
  title: string;
  link: string;
  summary: string;
  /** Raw timestamp string from the feed (ISO8601 or RFC822), best-effort. */
  published: string;
};

const NAMED_ENTITIES: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
  mdash: "—",
  ndash: "–",
  hellip: "…",
  rsquo: "’",
  lsquo: "‘",
  rdquo: "”",
  ldquo: "“",
};

export function unescapeXml(input: string): string {
  return input.replace(/&(#x?[0-9a-fA-F]+|[a-zA-Z]+);/g, (match, entity: string) => {
    if (entity.startsWith("#x") || entity.startsWith("#X")) {
      const code = Number.parseInt(entity.slice(2), 16);
      return Number.isFinite(code) ? String.fromCodePoint(code) : match;
    }
    if (entity.startsWith("#")) {
      const code = Number.parseInt(entity.slice(1), 10);
      return Number.isFinite(code) ? String.fromCodePoint(code) : match;
    }
    return NAMED_ENTITIES[entity] ?? match;
  });
}

/** Strip tags + collapse whitespace from feed HTML (no network, no DOM). */
export function cleanFeedText(input: string | null | undefined): string {
  if (!input) return "";
  let text = String(input);
  // Unwrap CDATA first so its contents are treated as text.
  text = text.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1");
  text = text.replace(/<[^>]+>/g, " ");
  text = unescapeXml(text);
  text = text.replace(/\s+/g, " ").trim();
  return text;
}

function extractBlocks(xml: string, tag: string): string[] {
  const blocks: string[] = [];
  const pattern = new RegExp(`<${tag}[\\s>][\\s\\S]*?</${tag}>`, "gi");
  const matches = xml.match(pattern);
  if (matches) {
    for (const match of matches) blocks.push(match);
  }
  return blocks;
}

function firstTagContent(block: string, tags: string[]): string {
  for (const tag of tags) {
    // Match <tag ...>content</tag> — non-greedy, tolerant of attributes.
    const pattern = new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)</${tag}>`, "i");
    const match = block.match(pattern);
    if (match && match[1] !== undefined) {
      const raw = match[1].trim();
      if (raw) return raw;
    }
  }
  return "";
}

function atomLink(block: string): string {
  // Prefer rel="alternate", then a link without rel, then any href.
  const linkTags = block.match(/<link\b[^>]*\/?>(?:<\/link>)?/gi) ?? [];
  let fallback = "";
  for (const tag of linkTags) {
    const href = tag.match(/href\s*=\s*["']([^"']+)["']/i)?.[1] ?? "";
    if (!href) continue;
    const rel = tag.match(/rel\s*=\s*["']([^"']+)["']/i)?.[1]?.toLowerCase() ?? "";
    if (rel === "alternate") return href;
    if (!rel && !fallback) fallback = href;
    if (!fallback) fallback = href;
  }
  return fallback;
}

function rssLink(block: string): string {
  const content = firstTagContent(block, ["link"]);
  if (content) return cleanFeedText(content);
  // Some feeds emit <link href="..."/> even in RSS.
  return atomLink(block);
}

function parseRssItems(xml: string): ParsedFeedEntry[] {
  return extractBlocks(xml, "item").map((block) => ({
    title: cleanFeedText(firstTagContent(block, ["title"])),
    link: rssLink(block),
    summary: cleanFeedText(firstTagContent(block, ["description", "content:encoded", "summary"])),
    published: cleanFeedText(firstTagContent(block, ["pubDate", "dc:date", "published", "updated"])),
  }));
}

function parseAtomEntries(xml: string): ParsedFeedEntry[] {
  return extractBlocks(xml, "entry").map((block) => ({
    title: cleanFeedText(firstTagContent(block, ["title"])),
    link: atomLink(block),
    summary: cleanFeedText(firstTagContent(block, ["summary", "content"])),
    published: cleanFeedText(firstTagContent(block, ["published", "updated", "issued"])),
  }));
}

/**
 * Parse an RSS 2.0 or Atom document into entries. Returns [] on anything it
 * cannot understand — it never throws.
 */
export function parseFeedXml(xml: string | null | undefined): ParsedFeedEntry[] {
  if (!xml || typeof xml !== "string") return [];
  try {
    const rssItems = parseRssItems(xml);
    if (rssItems.length) return rssItems.filter((entry) => entry.title || entry.link);
    const atomEntries = parseAtomEntries(xml);
    return atomEntries.filter((entry) => entry.title || entry.link);
  } catch {
    return [];
  }
}
