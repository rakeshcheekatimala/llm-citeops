import assert from 'node:assert/strict';
import test from 'node:test';
import { auditFaqSchema } from '../.test-dist/audits/aeo/faq-schema.js';
import { auditDirectAnswer } from '../.test-dist/audits/aeo/direct-answer.js';
import { auditQaDensity } from '../.test-dist/audits/aeo/qa-density.js';
import { auditReadability } from '../.test-dist/audits/aeo/readability.js';
import { auditNamedEntities } from '../.test-dist/audits/aeo/named-entities.js';
import { auditAuthorByline } from '../.test-dist/audits/aeo/author-byline.js';
import { auditTopicalDepth } from '../.test-dist/audits/geo/topical-depth.js';
import { auditTrustSignals } from '../.test-dist/audits/geo/trust-signals.js';
import { auditContentFreshness } from '../.test-dist/audits/geo/content-freshness.js';
import { auditExternalLinks } from '../.test-dist/audits/geo/external-links.js';
import { auditComparisonContent } from '../.test-dist/audits/geo/comparison-content.js';
import { auditCitationLikelihood } from '../.test-dist/audits/geo/citation-likelihood.js';
import { runAudits } from '../.test-dist/audits/runner.js';
import { makeContext, readFixture, repeatSentence } from './helpers.ts';

test('faq schema audit detects valid FAQPage and ignores invalid JSON-LD', () => {
  const ctx = makeContext(`
    <html><head>
      <script type="application/ld+json">not json</script>
      <script type="application/ld+json">{"@type":"FAQPage"}</script>
    </head><body></body></html>
  `);

  const result = auditFaqSchema(ctx);
  assert.equal(result.status, 'pass');
  assert.match(result.evidence, /FAQPage/);
});

test('faq schema audit fails when no qualifying schema exists', () => {
  const result = auditFaqSchema(makeContext('<html><body><p>No schema here.</p></body></html>'));
  assert.equal(result.status, 'fail');
});

test('direct answer audit passes for a clear opening paragraph and fails on empty pages', () => {
  const pass = auditDirectAnswer(
    makeContext('<html><body><p>React hooks are functions that let components use state and effects without classes.</p></body></html>')
  );
  assert.equal(pass.status, 'pass');

  const fail = auditDirectAnswer(makeContext('<html><body></body></html>'));
  assert.equal(fail.status, 'fail');
  assert.match(fail.evidence, /No <p>/);
});

test('Q&A density audit handles short pages and question-rich long pages', () => {
  const short = auditQaDensity(makeContext('<html><body><p>Too short to judge.</p></body></html>'));
  assert.equal(short.status, 'fail');

  const longPass = auditQaDensity(
    makeContext(
      `<html><body><p>${repeatSentence(
        'What is answer engine optimization? Why does it matter? How do teams implement it? Which pages benefit most?',
        12
      )}</p></body></html>`
    )
  );
  assert.equal(longPass.status, 'pass');
});

test('readability audit returns warn for tiny pages, pass for simple prose, and fail for dense prose', () => {
  const warn = auditReadability(makeContext('<html><body><p>Short copy only.</p></body></html>'));
  assert.equal(warn.status, 'warn');

  const simple = auditReadability(
    makeContext(
      `<html><body><p>${repeatSentence(
        'This guide explains search optimization in clear language. Teams can follow each step and improve documentation.',
        10
      )}</p></body></html>`
    )
  );
  assert.equal(simple.status, 'pass');

  const dense = auditReadability(
    makeContext(
      `<html><body><p>${repeatSentence(
        'Notwithstanding the aforementioned interdisciplinary methodological frameworks, organizations must reconceptualize epistemological paradigms governing communicative accessibility.',
        12
      )}</p></body></html>`
    )
  );
  assert.equal(dense.status, 'fail');
});

test('named entity audit distinguishes rich and weak entity coverage', () => {
  const rich = auditNamedEntities(
    makeContext(
      '<html><body><p>Jane Smith from OpenAI presented results in London for Microsoft.</p></body></html>'
    )
  );
  assert.equal(rich.status, 'pass');

  const weak = auditNamedEntities(
    makeContext('<html><body><p>This page discusses generic ideas without named references.</p></body></html>')
  );
  assert.equal(weak.status, 'fail');
});

test('author byline audit detects HTML, meta, and JSON-LD author signals', () => {
  const pass = auditAuthorByline(
    makeContext(`
      <html><head>
        <meta name="author" content="Casey Writer" />
        <script type="application/ld+json">{"author":{"name":"Casey Writer"}}</script>
      </head>
      <body><span rel="author">Casey Writer</span></body></html>
    `)
  );
  assert.equal(pass.status, 'pass');

  const fail = auditAuthorByline(makeContext('<html><body><p>No author.</p></body></html>'));
  assert.equal(fail.status, 'fail');
});

