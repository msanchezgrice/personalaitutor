import React, { Fragment, type ReactNode } from "react";

/**
 * Safe, minimal Markdown for build log posts. Renders straight to React
 * elements, so every piece of text is escaped by React: raw HTML in a post
 * shows up as literal text, and there is no dangerouslySetInnerHTML anywhere.
 *
 * Supported:
 *   blocks  paragraphs, "## " / "### " headings ("# " renders as "## "),
 *           "- " / "* " lists, "1. " lists, ``` fenced code ```
 *   inline  **bold**, *italic* / _italic_, `code`, [text](https://...),
 *           bare https:// links
 * Links are https only and carry rel="noopener nofollow ugc". Anything else
 * (javascript:, data:, http:, relative paths) renders as plain text.
 *
 * Pure and client-safe: used by the public article page and the editor preview.
 */

export const BUILD_LOG_LINK_REL = "noopener nofollow ugc";
const MAX_INLINE_DEPTH = 4;
const MAX_INPUT_CHARS = 20_000;
/** Inline spans (emphasis, code, links) longer than this are not looked for: keeps hostile input linear. */
const MAX_SPAN_CHARS = 600;

export type MarkdownBlock =
  | { type: "heading"; level: 2 | 3; text: string }
  | { type: "paragraph"; text: string }
  | { type: "list"; ordered: boolean; items: string[] }
  | { type: "code"; language: string | null; code: string };

