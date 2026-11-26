import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, test } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "../../apps/web/node_modules/react-dom/server.node.js";
import {
  BuildLogMarkdown,
  markdownToPlainText,
  parseMarkdownBlocks,
  safeHttpsUrl,
} from "../../apps/web/lib/build-log/markdown";

const render = (markdown: string) => renderToStaticMarkup(createElement(BuildLogMarkdown, { markdown }));

describe("build log markdown: blocks", () => {
  test("paragraphs, headings, lists, fenced code", () => {
    const html = render(
      [
        "First line",
        "same paragraph.",
        "",
        "## How I built it",
        "- one",
        "- two",
        "",
        "1. first",
        "2. second",
        "",
        "### Small heading",
        "```js",
        "const a = 1 < 2;",
        "```",
      ].join("\n"),
    );
    expect(html).toBe(
      "<div><p>First line same paragraph.</p><h2>How I built it</h2><ul><li>one</li><li>two</li></ul>" +
        "<ol><li>first</li><li>second</li></ol><h3>Small heading</h3>" +
        '<pre><code data-language="js">const a = 1 &lt; 2;</code></pre></div>',
    );
  });

  test("a single # becomes an h2 (the page already has an h1)", () => {
    expect(render("# Title")).toBe("<div><h2>Title</h2></div>");
  });

  test("an unclosed fence runs to the end", () => {
    const blocks = parseMarkdownBlocks("```\nline 1\nline 2");
    expect(blocks).toEqual([{ type: "code", language: null, code: "line 1\nline 2" }]);
  });

  test("markdown inside code is not interpreted", () => {
    expect(render("```\n**not bold** [x](https://a.com)\n```")).toBe(
      "<div><pre><code>**not bold** [x](https://a.com)</code></pre></div>",
    );
    expect(render("use `**raw**` here")).toBe("<div><p>use <code>**raw**</code> here</p></div>");
  });
});

describe("build log markdown: inline", () => {
  test("bold, italic, code, nested", () => {
    expect(render("**bold** and *italic* and _also_ and `code`")).toBe(
      "<div><p><strong>bold</strong> and <em>italic</em> and <em>also</em> and <code>code</code></p></div>",
    );
    expect(render("**bold with *italic* inside**")).toBe("<div><p><strong>bold with <em>italic</em> inside</strong></p></div>");
  });

  test("snake_case words are left alone", () => {
    expect(render("call send_launch_email now")).toBe("<div><p>call send_launch_email now</p></div>");
  });

  test("https links get safe rel and open in a new tab", () => {
    expect(render("see [the doc](https://example.com/a?b=1)")).toBe(
      '<div><p>see <a href="https://example.com/a?b=1" rel="noopener nofollow ugc" target="_blank">the doc</a></p></div>',
    );
  });

  test("bare https URLs are linked, trailing punctuation excluded", () => {
    expect(render("Repo: https://github.com/x/y.")).toBe(
      '<div><p>Repo: <a href="https://github.com/x/y" rel="noopener nofollow ugc" target="_blank">https://github.com/x/y</a>.</p></div>',
    );
  });
});

describe("build log markdown: hostile input", () => {
  test("raw HTML is rendered as text, never as markup", () => {
    const html = render('<script>alert(1)</script>\n\n<img src=x onerror="alert(1)">\n\n<a href="javascript:alert(1)">x</a>');
    expect(html).not.toContain("<script");
    expect(html).not.toContain("<img");
    expect(html).not.toContain('<a href="javascript');
    expect(html).toContain("&lt;script&gt;alert(1)&lt;/script&gt;");
    expect(html).toContain("&lt;img src=x onerror=&quot;alert(1)&quot;&gt;");
  });

  test("javascript:, data:, http: and relative links render as plain text", () => {
    for (const href of ["javascript:alert(1)", "JavaScript:alert(1)", "data:text/html,<b>x</b>", "http://example.com", "/dashboard", "//evil.com", " javascript:alert(1)"]) {
      const html = render(`[click](${href})`);
      expect(html).not.toContain("<a ");
      expect(html).toContain("click");
    }
  });

  test("a javascript: target with parentheses is dropped whole", () => {
    expect(render("[bad link](javascript:alert(1)) after")).toBe("<div><p>bad link after</p></div>");
    expect(render("[wiki](https://en.wikipedia.org/wiki/Foo_(bar))")).toBe(
      '<div><p><a href="https://en.wikipedia.org/wiki/Foo_(bar)" rel="noopener nofollow ugc" target="_blank">wiki</a></p></div>',
    );
  });

  test("links with credentials, quotes or spaces are refused", () => {
    expect(safeHttpsUrl("https://user:pass@example.com")).toBeNull();
    expect(safeHttpsUrl('https://example.com/"onmouseover="x')).toBeNull();
    expect(safeHttpsUrl("https://exa mple.com")).toBeNull();
    expect(safeHttpsUrl("https://example.com/ok")).toBe("https://example.com/ok");
  });

  test("links cannot nest inside link labels", () => {
    const html = render("[outer [inner](https://a.com)](https://b.com)");
    expect(html).not.toMatch(/<a [^>]*>(?:(?!<\/a>).)*<a /);
    const labelLink = render("[see https://a.com here](https://b.com)");
    expect((labelLink.match(/<a /g) ?? []).length).toBe(1);
  });

  test("deeply nested emphasis stays bounded and escaped", () => {
    const nested = `${"**".repeat(50)}x${"**".repeat(50)}`;
    expect(() => render(nested)).not.toThrow();
    const mixed = "*_**`<b>`**_*";
    const html = render(mixed);
    expect(html).not.toContain("<b>");
    expect(html).toContain("&lt;b&gt;");
  });

  test("unbalanced markers degrade to text", () => {
    expect(render("**not closed and *also not")).toBe("<div><p>**not closed and *also not</p></div>");
    // The bracket stays text; the bare https URL after it is still a safe link.
    expect(render("[label](https://ok.com")).toBe(
      '<div><p>[label](<a href="https://ok.com/" rel="noopener nofollow ugc" target="_blank">https://ok.com</a></p></div>',
    );
  });

  test("very long input does not hang", () => {
    const started = Date.now();
    render(`${"*a ".repeat(4000)}\n${"[x](".repeat(2000)}`);
    expect(Date.now() - started).toBeLessThan(1000);
  });

  test("the renderer never uses dangerouslySetInnerHTML", () => {
    const source = readFileSync(path.resolve(process.cwd(), "apps/web/lib/build-log/markdown.tsx"), "utf8");
    expect(source).not.toMatch(/dangerouslySetInnerHTML\s*=/);
  });
});

describe("markdownToPlainText", () => {
  test("strips markup and truncates on a word", () => {
    expect(markdownToPlainText("## Head\n\n**Bold** [link](https://a.com) `code`\n\n- a\n- b")).toBe("Head Bold link code a. b");
    const long = markdownToPlainText("word ".repeat(100), 50);
    expect(long.length).toBeLessThanOrEqual(50);
    expect(long.endsWith("…")).toBe(true);
  });
});
