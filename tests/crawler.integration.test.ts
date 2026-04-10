import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import test, { after, before } from 'node:test';
import { parseLocalDir, parseLocalFile } from '../.test-dist/crawler/local-parser.js';
import { fetchUrl } from '../.test-dist/crawler/url-fetcher.js';
import { fetchSitemapUrls } from '../.test-dist/crawler/sitemap.js';
import { isAllowed } from '../.test-dist/crawler/robots.js';
import { crawl } from '../.test-dist/crawler/index.js';
import { createTempDir } from './helpers.ts';

let server: http.Server;
let baseUrl: string;

before(async () => {
  server = http.createServer((req, res) => {
    if (!req.url) {
      res.writeHead(404).end();
      return;
    }

    if (req.url === '/robots.txt') {
      res.writeHead(200, { 'content-type': 'text/plain' });
      res.end('User-agent: *\nDisallow: /blocked\n');
      return;
    }

    if (req.url === '/page') {
      res.writeHead(200, { 'content-type': 'text/html' });
      res.end('<html><body><article><p>Allowed page.</p></article></body></html>');
      return;
    }

    if (req.url === '/slow') {
      setTimeout(() => {
        res.writeHead(200, { 'content-type': 'text/html' });
        res.end('<html><body><p>Slow page.</p></body></html>');
      }, 25);
      return;
    }

    if (req.url === '/blocked') {
      res.writeHead(200, { 'content-type': 'text/html' });
      res.end('<html><body><p>Blocked page.</p></body></html>');
      return;
    }

    if (req.url === '/missing') {
      res.writeHead(500).end('boom');
      return;
    }

    if (req.url === '/sitemap.xml') {
      res.writeHead(200, { 'content-type': 'application/xml' });
      res.end(
        `<?xml version="1.0" encoding="UTF-8"?>
        <sitemapindex>
          <sitemap><loc>${baseUrl}/nested.xml</loc></sitemap>
        </sitemapindex>`
      );
      return;
    }

    if (req.url === '/nested.xml') {
      res.writeHead(200, { 'content-type': 'application/xml' });
      res.end(
        `<?xml version="1.0" encoding="UTF-8"?>
        <urlset>
          <url><loc>${baseUrl}/page</loc></url>
          <url><loc>${baseUrl}/blocked</loc></url>
          <url><loc>${baseUrl}/missing</loc></url>
        </urlset>`
      );
      return;
    }

    res.writeHead(404).end('not found');
  });

  await new Promise<void>((resolve) => {
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      if (!address || typeof address === 'string') {
        throw new Error('Failed to bind test server');
      }
      baseUrl = `http://127.0.0.1:${address.port}`;
      resolve();
    });
  });
});

after(async () => {
  await new Promise<void>((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  });
});

test('local parser handles markdown, html, missing files, and directories', async () => {
  const tempDir = createTempDir();
  const mdPath = path.join(tempDir, 'sample.md');
  const htmlPath = path.join(tempDir, 'sample.html');
  const txtPath = path.join(tempDir, 'ignore.txt');

  fs.writeFileSync(mdPath, '# Heading\n\nBody text.', 'utf-8');
  fs.writeFileSync(htmlPath, '<html><body><p>Hello</p></body></html>', 'utf-8');
  fs.writeFileSync(txtPath, 'ignored', 'utf-8');

  const mdPage = await parseLocalFile(mdPath);
  assert.match(mdPage.html, /<h1/);

  const htmlPage = await parseLocalFile(htmlPath);
  assert.match(htmlPage.html, /<p>Hello/);

  await assert.rejects(() => parseLocalFile(path.join(tempDir, 'missing.md')), /File not found/);
  await assert.rejects(() => parseLocalFile(txtPath), /Unsupported file type/);

  const pages = await parseLocalDir(tempDir);
  assert.equal(pages.length, 2);
  await assert.rejects(() => parseLocalDir(path.join(tempDir, 'missing-dir')), /Directory not found/);
  await assert.rejects(() => parseLocalDir(mdPath), /Not a directory/);
});

test('url fetcher returns HTML, throws on bad responses, and respects rate waits', async () => {
  const first = await fetchUrl(`${baseUrl}/page`, { rateMs: 0 });
  assert.match(first.html, /Allowed page/);

  const started = Date.now();
  await fetchUrl(`${baseUrl}/page`, { rateMs: 30 });
  const elapsed = Date.now() - started;
  assert.ok(elapsed >= 20);

  await assert.rejects(() => fetchUrl(`${baseUrl}/missing`, { rateMs: 0 }), /HTTP 500/);
});

test('robots and sitemap helpers handle allowlists, recursion, and errors', async () => {
  assert.equal(await isAllowed(`${baseUrl}/page`, false), true);
  assert.equal(await isAllowed(`${baseUrl}/blocked`, false), false);
  assert.equal(await isAllowed(`${baseUrl}/blocked`, true), true);
  assert.equal(await isAllowed('notaurl', false), true);

  const urls = await fetchSitemapUrls(`${baseUrl}/sitemap.xml`);
  assert.deepEqual(urls.sort(), [`${baseUrl}/blocked`, `${baseUrl}/missing`, `${baseUrl}/page`].sort());
  await assert.rejects(() => fetchSitemapUrls(`${baseUrl}/missing`), /HTTP 500/);
});

test('crawl handles file, directory, url, sitemap, and missing-input flows', async () => {
  const tempDir = createTempDir();
  const mdPath = path.join(tempDir, 'doc.md');
  const htmlPath = path.join(tempDir, 'doc.html');
  fs.writeFileSync(mdPath, '# Hello\n\nBody', 'utf-8');
  fs.writeFileSync(htmlPath, '<html><body><p>Hello</p></body></html>', 'utf-8');

  const filePages = await crawl({
    file: mdPath,
    output: 'json',
    probe: false,
    models: [],
    threshold: 70,
    ci: false,
    ignoreRobots: false,
    depth: 1,
    rate: 1,
  });
  assert.equal(filePages.length, 1);

  const dirPages = await crawl({
    dir: tempDir,
    output: 'csv',
    probe: false,
    models: [],
    threshold: 70,
    ci: false,
    ignoreRobots: false,
    depth: 1,
    rate: 1,
  });
  assert.equal(dirPages.length, 2);

  const urlPages = await crawl({
    url: `${baseUrl}/page`,
    output: 'html',
    probe: false,
    models: [],
    threshold: 70,
    ci: false,
    ignoreRobots: false,
    depth: 1,
    rate: 50,
  });
  assert.equal(urlPages.length, 1);

  const sitemapPages = await crawl({
    sitemap: `${baseUrl}/sitemap.xml`,
    output: 'csv',
    probe: false,
    models: [],
    threshold: 70,
    ci: false,
    ignoreRobots: false,
    depth: 1,
    rate: 50,
  });
  assert.equal(sitemapPages.length, 1);
  assert.equal(sitemapPages[0].url, `${baseUrl}/page`);

  await assert.rejects(
    () =>
      crawl({
        url: `${baseUrl}/blocked`,
        output: 'html',
        probe: false,
        models: [],
        threshold: 70,
        ci: false,
        ignoreRobots: false,
        depth: 1,
        rate: 1,
      }),
    /robots\.txt disallows/
  );

  await assert.rejects(
    () =>
      crawl({
        output: 'html',
        probe: false,
        models: [],
        threshold: 70,
        ci: false,
        ignoreRobots: false,
        depth: 1,
        rate: 1,
      }),
    /No input provided/
  );
});