test('topical depth audit identifies heading coverage of main terms', () => {
  const pass = auditTopicalDepth(
    makeContext(`
      <html><body>
        <h1>Answer optimization guide</h1>
        <h2>Optimization strategy</h2>
        <h2>Search visibility</h2>
        <h2>Documentation citations</h2>
        <p>${repeatSentence(
          'Optimization strategy improves search visibility and documentation citations for answer systems.',
          20
        )}</p>
      </body></html>
    `)
  );
  assert.equal(pass.status, 'pass');

  const fail = auditTopicalDepth(
    makeContext(`
      <html><body>
        <h1>Generic heading</h1>
        <p>${repeatSentence(
          'Optimization strategy improves search visibility and documentation citations for answer systems.',
          20
        )}</p>
      </body></html>
    `)
  );
  assert.equal(fail.status, 'fail');
});

test('trust signals audit captures strong EEAT signals and flags missing ones', () => {
  const pass = auditTrustSignals(
    makeContext(`
      <html><head>
        <meta name="author" content="A. Author" />
        <meta property="article:published_time" content="2026-01-01T00:00:00Z" />
        <script type="application/ld+json">
          {"publisher":{"name":"CiteOps"},"citation":"https://example.org/source","about":{"name":"AEO"}}
        </script>
      </head><body>
        <a href="https://developer.mozilla.org/docs/Web/HTML">MDN</a>
        <a href="https://www.w3.org/TR/json-ld11/">W3C</a>
      </body></html>
    `)
  );
  assert.equal(pass.status, 'pass');

  const fail = auditTrustSignals(makeContext('<html><body><p>No trust signals.</p></body></html>'));
  assert.equal(fail.status, 'fail');
});

test('content freshness audit handles recent, missing, and invalid date data', () => {
  const fresh = auditContentFreshness(
    makeContext('<html><head><meta property="article:modified_time" content="2026-02-01T00:00:00Z" /></head><body></body></html>')
  );
  assert.equal(fresh.status, 'pass');

  const invalid = auditContentFreshness(
    makeContext('<html><head><meta property="article:modified_time" content="not-a-date" /></head><body></body></html>')
  );
  assert.equal(invalid.status, 'fail');
  assert.match(invalid.evidence, /could not be parsed/);

  const missing = auditContentFreshness(makeContext('<html><body></body></html>'));
  assert.equal(missing.status, 'fail');
});

test('external links audit requires at least two followable external citations', () => {
  const pass = auditExternalLinks(
    makeContext(`
      <html><body>
        <a href="https://developer.mozilla.org/docs/Web/HTML">MDN</a>
        <a href="https://www.w3.org/TR/json-ld11/">W3C</a>
      </body></html>
    `)
  );
  assert.equal(pass.status, 'pass');

  const fail = auditExternalLinks(
    makeContext(`
      <html><body>
        <a href="https://developer.mozilla.org/docs/Web/HTML" rel="nofollow">MDN</a>
      </body></html>
    `)
  );
  assert.equal(fail.status, 'fail');
});

test('comparison content audit passes for vs headings or tables and fails otherwise', () => {
  const withHeading = auditComparisonContent(
    makeContext('<html><body><h2>Notion vs Asana</h2></body></html>')
  );
  assert.equal(withHeading.status, 'pass');

  const withTable = auditComparisonContent(
    makeContext('<html><body><table><tr><td>A</td><td>B</td></tr></table></body></html>')
  );
  assert.equal(withTable.status, 'pass');

  const fail = auditComparisonContent(makeContext('<html><body><p>No comparisons.</p></body></html>'));
  assert.equal(fail.status, 'fail');
});

test('citation likelihood audit rewards combined structure, authorship, citations, and headings', () => {
  const pass = auditCitationLikelihood(
    makeContext(`
      <html><head>
        <meta name="author" content="Alex Writer" />
        <script type="application/ld+json">{"@type":"FAQPage"}</script>
      </head><body>
        <h2>Section one</h2><h2>Section two</h2><h3>Section three</h3>
        <a href="https://developer.mozilla.org/docs/Web/HTML">MDN</a>
        <a href="https://www.w3.org/TR/json-ld11/">W3C</a>
        <a href="https://example.org/source">Source</a>
      </body></html>
    `)
  );
  assert.equal(pass.status, 'pass');

  const fail = auditCitationLikelihood(makeContext('<html><body><p>Thin page.</p></body></html>'));
  assert.equal(fail.status, 'fail');
});

test('runner executes the full audit set on the sample fixture', () => {
  const page = {
    url: 'https://example.com/fixture',
    html: readFixture('examples', 'sample.html'),
  };

  const results = runAudits(page);
  assert.equal(results.length, 12);
  assert.ok(results.some((audit) => audit.id === 'faq_schema' && audit.status === 'pass'));
  assert.ok(results.some((audit) => audit.id === 'readability' && audit.status !== 'pass'));
});
