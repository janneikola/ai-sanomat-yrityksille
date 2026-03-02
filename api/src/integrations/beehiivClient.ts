const BEEHIIV_API_BASE = 'https://api.beehiiv.com/v2';

export interface CollectedItem {
  title: string;
  url: string;
  summary: string | null;
  publishedAt: Date | null;
}

interface BeehiivPost {
  title: string;
  web_url: string;
  subtitle: string | null;
  publish_date: number | null;
}

interface BeehiivResponse {
  data: BeehiivPost[];
}

export async function fetchBeehiivPosts(
  publicationId: string,
  apiKey: string,
  limit = 20
): Promise<CollectedItem[]> {
  const url = `${BEEHIIV_API_BASE}/publications/${publicationId}/posts?status=confirmed&limit=${limit}&order_by=publish_date&direction=desc`;

  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${apiKey}` },
  });

  if (!res.ok) {
    throw new Error(`Beehiiv API error: ${res.status} ${res.statusText}`);
  }

  const data = (await res.json()) as BeehiivResponse;

  return data.data.map((post) => ({
    title: post.title,
    url: post.web_url,
    summary: post.subtitle ?? null,
    // KRIITTINEN: Beehiiv publish_date on Unix-sekunneissa -- kerrotaan 1000:lla JavaScript Date:a varten
    publishedAt: post.publish_date
      ? new Date(post.publish_date * 1000)
      : null,
  }));
}
