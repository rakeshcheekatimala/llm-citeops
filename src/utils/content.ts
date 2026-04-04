import * as cheerio from 'cheerio';

type LoadedDom = ReturnType<typeof cheerio.load>;

export interface ExtractedContent {
  text: string;
  rootSelector: string;
}

export function createContentDom(html: string): LoadedDom {
  const $ = cheerio.load(html);

  $('script, style, noscript, template, svg').remove();
  $('nav, footer, header, aside').remove();
  $('[role="navigation"], [aria-label="breadcrumb"], .breadcrumb, .breadcrumbs').remove();

  return $;
}

export function extractPrimaryContent($: LoadedDom): ExtractedContent {
  const content$ = createContentDom($.html());

  const candidates = ['article', 'main', '[role="main"]', '.content', '#content'];

  for (const selector of candidates) {
    const node = content$(selector).first();
    const text = normalizeText(node.text());
    if (text.split(/\s+/).filter(Boolean).length >= 80) {
      return {
        text,
        rootSelector: selector,
      };
    }
  }

  return {
    text: normalizeText(content$('body').text()),
    rootSelector: 'body',
  };
}

function normalizeText(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}
