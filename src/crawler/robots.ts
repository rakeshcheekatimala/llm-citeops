import robotsParser from 'robots-parser';
import fetch from 'node-fetch';

const cache = new Map<string, ReturnType<typeof robotsParser>>();

export async function isAllowed(
  pageUrl: string,
  ignoreRobots: boolean
): Promise<boolean> {
  if (ignoreRobots) return true;

  try {
    const { origin } = new URL(pageUrl);
    const robotsUrl = `${origin}/robots.txt`;

    let robots = cache.get(origin);
    if (!robots) {
      const res = await fetch(robotsUrl, { signal: AbortSignal.timeout(5000) });
      const text = res.ok ? await res.text() : '';
      robots = robotsParser(robotsUrl, text);
      cache.set(origin, robots);
    }

    return robots.isAllowed(pageUrl, 'citeops') ?? true;
  } catch {
    return true;
  }
}
