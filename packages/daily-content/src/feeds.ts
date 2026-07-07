/**
 * Curated list of real, free AI/tech RSS feeds (Lane A of the briefing engine).
 *
 * Ported from MyDailyDownload `newsletter-backend/news_feeds.py` (absorbed into
 * MAST, rebuild Phase 3.1). Every feed here is a real, publicly-published
 * RSS/Atom feed — no API keys required. Each entry carries a human-readable
 * `source` name (used for citation in the briefing) and a coarse `tier` used
 * only for light prioritization when ranking.
 *
 * If a feed URL ever 404s or stops publishing, the engine logs it and skips it
 * (per-feed try/catch in `fetchAllFeeds`) — a dead feed never breaks a run.
 */

export type FeedTier = "primary" | "press" | "research" | "indie";

export type FeedSource = {
  source: string;
  url: string;
  tier: FeedTier;
};

// tier: "primary" = first-party lab/company blog (highest trust for attribution)
//       "press"   = established tech press
//       "research"= papers / research aggregators
//       "indie"   = high-signal individual / community
export const FEEDS: FeedSource[] = [
  // ── Established tech press (AI-focused where possible) ──
  { source: "TechCrunch AI", url: "https://techcrunch.com/category/artificial-intelligence/feed/", tier: "press" },
  { source: "The Verge AI", url: "https://www.theverge.com/rss/ai-artificial-intelligence/index.xml", tier: "press" },
  { source: "VentureBeat AI", url: "https://venturebeat.com/category/ai/feed/", tier: "press" },
  { source: "MIT Technology Review", url: "https://www.technologyreview.com/feed/", tier: "press" },
  { source: "Ars Technica", url: "https://feeds.arstechnica.com/arstechnica/index", tier: "press" },
  { source: "Ars Technica AI", url: "https://arstechnica.com/ai/feed/", tier: "press" },
  { source: "Wired", url: "https://www.wired.com/feed/tag/ai/latest/rss", tier: "press" },
  { source: "ZDNet AI", url: "https://www.zdnet.com/topic/artificial-intelligence/rss.xml", tier: "press" },
  { source: "The Register AI/ML", url: "https://www.theregister.com/software/ai_ml/headlines.atom", tier: "press" },
  { source: "TechCrunch", url: "https://techcrunch.com/feed/", tier: "press" },
  { source: "Engadget", url: "https://www.engadget.com/rss.xml", tier: "press" },
  { source: "TechRadar", url: "https://www.techradar.com/rss", tier: "press" },

  // ── First-party AI lab / company blogs (best for primary-source citation) ──
  { source: "OpenAI Blog", url: "https://openai.com/blog/rss.xml", tier: "primary" },
  { source: "OpenAI News", url: "https://openai.com/news/rss.xml", tier: "primary" },
  { source: "Google AI Blog", url: "https://blog.google/technology/ai/rss/", tier: "primary" },
  { source: "Google DeepMind", url: "https://deepmind.google/blog/rss.xml", tier: "primary" },
  { source: "Microsoft AI Blog", url: "https://blogs.microsoft.com/ai/feed/", tier: "primary" },
  { source: "AWS Machine Learning", url: "https://aws.amazon.com/blogs/machine-learning/feed/", tier: "primary" },
  { source: "NVIDIA Blog", url: "https://blogs.nvidia.com/feed/", tier: "primary" },
  { source: "Meta AI", url: "https://ai.meta.com/blog/rss/", tier: "primary" },
  { source: "Hugging Face Blog", url: "https://huggingface.co/blog/feed.xml", tier: "primary" },
  { source: "Stability AI", url: "https://stability.ai/news?format=rss", tier: "primary" },

  // ── Research / papers ──
  { source: "arXiv cs.AI", url: "https://rss.arxiv.org/rss/cs.AI", tier: "research" },
  { source: "arXiv cs.CL", url: "https://rss.arxiv.org/rss/cs.CL", tier: "research" },
  { source: "arXiv cs.LG", url: "https://rss.arxiv.org/rss/cs.LG", tier: "research" },
  { source: "BAIR Blog", url: "https://bair.berkeley.edu/blog/feed.xml", tier: "research" },

  // ── High-signal indie / community ──
  { source: "Simon Willison", url: "https://simonwillison.net/atom/everything/", tier: "indie" },
  { source: "Import AI", url: "https://importai.substack.com/feed", tier: "indie" },
  { source: "The Batch (DeepLearning.AI)", url: "https://www.deeplearning.ai/the-batch/feed/", tier: "indie" },
  { source: "Ben's Bites", url: "https://www.bensbites.com/feed", tier: "indie" },
  { source: "Latent Space", url: "https://www.latent.space/feed", tier: "indie" },
  { source: "One Useful Thing (Ethan Mollick)", url: "https://www.oneusefulthing.org/feed", tier: "indie" },
  { source: "Hacker News (front page)", url: "https://hnrss.org/frontpage", tier: "indie" },

  // ── Marketing / Product / Founder vertical signal ──
  { source: "Marketing AI Institute", url: "https://www.marketingaiinstitute.com/blog/rss.xml", tier: "indie" },
  { source: "Lenny's Newsletter", url: "https://www.lennysnewsletter.com/feed", tier: "indie" },
  { source: "Search Engine Land", url: "https://searchengineland.com/feed", tier: "press" },
  { source: "Social Media Today", url: "https://www.socialmediatoday.com/feeds/news/", tier: "press" },
  { source: "Product Hunt", url: "https://www.producthunt.com/feed", tier: "indie" },
];

export function allFeeds(): FeedSource[] {
  return [...FEEDS];
}
