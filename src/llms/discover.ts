import fs from 'fs';
import path from 'path';
import fetch from 'node-fetch';
import { marked } from 'marked';
import * as cheerio from 'cheerio';
import { fetchSitemapUrls } from '../crawler/sitemap.js';
import { fetchUrl } from '../crawler/url-fetcher.js';
import { LlmsGenerateOptions, LlmsSourcePage } from './types.js';

const SUPPORTED_EXTENSIONS = new Set(['.md', '.markdown', '.mdx', '.html', '.htm']);
const NON_CONTENT_EXTENSIONS = new Set([
  '.avif',
  '.css',
  '.gif',
  '.ico',
  '.jpeg',
  '.jpg',
  '.js',
  '.json',
  '.map',
  '.pdf',
  '.png',
  '.rss',
  '.svg',
  '.webmanifest',
  '.webp',
  '.xml',
  '.zip',
]);
const MAX_DISCOVERY_LINKS = 250;

export async function discoverLlmsSources(
  options: LlmsGenerateOptions
): Promise<LlmsSourcePage[]> {
  if (options.dir) {
    if (!options.site) {
      throw new Error('--site is required when generating from a local directory.');
    }
    return discoverLocalSources(options.dir, options.site);
  }

  if (options.sitemap) {
    const urls = await fetchSitemapUrls(options.sitemap);
    return fetchRemoteSources(
      rankContentUrls(urls, options.site, options.maxLinks),
      options.site
    );
  }

  if (options.url) {
    return discoverWebsiteSources(options.url, options.maxLinks, options.site);
  }

  throw new Error('Provide one input with --dir, --url, or --sitemap.');
}

async function discoverLocalSources(
  dirPath: string,
  site: string
): Promise<LlmsSourcePage[]> {
  if (!fs.existsSync(dirPath)) {
    throw new Error(`Directory not found: ${dirPath}`);
  }

  const stat = fs.statSync(dirPath);
  if (!stat.isDirectory()) {
    throw new Error(`Not a directory: ${dirPath}`);
  }

  const root = path.resolve(dirPath);
  const files = listContentFiles(root).sort((a, b) => a.localeCompare(b));
  const pages: LlmsSourcePage[] = [];

  for (const filePath of files) {
    const raw = fs.readFileSync(filePath, 'utf-8');
    const ext = path.extname(filePath).toLowerCase();
    const html =
      ext === '.html' || ext === '.htm' ? raw : await marked(stripFrontmatter(raw));

    pages.push({
      sourcePath: filePath,
      url: buildPublicUrl(site, root, filePath),
      raw,
      html,
    });
  }

  return pages;
}

function listContentFiles(root: string): string[] {
  const entries = fs.readdirSync(root, { withFileTypes: true });
  const files: string[] = [];

  for (const entry of entries) {
    if (entry.name.startsWith('.') || entry.name === 'node_modules' || entry.name === 'dist') {
      continue;
    }

    const fullPath = path.join(root, entry.name);
    if (entry.isDirectory()) {
      files.push(...listContentFiles(fullPath));
      continue;
    }

    if (entry.isFile() && SUPPORTED_EXTENSIONS.has(path.extname(entry.name).toLowerCase())) {
      files.push(fullPath);
    }
  }

  return files;
}

function buildPublicUrl(site: string, root: string, filePath: string): string {
  const normalizedSite = site.replace(/\/+$/, '');
  const relative = path.relative(root, filePath).split(path.sep).join('/');
  const withoutExt = relative.replace(/\.(md|markdown|mdx|html|htm)$/i, '');
  const withoutReadme = withoutExt.replace(/(^|\/)README$/i, '$1index');
  const withoutIndex = withoutReadme.replace(/(^|\/)index$/i, '$1');
  const cleanPath = withoutIndex.replace(/^\/+|\/+$/g, '');

  return cleanPath ? `${normalizedSite}/${cleanPath}` : `${normalizedSite}/`;
}

async function fetchRemoteSources(
  urls: string[],
  publicOrigin?: string
): Promise<LlmsSourcePage[]> {
  const pages: LlmsSourcePage[] = [];

  for (const url of urls) {
    try {
      const page = await fetchUrl(url, { rateMs: 0 });
      pages.push({
        url: toPublicUrl(page.url, publicOrigin),
        raw: page.html,
        html: page.html,
      });
    } catch {
      // Keep generation resilient for sitemap batches; lint can catch missing links later.
    }
  }

  return pages;
}

async function discoverWebsiteSources(
  url: string,
  maxLinks: number,
  publicOrigin?: string
): Promise<LlmsSourcePage[]> {
  const seed = await fetchUrl(url, { rateMs: 0 });
  const sitemapUrls = await discoverSitemapUrls(seed.url, seed.html);
  const fallbackUrls =
    sitemapUrls.length > 0 ? [] : extractSameOriginLinks(seed.url, seed.html);
  const urls = rankContentUrls(
    [seed.url, ...sitemapUrls, ...fallbackUrls],
    new URL(seed.url).origin,
    maxLinks
  );

  const seedKey = canonicalUrl(seed.url);
  const remoteSources = await fetchRemoteSources(
    urls.filter((candidate) => canonicalUrl(candidate) !== seedKey),
    publicOrigin
  );

  return [
    {
      url: toPublicUrl(seed.url, publicOrigin),
      raw: seed.html,
      html: seed.html,
    },
    ...remoteSources,
  ];
}

