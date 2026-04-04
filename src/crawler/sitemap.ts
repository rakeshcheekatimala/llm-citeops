import fetch from 'node-fetch';
import { XMLParser } from 'fast-xml-parser';

interface SitemapUrl {
  loc: string;
}

interface SitemapIndex {
  sitemapindex?: {
    sitemap: SitemapUrl | SitemapUrl[];
  };
  urlset?: {
    url: SitemapUrl | SitemapUrl[];
  };
}

const parser = new XMLParser({ ignoreAttributes: false });

export async function fetchSitemapUrls(sitemapUrl: string): Promise<string[]> {
  const res = await fetch(sitemapUrl, { signal: AbortSignal.timeout(15000) });
  if (!res.ok) {
    throw new Error(`HTTP ${res.status} fetching sitemap: ${sitemapUrl}`);
  }

  const xml = await res.text();
  const parsed = parser.parse(xml) as SitemapIndex;

  // Sitemap index — recurse into child sitemaps
  if (parsed.sitemapindex) {
    const sitemaps = toArray(parsed.sitemapindex.sitemap);
    const nested = await Promise.all(
      sitemaps.map((s) => fetchSitemapUrls(s.loc))
    );
    return nested.flat();
  }

  // Standard urlset
  if (parsed.urlset) {
    const urls = toArray(parsed.urlset.url);
    return urls.map((u) => u.loc).filter(Boolean);
  }

  return [];
}

function toArray<T>(val: T | T[] | undefined): T[] {
  if (!val) return [];
  return Array.isArray(val) ? val : [val];
}
