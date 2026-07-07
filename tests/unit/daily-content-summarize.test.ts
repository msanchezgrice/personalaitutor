import { afterEach, beforeEach, describe, expect, test } from "vitest";
import { contentHash, summarizeGrounded, type FeedItem } from "@aitutor/daily-content";

function feedItem(overrides: Partial<FeedItem> = {}): FeedItem {
  const url = overrides.url ?? "https://real.example.com/story";
  const title = overrides.title ?? "Real feed title";
  return {
    url,
    originalUrl: url,
    title,
    summary: overrides.summary ?? "Real feed summary text.",
    source: overrides.source ?? "TechCrunch AI",
    tier: overrides.tier ?? "press",
    published: overrides.published ?? "2026-07-07T09:00:00Z",
    contentHash: contentHash(url, title),
  };
}

describe("grounded summarization", () => {
  const originalKey = process.env.OPENAI_API_KEY;

  beforeEach(() => {
    delete process.env.OPENAI_API_KEY;
  });

  afterEach(() => {
    if (originalKey === undefined) delete process.env.OPENAI_API_KEY;
    else process.env.OPENAI_API_KEY = originalKey;
  });

  test("no API key -> passes real feed text through UNCHANGED (the one sanctioned degradation)", async () => {
    const items = [feedItem(), feedItem({ url: "https://real.example.com/two", title: "Second" })];
    const out = await summarizeGrounded(items);
    expect(out).toHaveLength(2);
    expect(out[0].title).toBe("Real feed title");
    expect(out[0].summary).toBe("Real feed summary text.");
    expect(out[0].url).toBe("https://real.example.com/story");
    // New objects, not mutations of the input.
    expect(out[0]).not.toBe(items[0]);
  });

  test("accepts a rewrite only when the URL is returned verbatim", async () => {
    process.env.OPENAI_API_KEY = "test-key";
    const items = [feedItem()];
    const out = await summarizeGrounded(items, {
      callLlm: async () =>
        JSON.stringify({
          headline: "Tighter headline",
          summary: "Tighter grounded summary.",
          url: "https://real.example.com/story",
        }),
    });
    expect(out[0].title).toBe("Tighter headline");
    expect(out[0].summary).toBe("Tighter grounded summary.");
    expect(out[0].url).toBe("https://real.example.com/story");
  });

  test("URL drift -> rewrite discarded, original feed text kept", async () => {
    process.env.OPENAI_API_KEY = "test-key";
    const items = [feedItem()];
    const out = await summarizeGrounded(items, {
      callLlm: async () =>
        JSON.stringify({
          headline: "Fabricated headline",
          summary: "Fabricated summary",
          url: "https://attacker.example.com/other",
        }),
    });
    expect(out[0].title).toBe("Real feed title");
    expect(out[0].summary).toBe("Real feed summary text.");
    expect(out[0].url).toBe("https://real.example.com/story");
  });

  test("LLM failure on one item degrades that item to feed text, not the whole run", async () => {
    process.env.OPENAI_API_KEY = "test-key";
    let call = 0;
    const items = [feedItem(), feedItem({ url: "https://real.example.com/two", title: "Second title" })];
    const out = await summarizeGrounded(items, {
      callLlm: async (input) => {
        call += 1;
        if (input.prompt.includes("real.example.com/story")) {
          throw new Error("OPENAI_RESPONSE_FAILED:500:boom");
        }
        return JSON.stringify({
          headline: "Second rewritten",
          summary: "ok",
          url: "https://real.example.com/two",
        });
      },
    });
    expect(call).toBe(2);
    expect(out[0].title).toBe("Real feed title");
    expect(out[1].title).toBe("Second rewritten");
  });

  test("non-JSON output is treated as failure -> feed text kept", async () => {
    process.env.OPENAI_API_KEY = "test-key";
    const out = await summarizeGrounded([feedItem()], {
      callLlm: async () => "sorry, I cannot help with that",
    });
    expect(out[0].title).toBe("Real feed title");
  });
});
