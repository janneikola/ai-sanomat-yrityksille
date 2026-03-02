import Parser from 'rss-parser';

const parser = new Parser({
  timeout: 15000, // 15 sekunnin aikakatkaisu per syote
  headers: {
    'User-Agent': 'AI-Sanomat-Collector/1.0',
  },
});

export interface CollectedItem {
  title: string;
  url: string;
  summary: string | null;
  publishedAt: Date | null;
}

export async function fetchRssFeed(url: string): Promise<CollectedItem[]> {
  const feed = await parser.parseURL(url);

  return feed.items
    .map((item) => ({
      title: item.title ?? 'Untitled',
      url: item.link ?? '',
      summary: item.contentSnippet ?? item.content ?? null,
      publishedAt: item.pubDate ? new Date(item.pubDate) : null,
    }))
    .filter((item) => item.url.length > 0);
}
