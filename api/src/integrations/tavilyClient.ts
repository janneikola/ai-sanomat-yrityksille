import { tavily } from '@tavily/core';

export interface TavilyResult {
  title: string;
  url: string;
  content: string;
  score: number;
  publishedDate: string | null;
}

let tvlyClient: ReturnType<typeof tavily> | null = null;

function getClient() {
  if (!tvlyClient) {
    const apiKey = process.env.TAVILY_API_KEY;
    if (!apiKey) {
      return null;
    }
    tvlyClient = tavily({ apiKey });
  }
  return tvlyClient;
}

/**
 * Suorittaa Tavily-verkkohaun annetulla kyselylla.
 * Palauttaa tyhjan taulukon jos TAVILY_API_KEY ei ole asetettu.
 */
export async function searchTavily(
  query: string,
  maxResults = 5
): Promise<TavilyResult[]> {
  const client = getClient();
  if (!client) {
    console.warn('TAVILY_API_KEY not set, skipping web search');
    return [];
  }

  const response = await client.search(query, {
    topic: 'news',
    searchDepth: 'basic',
    timeRange: 'week',
    maxResults,
  });

  return (response.results || []).map((r) => ({
    title: r.title || 'Untitled',
    url: r.url,
    content: r.content || '',
    score: r.score || 0,
    publishedDate: r.publishedDate || null,
  }));
}
