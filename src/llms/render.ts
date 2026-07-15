import { LlmsDocument } from './types.js';

const SECTION_ORDER = ['Docs', 'API', 'Product', 'Blog', 'Site', 'Optional'];

export function renderLlmsTxt(document: LlmsDocument): string {
  const lines: string[] = [
    `# ${escapeMarkdownText(document.siteName)}`,
    '',
    `> ${escapeMarkdownText(document.summary)}`,
    '',
    document.details,
    '',
  ];

  for (const section of orderedSections(document)) {
    const pages = document.pages.filter((page) => page.section === section);
    if (pages.length === 0) continue;

    lines.push(`## ${section}`, '');
    for (const page of pages) {
      lines.push(
        `- [${escapeLinkText(page.title)}](${page.url}): ${escapeMarkdownText(
          page.description
        )}`
      );
    }
    lines.push('');
  }

  return `${lines.join('\n').replace(/\n{3,}/g, '\n\n').trim()}\n`;
}

export function renderLlmsFullTxt(document: LlmsDocument, maxChars: number): string {
  const lines: string[] = [
    `# ${escapeMarkdownText(document.siteName)} Full Context`,
    '',
    `> ${escapeMarkdownText(document.summary)}`,
    '',
  ];

  for (const section of orderedSections(document)) {
    const pages = document.pages.filter((page) => page.section === section);
    if (pages.length === 0) continue;

    lines.push(`## ${section}`, '');
    for (const page of pages) {
      lines.push(`### ${escapeMarkdownText(page.title)}`, '');
      lines.push(`Source: ${page.url}`, '');
      lines.push(escapeMarkdownText(page.description), '');

      const remaining = maxChars - lines.join('\n').length;
      if (remaining <= 0) break;
      lines.push(escapeMarkdownText(page.text).slice(0, remaining).trim(), '');
    }
  }

  return `${lines.join('\n').replace(/\n{3,}/g, '\n\n').trim()}\n`;
}

function orderedSections(document: LlmsDocument): string[] {
  const present = new Set(document.pages.map((page) => page.section));
  const ordered = SECTION_ORDER.filter((section) => present.has(section));
  const custom = [...present].filter((section) => !SECTION_ORDER.includes(section)).sort();
  return [...ordered, ...custom];
}

function escapeLinkText(value: string): string {
  return value.replace(/[[\]]/g, '').trim();
}

function escapeMarkdownText(value: string): string {
  return value.replace(/\r?\n/g, ' ').trim();
}
