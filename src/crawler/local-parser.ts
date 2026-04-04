import fs from 'fs';
import path from 'path';
import { marked } from 'marked';
import { PageContent } from '../types/index.js';

export async function parseLocalFile(filePath: string): Promise<PageContent> {
  if (!fs.existsSync(filePath)) {
    throw new Error(`File not found: ${filePath}`);
  }

  const ext = path.extname(filePath).toLowerCase();
  const raw = fs.readFileSync(filePath, 'utf-8');

  let html: string;
  if (ext === '.md' || ext === '.markdown') {
    html = await marked(raw);
  } else if (ext === '.html' || ext === '.htm') {
    html = raw;
  } else {
    throw new Error(`Unsupported file type: ${ext}. Use .md, .html, or .htm`);
  }

  const url = `file://${path.resolve(filePath)}`;
  return { url, html };
}

export async function parseLocalDir(dirPath: string): Promise<PageContent[]> {
  if (!fs.existsSync(dirPath)) {
    throw new Error(`Directory not found: ${dirPath}`);
  }

  const stat = fs.statSync(dirPath);
  if (!stat.isDirectory()) {
    throw new Error(`Not a directory: ${dirPath}`);
  }

  const files = fs
    .readdirSync(dirPath)
    .filter((f) => /\.(md|markdown|html|htm)$/i.test(f))
    .map((f) => path.join(dirPath, f));

  const pages: PageContent[] = [];
  for (const file of files) {
    try {
      pages.push(await parseLocalFile(file));
    } catch {
      // skip unreadable files
    }
  }
  return pages;
}