/** Returns the URL when it is a well-formed https link, otherwise null. */
export function safeHttpsUrl(raw: string): string | null {
  const value = raw.trim();
  if (!/^https:\/\//i.test(value)) return null;
  if (/[\s<>"'`\\]/.test(value)) return null;
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" || !url.hostname || url.username || url.password) return null;
    return url.toString();
  } catch {
    return null;
  }
}

const HEADING = /^(#{1,3})\s+(.+?)\s*#*\s*$/;
const BULLET = /^\s{0,3}[-*+]\s+(.*)$/;
const ORDERED = /^\s{0,3}\d{1,3}[.)]\s+(.*)$/;
const FENCE = /^\s{0,3}(```|~~~)\s*([A-Za-z0-9_+-]{0,20})\s*$/;

export function parseMarkdownBlocks(markdown: string): MarkdownBlock[] {
  const lines = markdown.slice(0, MAX_INPUT_CHARS).replace(/\r\n?/g, "\n").split("\n");
  const blocks: MarkdownBlock[] = [];
  let paragraph: string[] = [];
  let list: { ordered: boolean; items: string[] } | null = null;

  const flushParagraph = () => {
    if (paragraph.length) blocks.push({ type: "paragraph", text: paragraph.join(" ") });
    paragraph = [];
  };
  const flushList = () => {
    if (list && list.items.length) blocks.push({ type: "list", ordered: list.ordered, items: list.items });
    list = null;
  };

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    const fence = FENCE.exec(line);
    if (fence) {
      flushParagraph();
      flushList();
      const marker = fence[1];
      const code: string[] = [];
      index += 1;
      while (index < lines.length && lines[index].trim() !== marker) {
        code.push(lines[index]);
        index += 1;
      }
      blocks.push({ type: "code", language: fence[2] || null, code: code.join("\n") });
      continue;
    }

    if (!line.trim()) {
      flushParagraph();
      flushList();
      continue;
    }

    const heading = HEADING.exec(line);
    if (heading) {
      flushParagraph();
      flushList();
      blocks.push({ type: "heading", level: heading[1].length === 3 ? 3 : 2, text: heading[2] });
      continue;
    }

    const bullet = BULLET.exec(line);
    const ordered = bullet ? null : ORDERED.exec(line);
    if (bullet || ordered) {
      flushParagraph();
      const isOrdered = Boolean(ordered);
      const text = (bullet ?? ordered)![1];
      if (!list || list.ordered !== isOrdered) {
        flushList();
        list = { ordered: isOrdered, items: [] };
      }
      list.items.push(text);
      continue;
    }

    if (list && /^\s{2,}\S/.test(line)) {
      // Indented continuation of the previous list item.
      list.items[list.items.length - 1] += ` ${line.trim()}`;
      continue;
    }

    flushList();
    paragraph.push(line.trim());
  }
  flushParagraph();
  flushList();
  return blocks;
}

// --- inline ----------------------------------------------------------------

const BARE_URL = /https:\/\/[^\s<>()"'`\\]+/y;

function isWordChar(char: string | undefined) {
  return Boolean(char && /[A-Za-z0-9]/.test(char));
}

/** Finds the closing delimiter for emphasis, skipping over inline code spans. */
function findClosing(text: string, delimiter: string, from: number): number {
  let index = from;
  const limit = Math.min(text.length, from + MAX_SPAN_CHARS);
  while (index < limit) {
    if (text[index] === "`") {
      const end = text.indexOf("`", index + 1);
      if (end === -1 || end >= limit) return -1;
      index = end + 1;
      continue;
    }
    if (text.startsWith(delimiter, index)) {
      const before = text[index - 1];
      if (before && before !== " " && index > from) {
        if (delimiter === "_" && isWordChar(text[index + 1])) {
          index += 1;
          continue;
        }
        if (delimiter === "*" && text[index + 1] === "*") {
          index += 2;
          continue;
        }
        return index;
      }
    }
    index += 1;
  }
  return -1;
}

/** indexOf limited to MAX_SPAN_CHARS after `from`. */
function findWithin(text: string, needle: string, from: number): number {
  const found = text.slice(from, from + MAX_SPAN_CHARS + needle.length).indexOf(needle);
  return found === -1 ? -1 : from + found;
}

/** The ")" that closes a link target, allowing balanced parentheses inside the URL. */
function findLinkEnd(text: string, from: number): number {
  let depth = 0;
  const limit = Math.min(text.length, from + MAX_SPAN_CHARS);
  for (let index = from; index < limit; index += 1) {
    const char = text[index];
    if (char === "(") depth += 1;
    else if (char === ")") {
      if (depth === 0) return index;
      depth -= 1;
    } else if (char === "\n") return -1;
  }
  return -1;
}

function trimTrailingPunctuation(url: string) {
  return url.replace(/[.,;:!?]+$/, "");
}

export function renderInline(text: string, keyPrefix = "i", depth = 0, allowLinks = true): ReactNode[] {
  const out: ReactNode[] = [];
  let buffer = "";
  let index = 0;
  let key = 0;
  const nextKey = () => `${keyPrefix}-${key++}`;
  const flush = () => {
    if (buffer) out.push(buffer);
    buffer = "";
  };
  const nested = (inner: string, links = allowLinks) =>
    depth >= MAX_INLINE_DEPTH ? [inner] : renderInline(inner, `${keyPrefix}-${key}`, depth + 1, links);

  while (index < text.length) {
    const char = text[index];

    if (char === "\\" && index + 1 < text.length && /[\\`*_[\]()#-]/.test(text[index + 1])) {
      buffer += text[index + 1];
      index += 2;
      continue;
    }

    if (char === "`") {
      const end = findWithin(text, "`", index + 1);
      if (end > index + 1) {
        flush();
        out.push(<code key={nextKey()}>{text.slice(index + 1, end)}</code>);
        index = end + 1;
        continue;
      }
    }

    if (char === "*" && text[index + 1] === "*" && text[index + 2] && text[index + 2] !== " ") {
      const end = findWithin(text, "**", index + 2);
      if (end > index + 2 && text[end - 1] !== " ") {
        flush();
        out.push(<strong key={nextKey()}>{nested(text.slice(index + 2, end))}</strong>);
        index = end + 2;
        continue;
      }
    }

    if ((char === "*" || char === "_") && text[index + 1] && text[index + 1] !== " " && text[index + 1] !== char) {
      const opensWord = char === "_" ? !isWordChar(text[index - 1]) : true;
      if (opensWord) {
        const end = findClosing(text, char, index + 1);
        if (end > index + 1) {
          flush();
          out.push(<em key={nextKey()}>{nested(text.slice(index + 1, end))}</em>);
          index = end + 1;
          continue;
        }
      }
    }

    if (char === "[" && allowLinks) {
      const close = findWithin(text, "](", index + 1);
      const end = close === -1 ? -1 : findLinkEnd(text, close + 2);
      if (close > index + 1 && end > close + 2 && !text.slice(index + 1, close).includes("[")) {
        const label = text.slice(index + 1, close);
        const href = safeHttpsUrl(text.slice(close + 2, end));
        flush();
        if (href) {
          out.push(
            <a key={nextKey()} href={href} rel={BUILD_LOG_LINK_REL} target="_blank">
              {nested(label, false)}
            </a>,
          );
        } else {
          // Unsafe or malformed target: keep the label as text, drop the link.
          out.push(<Fragment key={nextKey()}>{nested(label, false)}</Fragment>);
        }
        index = end + 1;
        continue;
      }
    }

    if (char === "h" && allowLinks && text.startsWith("https://", index) && !isWordChar(text[index - 1])) {
      BARE_URL.lastIndex = index;
      const match = BARE_URL.exec(text);
      if (match) {
        const raw = trimTrailingPunctuation(match[0]);
        const href = safeHttpsUrl(raw);
        if (href) {
          flush();
          out.push(
            <a key={nextKey()} href={href} rel={BUILD_LOG_LINK_REL} target="_blank">
              {raw}
            </a>,
          );
          index += raw.length;
          continue;
        }
      }
    }

    buffer += char;
    index += 1;
  }
  flush();
  return out;
}

// --- blocks ----------------------------------------------------------------

export function renderBuildLogMarkdown(markdown: string): ReactNode[] {
  return parseMarkdownBlocks(markdown).map((block, index) => {
    const key = `b${index}`;
    switch (block.type) {
      case "heading":
        return block.level === 2 ? (
          <h2 key={key}>{renderInline(block.text, key)}</h2>
        ) : (
          <h3 key={key}>{renderInline(block.text, key)}</h3>
        );
      case "list": {
        const items = block.items.map((item, itemIndex) => <li key={`${key}-${itemIndex}`}>{renderInline(item, `${key}-${itemIndex}`)}</li>);
        return block.ordered ? <ol key={key}>{items}</ol> : <ul key={key}>{items}</ul>;
      }
      case "code":
        return (
          <pre key={key}>
            <code data-language={block.language ?? undefined}>{block.code}</code>
          </pre>
        );
      default:
        return <p key={key}>{renderInline(block.text, key)}</p>;
    }
  });
}

export function BuildLogMarkdown({ markdown, className }: { markdown: string; className?: string }) {
  return <div className={className}>{renderBuildLogMarkdown(markdown)}</div>;
}

/** Plain text for meta descriptions and excerpts: markup removed, whitespace collapsed. */
export function markdownToPlainText(markdown: string, maxChars = 240): string {
  const text = parseMarkdownBlocks(markdown)
    .map((block) => {
      if (block.type === "code") return "";
      const raw = block.type === "list" ? block.items.join(". ") : block.text;
      return raw
        .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
        .replace(/[*_`]/g, "")
        .replace(/\\(.)/g, "$1");
    })
    .filter(Boolean)
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
  if (text.length <= maxChars) return text;
  const cut = text.slice(0, maxChars - 1);
  const lastSpace = cut.lastIndexOf(" ");
  return `${(lastSpace > maxChars * 0.6 ? cut.slice(0, lastSpace) : cut).replace(/[.,;:\s]+$/, "")}…`;
}
