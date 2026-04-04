import fetch from 'node-fetch';
import { PageContent } from '../types/index.js';

export interface FetchOptions {
  timeoutMs?: number;
  rateMs?: number;
}

let lastFetch = 0;

export async function fetchUrl(
  url: string,
  options: FetchOptions = {}
): Promise<PageContent> {
  const { timeoutMs = 15000, rateMs = 1000 } = options;

  const now = Date.now();
  const waitMs = rateMs - (now - lastFetch);
  if (waitMs > 0) {
    await sleep(waitMs);
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    lastFetch = Date.now();
    const res = await fetch(url, { signal: controller.signal as never });

    if (!res.ok) {
      throw new Error(`HTTP ${res.status} fetching ${url}`);
    }

    const html = await res.text();
    return { url, html };
  } finally {
    clearTimeout(timer);
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
