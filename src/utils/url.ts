import { getDomain } from 'tldts';

export function getRootDomain(urlOrHostname: string): string {
  try {
    const hostname = new URL(urlOrHostname).hostname;
    return getDomain(hostname) ?? hostname;
  } catch {
    return getDomain(urlOrHostname) ?? urlOrHostname;
  }
}

export function isExternalUrl(targetUrl: string, sourceUrl: string): boolean {
  try {
    const target = new URL(targetUrl);
    if (!/^https?:$/.test(target.protocol)) {
      return false;
    }

    const targetRoot = getRootDomain(target.hostname);
    const sourceRoot = getRootDomain(sourceUrl);

    return Boolean(targetRoot && sourceRoot && targetRoot !== sourceRoot);
  } catch {
    return false;
  }
}