async function discoverSitemapUrls(seedUrl: string, html: string): Promise<string[]> {
  const origin = new URL(seedUrl).origin;
  const sitemapCandidates = [
    ...extractSitemapLinksFromHtml(seedUrl, html),
    ...(await extractSitemapLinksFromRobots(origin)),
    `${origin}/sitemap.xml`,
    `${origin}/sitemap_index.xml`,
  ];
  const urls: string[] = [];
  const seen = new Set<string>();

  for (const sitemapUrl of sitemapCandidates) {
    const key = canonicalUrl(sitemapUrl);
    if (seen.has(key)) continue;
    seen.add(key);

    try {
      urls.push(...(await fetchSitemapUrls(sitemapUrl)));
    } catch {
      // Sitemap discovery is best effort; homepage links are the fallback.
    }

    if (urls.length >= MAX_DISCOVERY_LINKS) break;
  }

  return urls;
}

function extractSitemapLinksFromHtml(seedUrl: string, html: string): string[] {
  const $ = cheerio.load(html);
  const urls: string[] = [];

  $('link[rel~="sitemap"], a[href$="sitemap.xml"], a[href$="sitemap_index.xml"]').each(
    (_index, element) => {
      const href = $(element).attr('href');
      if (!href) return;

      try {
        urls.push(new URL(href, seedUrl).toString());
      } catch {
        // Ignore malformed links.
      }
    }
  );

  return urls;
}

async function extractSitemapLinksFromRobots(origin: string): Promise<string[]> {
  try {
    const res = await fetch(`${origin}/robots.txt`, { signal: AbortSignal.timeout(5000) });
    if (!res.ok) return [];

    const text = await res.text();
    return [...text.matchAll(/^Sitemap:\s*(\S+)\s*$/gim)].map((match) => match[1]);
  } catch {
    return [];
  }
}

function extractSameOriginLinks(seedUrl: string, html: string): string[] {
  const seed = new URL(seedUrl);
  const $ = cheerio.load(html);
  const urls: string[] = [];

  $('a[href]').each((_index, element) => {
    const href = $(element).attr('href');
    if (!href) return;

    try {
      const candidate = new URL(href, seedUrl);
      if (candidate.origin !== seed.origin) return;
      if (!isContentUrl(candidate)) return;
      urls.push(candidate.toString());
    } catch {
      // Ignore malformed links.
    }
  });

  return urls;
}

function rankContentUrls(urls: string[], site: string | undefined, maxLinks: number): string[] {
  const origin = site ? new URL(site).origin : undefined;
  const deduped = new Map<string, string>();

  for (const url of urls) {
    try {
      const candidate = new URL(url);
      if (origin && candidate.origin !== origin) continue;
      if (!isContentUrl(candidate)) continue;

      const canonical = canonicalUrl(candidate.toString());
      if (!deduped.has(canonical)) {
        deduped.set(canonical, canonical);
      }
    } catch {
      // Ignore malformed URLs from sitemaps and pages.
    }
  }

  return [...deduped.values()]
    .sort((a, b) => {
      const rankDelta = urlRank(a) - urlRank(b);
      return rankDelta === 0 ? a.localeCompare(b) : rankDelta;
    })
    .slice(0, Math.max(1, maxLinks));
}

function isContentUrl(url: URL): boolean {
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return false;

  const pathname = url.pathname.toLowerCase();
  const ext = path.extname(pathname);
  if (ext && NON_CONTENT_EXTENSIONS.has(ext)) return false;

  return !/(^|\/)(admin|cart|checkout|draft|drafts|feed|login|logout|private|search|sign-in|signin|wp-admin)(\/|$)/.test(
    pathname
  );
}

function canonicalUrl(value: string): string {
  const url = new URL(value);
  url.hash = '';
  url.search = '';
  url.pathname = url.pathname.replace(/\/{2,}/g, '/');
  if (url.pathname !== '/') {
    url.pathname = url.pathname.replace(/\/+$/, '');
  }
  return url.toString();
}

function toPublicUrl(value: string, publicOrigin: string | undefined): string {
  if (!publicOrigin) return value;

  const url = new URL(value);
  const publicUrl = new URL(publicOrigin);
  publicUrl.pathname = url.pathname;
  publicUrl.search = url.search;
  publicUrl.hash = '';
  return canonicalUrl(publicUrl.toString());
}

function urlRank(value: string): number {
  const pathname = new URL(value).pathname.toLowerCase();
  if (pathname === '/') return 0;
  if (/(^|\/)(docs|documentation|guide|guides|learn)(\/|$)/.test(pathname)) return 10;
  if (/(^|\/)(api|reference|sdk|cli)(\/|$)/.test(pathname)) return 20;
  if (/(^|\/)(features|pricing|product|solutions|customers)(\/|$)/.test(pathname)) return 30;
  if (/(^|\/)(about|contact|company)(\/|$)/.test(pathname)) return 40;
  if (/(^|\/)(blog|posts|articles|news)(\/|$)/.test(pathname)) return 50;
  if (/(^|\/)(changelog|releases|legal|privacy|terms)(\/|$)/.test(pathname)) return 80;
  return 60;
}

function stripFrontmatter(raw: string): string {
  return raw.replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n?/, '');
}
