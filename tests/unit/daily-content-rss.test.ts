import { describe, expect, test } from "vitest";
import { cleanFeedText, parseFeedXml, unescapeXml } from "@aitutor/daily-content";

const RSS_FIXTURE = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:content="http://purl.org/rss/1.0/modules/content/">
  <channel>
    <title>Example Tech Feed</title>
    <item>
      <title><![CDATA[OpenAI ships GPT-5 evals &amp; tooling]]></title>
      <link>https://example.com/story-one?utm_source=rss</link>
      <description><![CDATA[<p>New <b>evaluation</b> tooling landed today.</p>]]></description>
      <pubDate>Mon, 06 Jul 2026 12:00:00 GMT</pubDate>
    </item>
    <item>
      <title>Second story</title>
      <link>https://example.com/story-two</link>
      <description>Plain text summary</description>
      <pubDate>Sun, 05 Jul 2026 09:30:00 GMT</pubDate>
    </item>
  </channel>
</rss>`;

const ATOM_FIXTURE = `<?xml version="1.0" encoding="utf-8"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <title>Example Atom Feed</title>
  <entry>
    <title>Atom entry one</title>
    <link rel="alternate" type="text/html" href="https://atom.example.com/posts/one"/>
    <link rel="self" href="https://atom.example.com/feed.xml"/>
    <summary>Atom summary text</summary>
    <published>2026-07-06T08:00:00Z</published>
  </entry>
  <entry>
    <title>Atom entry two</title>
    <link href="https://atom.example.com/posts/two"/>
    <content type="html">&lt;p&gt;Rich &amp;quot;content&amp;quot; body&lt;/p&gt;</content>
    <updated>2026-07-05T10:00:00Z</updated>
  </entry>
</feed>`;

describe("daily-content RSS/Atom parser", () => {
  test("parses RSS 2.0 items with CDATA, entities, and pubDate", () => {
    const entries = parseFeedXml(RSS_FIXTURE);
    expect(entries).toHaveLength(2);
    expect(entries[0].title).toBe("OpenAI ships GPT-5 evals & tooling");
    expect(entries[0].link).toBe("https://example.com/story-one?utm_source=rss");
    expect(entries[0].summary).toBe("New evaluation tooling landed today.");
    expect(entries[0].published).toContain("Jul 2026");
    expect(entries[1].title).toBe("Second story");
  });

  test("parses Atom entries preferring rel=alternate links", () => {
    const entries = parseFeedXml(ATOM_FIXTURE);
    expect(entries).toHaveLength(2);
    expect(entries[0].link).toBe("https://atom.example.com/posts/one");
    expect(entries[0].summary).toBe("Atom summary text");
    expect(entries[0].published).toBe("2026-07-06T08:00:00Z");
    expect(entries[1].link).toBe("https://atom.example.com/posts/two");
  });

  test("malformed input yields zero entries instead of throwing", () => {
    expect(parseFeedXml("this is not xml")).toEqual([]);
    expect(parseFeedXml("")).toEqual([]);
    expect(parseFeedXml(null)).toEqual([]);
    expect(parseFeedXml("<rss><channel><item><title>Broken")).toEqual([]);
  });

  test("cleanFeedText strips tags and collapses whitespace", () => {
    expect(cleanFeedText("<div>Hello   <b>world</b>\n\n</div>")).toBe("Hello world");
    expect(cleanFeedText(null)).toBe("");
  });

  test("unescapeXml handles named, decimal, and hex entities", () => {
    expect(unescapeXml("a &amp; b &lt;c&gt; &#39;d&#39; &#x27;e&#x27;")).toBe("a & b <c> 'd' 'e'");
  });
});
