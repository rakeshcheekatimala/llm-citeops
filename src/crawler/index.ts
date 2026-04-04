import { AuditOptions, PageContent } from '../types/index.js';
import { fetchUrl } from './url-fetcher.js';
import { parseLocalFile, parseLocalDir } from './local-parser.js';
import { fetchSitemapUrls } from './sitemap.js';
import { isAllowed } from './robots.js';

export async function crawl(options: AuditOptions): Promise<PageContent[]> {
  const rateMs = Math.round(1000 / (options.rate || 1));

  if (options.file) {
    return [await parseLocalFile(options.file)];
  }

  if (options.dir) {
    return parseLocalDir(options.dir);
  }

  if (options.sitemap) {
    const urls = await fetchSitemapUrls(options.sitemap);
    const pages: PageContent[] = [];
    for (const url of urls) {
      const allowed = await isAllowed(url, options.ignoreRobots);
      if (!allowed) continue;
      try {
        const page = await fetchUrl(url, { rateMs });
        pages.push(page);
      } catch {
        // skip failed URLs
      }
    }
    return pages;
  }

  if (options.url) {
    const allowed = await isAllowed(options.url, options.ignoreRobots);
    if (!allowed) {
      throw new Error(
        `robots.txt disallows crawling ${options.url}. Use --ignore-robots to override.`
      );
    }
    const page = await fetchUrl(options.url, { rateMs });
    return [page];
  }

  throw new Error('No input provided. Use --url, --file, --dir, or --sitemap.');
}
