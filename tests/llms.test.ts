import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import test from 'node:test';
import { discoverLlmsSources } from '../src/llms/discover.ts';
import { buildLlmsDocument } from '../src/llms/extract.ts';
import { lintLlmsText } from '../src/llms/lint.ts';
import { renderLlmsFullTxt, renderLlmsTxt } from '../src/llms/render.ts';
import { createTempDir } from './helpers.ts';

test('llms generator discovers local content and renders strict llms files', async () => {
  const dir = createTempDir('answerlint-llms-');
  fs.mkdirSync(path.join(dir, 'docs'), { recursive: true });
  fs.mkdirSync(path.join(dir, 'blog'), { recursive: true });
  fs.mkdirSync(path.join(dir, 'drafts'), { recursive: true });

  fs.writeFileSync(
    path.join(dir, 'docs', 'quick-start.md'),
    [
      '---',
      'title: Quick Start',
      'description: Install AnswerLint and run your first AI visibility audit.',
      '---',
      '',
      '# Quick Start',
      '',
      'Install the CLI and run an audit against a public page.',
    ].join('\n')
  );
  fs.writeFileSync(
    path.join(dir, 'blog', 'ai-roadmaps.html'),
    '<!doctype html><html><head><title>AI Roadmaps</title><meta name="description" content="How llms.txt helps agents navigate your site."></head><body><main><h1>AI Roadmaps</h1><p>Helpful context.</p></main></body></html>'
  );
  fs.writeFileSync(
    path.join(dir, 'about.html'),
    '<!doctype html><html><head><title>About AnswerLint</title></head><body><main><h1>About AnswerLint</h1><p>AnswerLint keeps AI visibility checks reproducible.</p></main></body></html>'
  );
  fs.writeFileSync(path.join(dir, 'notes.txt'), 'ignored');

  const options = {
    dir,
    site: 'https://example.com',
    summary: 'Example.com publishes product docs and AI visibility guidance.',
    outDir: dir,
    full: true,
    maxLinks: 10,
    maxFullChars: 2000,
  };
  const sources = await discoverLlmsSources(options);
  const document = buildLlmsDocument(sources, options);
  const llmsTxt = renderLlmsTxt(document);
  const fullTxt = renderLlmsFullTxt(document, 2000);

  assert.equal(sources.length, 3);
  assert.match(llmsTxt, /# example.com/);
  assert.match(llmsTxt, /> Example.com publishes product docs/);
  assert.doesNotMatch(llmsTxt, /<!doctype/i);
  assert.match(llmsTxt, /## Docs/);
  assert.match(llmsTxt, /https:\/\/example.com\/docs\/quick-start/);
  assert.match(llmsTxt, /## Blog/);
  assert.match(fullTxt, /# example.com Full Context/);
  assert.equal(lintLlmsText(llmsTxt, { strict: true, maxChars: 100000 }).valid, true);
});

test('llms generator expands a website URL using sitemap discovery', async () => {
  const server = await createLlmsSiteServer();

  try {
    const options = {
      url: `${server.origin}/`,
      site: 'https://example.com',
      outDir: createTempDir('answerlint-llms-web-'),
      full: false,
      maxLinks: 10,
      maxFullChars: 2000,
    };
    const sources = await discoverLlmsSources(options);
    const document = buildLlmsDocument(sources, options);
    const llmsTxt = renderLlmsTxt(document);

    assert.equal(sources.length, 4);
    assert.match(llmsTxt, /# example\.com/);
    assert.match(llmsTxt, /## Docs/);
    assert.match(llmsTxt, /Getting Started/);
    assert.match(llmsTxt, /## API/);
    assert.match(llmsTxt, /HTTP API/);
    assert.match(llmsTxt, /## Blog/);
    assert.doesNotMatch(llmsTxt, /external\.example/);
    assert.equal(lintLlmsText(llmsTxt, { strict: true, maxChars: 100000 }).valid, true);
  } finally {
    await server.close();
  }
});

test('llms linter catches malformed structure, duplicate URLs, private URLs, and strict warnings', () => {
  const invalid = [
    '# Example',
    '',
    '## Docs',
    '',
    '- [Docs](https://example.com/docs)',
    '- [Duplicate](https://example.com/docs): repeated',
    '- [Admin](https://example.com/admin): private',
    '- not a markdown link',
  ].join('\n');

  const relaxed = lintLlmsText(invalid, { strict: false, maxChars: 100000 });
  assert.equal(relaxed.valid, false);
  assert.ok(relaxed.issues.some((issue) => /blockquote summary/.test(issue.message)));
  assert.ok(relaxed.issues.some((issue) => /Duplicate URL/.test(issue.message)));
  assert.ok(relaxed.issues.some((issue) => /private/.test(issue.message)));
  assert.ok(relaxed.issues.some((issue) => /List items must use/.test(issue.message)));

  const warningOnly = [
    '# Example',
    '',
    '> Useful docs.',
    '',
    '## Docs',
    '',
    '- [Docs](https://example.com/docs)',
  ].join('\n');

  assert.equal(lintLlmsText(warningOnly, { strict: false, maxChars: 100000 }).valid, true);
  assert.equal(lintLlmsText(warningOnly, { strict: true, maxChars: 100000 }).valid, false);
});

async function createLlmsSiteServer(): Promise<{
  origin: string;
  close: () => Promise<void>;
}> {
  const server = http.createServer((req, res) => {
    if (req.url === '/sitemap.xml') {
      res.setHeader('content-type', 'application/xml; charset=utf-8');
      res.end(`<?xml version="1.0" encoding="UTF-8"?>
        <urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
          <url><loc>http://${req.headers.host}/docs/getting-started</loc></url>
          <url><loc>http://${req.headers.host}/api/http</loc></url>
          <url><loc>http://${req.headers.host}/blog/launch</loc></url>
          <url><loc>http://${req.headers.host}/admin/secret</loc></url>
        </urlset>`);
      return;
    }

    res.setHeader('content-type', 'text/html; charset=utf-8');

    if (req.url === '/') {
      res.end(`
        <!doctype html>
        <html>
          <head>
            <title>Example Docs</title>
            <meta name="description" content="Example Docs publishes implementation guidance for AI-ready sites.">
          </head>
          <body>
            <main>
              <h1>Example Docs</h1>
              <p>Example Docs publishes implementation guidance for AI-ready sites.</p>
              <a href="/docs/getting-started">Docs</a>
              <a href="https://external.example/page">External</a>
            </main>
          </body>
        </html>
      `);
      return;
    }

    if (req.url === '/docs/getting-started') {
      res.end(pageHtml('Getting Started', 'Install the product and publish your first llms.txt file.'));
      return;
    }

    if (req.url === '/api/http') {
      res.end(pageHtml('HTTP API', 'Use the HTTP API to automate AI-readable content workflows.'));
      return;
    }

    if (req.url === '/blog/launch') {
      res.end(pageHtml('Launch Notes', 'How the team designed a better website roadmap for agents.'));
      return;
    }

    res.statusCode = 404;
    res.end('');
  });

  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  assert.ok(address && typeof address === 'object');

  return {
    origin: `http://127.0.0.1:${address.port}`,
    close: () => new Promise((resolve) => server.close(() => resolve())),
  };
}

function pageHtml(title: string, description: string): string {
  return `
    <!doctype html>
    <html>
      <head>
        <title>${title}</title>
        <meta name="description" content="${description}">
      </head>
      <body>
        <main>
          <h1>${title}</h1>
          <p>${description}</p>
        </main>
      </body>
    </html>
  `;
}
