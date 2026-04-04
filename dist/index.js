#!/usr/bin/env node
"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));

// src/cli/index.ts
var import_commander = require("commander");

// src/cli/commands/audit.ts
var import_ora = __toESM(require("ora"));
var import_chalk = __toESM(require("chalk"));

// src/config/index.ts
var import_fs = __toESM(require("fs"));
var import_path = __toESM(require("path"));

// src/types/index.ts
var DEFAULT_WEIGHTS = {
  faq_schema: 1.5,
  direct_answer: 1.5,
  qa_density: 1.5,
  readability: 1,
  named_entities: 1,
  author_byline: 1,
  topical_depth: 1.3,
  trust_signals: 1.3,
  content_freshness: 1.2,
  external_links: 1,
  comparison_content: 1,
  citation_likelihood: 1.3
};

// src/config/index.ts
var DEFAULT_CONFIG = {
  audit: {
    aeo_weight: 0.5,
    geo_weight: 0.5,
    custom_weights: { ...DEFAULT_WEIGHTS }
  },
  probe: {
    enabled: false,
    models: ["gpt4o", "claude"],
    cache_ttl_days: 7
  },
  ci: {
    threshold: 70,
    fail_on_drop: true
  }
};
function loadConfig(configPath) {
  const searchPaths = [
    configPath,
    import_path.default.join(process.cwd(), ".citeops.json"),
    import_path.default.join(process.env.HOME ?? "", ".citeops.json")
  ].filter(Boolean);
  let fileConfig = {};
  for (const p of searchPaths) {
    if (import_fs.default.existsSync(p)) {
      try {
        const raw = import_fs.default.readFileSync(p, "utf-8");
        fileConfig = JSON.parse(raw);
        break;
      } catch {
        throw new Error(`Invalid JSON in config file: ${p}`);
      }
    }
  }
  return mergeConfig(DEFAULT_CONFIG, fileConfig);
}
function mergeConfig(defaults, override) {
  return {
    audit: {
      aeo_weight: override.audit?.aeo_weight ?? defaults.audit.aeo_weight,
      geo_weight: override.audit?.geo_weight ?? defaults.audit.geo_weight,
      custom_weights: {
        ...defaults.audit.custom_weights,
        ...override.audit?.custom_weights ?? {}
      }
    },
    probe: {
      enabled: override.probe?.enabled ?? defaults.probe.enabled,
      models: override.probe?.models ?? defaults.probe.models,
      cache_ttl_days: override.probe?.cache_ttl_days ?? defaults.probe.cache_ttl_days
    },
    ci: {
      threshold: override.ci?.threshold ?? defaults.ci.threshold,
      fail_on_drop: override.ci?.fail_on_drop ?? defaults.ci.fail_on_drop
    }
  };
}
function getWeight(config, auditId) {
  return config.audit.custom_weights[auditId] ?? DEFAULT_WEIGHTS[auditId] ?? 1;
}

// src/crawler/url-fetcher.ts
var import_node_fetch = __toESM(require("node-fetch"));
var lastFetch = 0;
async function fetchUrl(url, options = {}) {
  const { timeoutMs = 15e3, rateMs = 1e3 } = options;
  const now = Date.now();
  const waitMs = rateMs - (now - lastFetch);
  if (waitMs > 0) {
    await sleep(waitMs);
  }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    lastFetch = Date.now();
    const res = await (0, import_node_fetch.default)(url, { signal: controller.signal });
    if (!res.ok) {
      throw new Error(`HTTP ${res.status} fetching ${url}`);
    }
    const html = await res.text();
    return { url, html };
  } finally {
    clearTimeout(timer);
  }
}
function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// src/crawler/local-parser.ts
var import_fs2 = __toESM(require("fs"));
var import_path2 = __toESM(require("path"));
var import_marked = require("marked");
async function parseLocalFile(filePath) {
  if (!import_fs2.default.existsSync(filePath)) {
    throw new Error(`File not found: ${filePath}`);
  }
  const ext = import_path2.default.extname(filePath).toLowerCase();
  const raw = import_fs2.default.readFileSync(filePath, "utf-8");
  let html;
  if (ext === ".md" || ext === ".markdown") {
    html = await (0, import_marked.marked)(raw);
  } else if (ext === ".html" || ext === ".htm") {
    html = raw;
  } else {
    throw new Error(`Unsupported file type: ${ext}. Use .md, .html, or .htm`);
  }
  const url = `file://${import_path2.default.resolve(filePath)}`;
  return { url, html };
}
async function parseLocalDir(dirPath) {
  if (!import_fs2.default.existsSync(dirPath)) {
    throw new Error(`Directory not found: ${dirPath}`);
  }
  const stat = import_fs2.default.statSync(dirPath);
  if (!stat.isDirectory()) {
    throw new Error(`Not a directory: ${dirPath}`);
  }
  const files = import_fs2.default.readdirSync(dirPath).filter((f) => /\.(md|markdown|html|htm)$/i.test(f)).map((f) => import_path2.default.join(dirPath, f));
  const pages = [];
  for (const file of files) {
    try {
      pages.push(await parseLocalFile(file));
    } catch {
    }
  }
  return pages;
}

// src/crawler/sitemap.ts
var import_node_fetch2 = __toESM(require("node-fetch"));
var import_fast_xml_parser = require("fast-xml-parser");
var parser = new import_fast_xml_parser.XMLParser({ ignoreAttributes: false });
async function fetchSitemapUrls(sitemapUrl) {
  const res = await (0, import_node_fetch2.default)(sitemapUrl, { signal: AbortSignal.timeout(15e3) });
  if (!res.ok) {
    throw new Error(`HTTP ${res.status} fetching sitemap: ${sitemapUrl}`);
  }
  const xml = await res.text();
  const parsed = parser.parse(xml);
  if (parsed.sitemapindex) {
    const sitemaps = toArray(parsed.sitemapindex.sitemap);
    const nested = await Promise.all(
      sitemaps.map((s) => fetchSitemapUrls(s.loc))
    );
    return nested.flat();
  }
  if (parsed.urlset) {
    const urls = toArray(parsed.urlset.url);
    return urls.map((u) => u.loc).filter(Boolean);
  }
  return [];
}
function toArray(val) {
  if (!val) return [];
  return Array.isArray(val) ? val : [val];
}

// src/crawler/robots.ts
var import_robots_parser = __toESM(require("robots-parser"));
var import_node_fetch3 = __toESM(require("node-fetch"));
var cache = /* @__PURE__ */ new Map();
async function isAllowed(pageUrl, ignoreRobots) {
  if (ignoreRobots) return true;
  try {
    const { origin } = new URL(pageUrl);
    const robotsUrl = `${origin}/robots.txt`;
    let robots = cache.get(origin);
    if (!robots) {
      const res = await (0, import_node_fetch3.default)(robotsUrl, { signal: AbortSignal.timeout(5e3) });
      const text = res.ok ? await res.text() : "";
      robots = (0, import_robots_parser.default)(robotsUrl, text);
      cache.set(origin, robots);
    }
    return robots.isAllowed(pageUrl, "citeops") ?? true;
  } catch {
    return true;
  }
}

// src/crawler/index.ts
async function crawl(options) {
  const rateMs = Math.round(1e3 / (options.rate || 1));
  if (options.file) {
    return [await parseLocalFile(options.file)];
  }
  if (options.dir) {
    return parseLocalDir(options.dir);
  }
  if (options.sitemap) {
    const urls = await fetchSitemapUrls(options.sitemap);
    const pages = [];
    for (const url of urls) {
      const allowed = await isAllowed(url, options.ignoreRobots);
      if (!allowed) continue;
      try {
        const page = await fetchUrl(url, { rateMs });
        pages.push(page);
      } catch {
      }
    }
    return pages;
  }
  if (options.url) {
    const allowed = await isAllowed(options.url, options.ignoreRobots);
    if (!allowed) {
      throw new Error(
        `robots.txt disallows crawling ${options.url}. Use --ignore-robots to override.`
      );
    }
    const page = await fetchUrl(options.url, { rateMs });
    return [page];
  }
  throw new Error("No input provided. Use --url, --file, --dir, or --sitemap.");
}

// src/audits/runner.ts
var cheerio = __toESM(require("cheerio"));

// src/audits/aeo/faq-schema.ts
function auditFaqSchema(ctx) {
  const scripts = ctx.$('script[type="application/ld+json"]');
  let found = false;
  let foundType = "";
  scripts.each((_, el) => {
    try {
      const data = JSON.parse(ctx.$(el).html() ?? "{}");
      const type = data["@type"];
      if (type === "FAQPage" || type === "HowTo" || Array.isArray(type) && (type.includes("FAQPage") || type.includes("HowTo"))) {
        found = true;
        foundType = Array.isArray(type) ? type[0] : String(type);
      }
    } catch {
    }
  });
  return {
    id: "faq_schema",
    category: "aeo",
    title: "FAQ / HowTo schema present",
    status: found ? "pass" : "fail",
    weight: 1.5,
    score: found ? 1 : 0,
    evidence: found ? `Found JSON-LD with @type "${foundType}" in <head>.` : 'No <script type="application/ld+json"> with @type FAQPage or HowTo found in <head>.'
  };
}

// src/audits/aeo/direct-answer.ts
function auditDirectAnswer(ctx) {
  const firstParagraph = ctx.$("p").first().text().trim();
  if (!firstParagraph) {
    return {
      id: "direct_answer",
      category: "aeo",
      title: "Direct answer in first paragraph",
      status: "fail",
      weight: 1.5,
      score: 0,
      evidence: "No <p> elements found on page."
    };
  }
  const sentences = firstParagraph.split(/(?<=[.!?])\s+/).map((s) => s.trim()).filter((s) => s.length > 20);
  const hasDirectAnswer = sentences.some(
    (s) => !s.endsWith("?") && s.length >= 30 && !/^(click|read|scroll|learn|find|see|check|welcome|this (page|article|guide|post))/i.test(s)
  );
  const snippet = firstParagraph.length > 150 ? firstParagraph.slice(0, 150) + "\u2026" : firstParagraph;
  return {
    id: "direct_answer",
    category: "aeo",
    title: "Direct answer in first paragraph",
    status: hasDirectAnswer ? "pass" : "fail",
    weight: 1.5,
    score: hasDirectAnswer ? 1 : 0,
    evidence: hasDirectAnswer ? `First paragraph opens with a direct statement: "${snippet}"` : `First paragraph does not start with a direct factual answer: "${snippet}"`
  };
}

// src/audits/aeo/qa-density.ts
function auditQaDensity(ctx) {
  const text = ctx.text;
  const wordCount = text.split(/\s+/).filter(Boolean).length;
  if (wordCount < 50) {
    return {
      id: "qa_density",
      category: "aeo",
      title: "Q&A density (questions per 500 words)",
      status: "fail",
      weight: 1.5,
      score: 0,
      evidence: `Page has too little content (${wordCount} words) to evaluate Q&A density.`
    };
  }
  const questionCount = (text.match(/\?/g) ?? []).length;
  const per500 = questionCount / wordCount * 500;
  const passes = per500 >= 2;
  return {
    id: "qa_density",
    category: "aeo",
    title: "Q&A density (questions per 500 words)",
    status: passes ? "pass" : "fail",
    weight: 1.5,
    score: passes ? 1 : 0,
    evidence: passes ? `Found ${questionCount} questions across ${wordCount} words (${per500.toFixed(1)} per 500 words \u2014 target \u22652).` : `Only ${questionCount} question(s) in ${wordCount} words (${per500.toFixed(1)} per 500 words \u2014 target \u22652). Add question-framed headings or FAQ sections.`
  };
}

// src/audits/aeo/readability.ts
function countSyllables(word) {
  const cleaned = word.toLowerCase().replace(/[^a-z]/g, "");
  if (cleaned.length === 0) return 0;
  if (cleaned.length <= 3) return 1;
  const vowelGroups = cleaned.replace(/(?:[^laeiouy]es|ed|[^laeiouy]e)$/, "").match(/[aeiouy]{1,2}/g);
  return Math.max(1, vowelGroups?.length ?? 1);
}
function auditReadability(ctx) {
  const text = ctx.text.replace(/\s+/g, " ").trim();
  const sentences = text.split(/[.!?]+/).map((s) => s.trim()).filter((s) => s.split(/\s+/).length >= 3);
  const words = text.split(/\s+/).filter((w) => /[a-zA-Z]/.test(w));
  if (sentences.length < 3 || words.length < 30) {
    return {
      id: "readability",
      category: "aeo",
      title: "Readability grade \u2264 10",
      status: "warn",
      weight: 1,
      score: 0,
      evidence: "Not enough content to calculate readability grade."
    };
  }
  const syllableCount = words.reduce((sum, w) => sum + countSyllables(w), 0);
  const avgWordsPerSentence = words.length / sentences.length;
  const avgSyllablesPerWord = syllableCount / words.length;
  const grade = 0.39 * avgWordsPerSentence + 11.8 * avgSyllablesPerWord - 15.59;
  const roundedGrade = Math.round(grade * 10) / 10;
  const passes = roundedGrade <= 10;
  const complexSentences = sentences.filter((s) => s.split(/\s+/).length > 25).slice(0, 2).map((s) => s.length > 120 ? s.slice(0, 120) + "\u2026" : s);
  return {
    id: "readability",
    category: "aeo",
    title: "Readability grade \u2264 10",
    status: passes ? "pass" : "fail",
    weight: 1,
    score: passes ? 1 : 0,
    evidence: passes ? `Flesch-Kincaid grade level: ${roundedGrade} (target \u226410). Avg ${avgWordsPerSentence.toFixed(1)} words/sentence.` : `Flesch-Kincaid grade level: ${roundedGrade} (target \u226410). ${complexSentences.length > 0 ? `Complex sentences detected: "${complexSentences[0]}"` : `Avg ${avgWordsPerSentence.toFixed(1)} words/sentence \u2014 simplify long sentences.`}`
  };
}

// src/audits/aeo/named-entities.ts
var import_compromise = __toESM(require("compromise"));
function auditNamedEntities(ctx) {
  const doc = (0, import_compromise.default)(ctx.text);
  const people = doc.people().out("array");
  const organizations = doc.organizations().out("array");
  const places = doc.places().out("array");
  const uniquePeople = [...new Set(people.map((p) => p.trim()).filter(Boolean))];
  const uniqueOrgs = [...new Set(organizations.map((o) => o.trim()).filter(Boolean))];
  const uniquePlaces = [...new Set(places.map((p) => p.trim()).filter(Boolean))];
  const typesPresent = [
    uniquePeople.length > 0 && "people",
    uniqueOrgs.length > 0 && "organizations",
    uniquePlaces.length > 0 && "places"
  ].filter(Boolean);
  const passes = typesPresent.length >= 2;
  const found = [];
  if (uniquePeople.length > 0)
    found.push(`People: ${uniquePeople.slice(0, 3).join(", ")}`);
  if (uniqueOrgs.length > 0)
    found.push(`Organizations: ${uniqueOrgs.slice(0, 3).join(", ")}`);
  if (uniquePlaces.length > 0)
    found.push(`Places: ${uniquePlaces.slice(0, 3).join(", ")}`);
  const missing = [];
  if (uniquePeople.length === 0) missing.push("people");
  if (uniqueOrgs.length === 0) missing.push("organizations");
  if (uniquePlaces.length === 0) missing.push("places");
  return {
    id: "named_entities",
    category: "aeo",
    title: "Named entity coverage",
    status: passes ? "pass" : "fail",
    weight: 1,
    score: passes ? 1 : 0,
    evidence: passes ? `Found entities across ${typesPresent.length} types. ${found.join(" | ")}` : `Weak named entity coverage \u2014 only ${typesPresent.length} entity type(s) detected. ${found.length > 0 ? found.join(" | ") + "." : ""} Missing: ${missing.join(", ")}.`
  };
}

// src/audits/aeo/author-byline.ts
function auditAuthorByline(ctx) {
  const $ = ctx.$;
  const htmlAuthor = $('[rel="author"]').length > 0 || $('[itemprop="author"]').length > 0 || $('[class*="author"]').length > 0 || $('[id*="author"]').length > 0;
  let jsonLdAuthor = false;
  let authorName = "";
  $('script[type="application/ld+json"]').each((_, el) => {
    try {
      const data = JSON.parse($(el).html() ?? "{}");
      if (data["author"]) {
        jsonLdAuthor = true;
        const author = data["author"];
        if (typeof author === "object" && author["name"]) {
          authorName = author["name"];
        } else if (typeof author === "string") {
          authorName = author;
        }
      }
    } catch {
    }
  });
  const metaAuthor = $('meta[name="author"]').attr("content") ?? "";
  const found = htmlAuthor || jsonLdAuthor || metaAuthor.length > 0;
  const evidence = found ? [
    htmlAuthor ? "HTML author attribute detected" : "",
    jsonLdAuthor ? `JSON-LD author: "${authorName || "present"}"` : "",
    metaAuthor ? `<meta name="author" content="${metaAuthor}">` : ""
  ].filter(Boolean).join("; ") : 'No author byline found. Missing: rel="author", itemprop="author", JSON-LD author field, or <meta name="author">.';
  return {
    id: "author_byline",
    category: "aeo",
    title: "Author byline + credentials present",
    status: found ? "pass" : "fail",
    weight: 1,
    score: found ? 1 : 0,
    evidence
  };
}

// src/audits/geo/topical-depth.ts
function computeTfIdf(text) {
  const stopWords = /* @__PURE__ */ new Set([
    "the",
    "a",
    "an",
    "and",
    "or",
    "but",
    "in",
    "on",
    "at",
    "to",
    "for",
    "of",
    "with",
    "by",
    "from",
    "is",
    "are",
    "was",
    "were",
    "be",
    "been",
    "being",
    "have",
    "has",
    "had",
    "do",
    "does",
    "did",
    "will",
    "would",
    "could",
    "should",
    "may",
    "might",
    "shall",
    "can",
    "this",
    "that",
    "these",
    "those",
    "it",
    "its",
    "they",
    "their",
    "we",
    "our",
    "you",
    "your",
    "he",
    "she",
    "his",
    "her",
    "as",
    "if",
    "so",
    "not",
    "no",
    "also",
    "more",
    "than",
    "then",
    "when",
    "where",
    "how",
    "what",
    "which",
    "who",
    "all",
    "any",
    "each",
    "some",
    "one",
    "two",
    "three",
    "about"
  ]);
  const words = text.toLowerCase().replace(/[^a-z\s]/g, " ").split(/\s+/).filter((w) => w.length > 3 && !stopWords.has(w));
  const freq = /* @__PURE__ */ new Map();
  for (const word of words) {
    freq.set(word, (freq.get(word) ?? 0) + 1);
  }
  return new Map(
    [...freq.entries()].sort((a, b) => b[1] - a[1]).slice(0, 20)
  );
}
function auditTopicalDepth(ctx) {
  const tfidf = computeTfIdf(ctx.text);
  const topTerms = [...tfidf.keys()].slice(0, 10);
  if (topTerms.length < 3) {
    return {
      id: "topical_depth",
      category: "geo",
      title: "Topical depth score (subtopic coverage)",
      status: "fail",
      weight: 1.3,
      score: 0,
      evidence: "Not enough content to compute topical depth."
    };
  }
  const headings = ctx.$("h1, h2, h3, h4").map((_, el) => ctx.$(el).text().toLowerCase()).get();
  const headingText = headings.join(" ");
  const coveredTerms = topTerms.filter((term) => headingText.includes(term));
  const coverageRatio = coveredTerms.length / topTerms.length;
  const passes = coverageRatio >= 0.6;
  const uncoveredTerms = topTerms.filter((t) => !coveredTerms.includes(t));
  return {
    id: "topical_depth",
    category: "geo",
    title: "Topical depth score (subtopic coverage)",
    status: passes ? "pass" : "fail",
    weight: 1.3,
    score: passes ? 1 : 0,
    evidence: passes ? `${coveredTerms.length}/${topTerms.length} top TF-IDF terms covered in headings (${Math.round(coverageRatio * 100)}%). Top terms: ${topTerms.slice(0, 5).join(", ")}.` : `Only ${coveredTerms.length}/${topTerms.length} key terms appear in headings (${Math.round(coverageRatio * 100)}% \u2014 target \u226560%). Missing topics: ${uncoveredTerms.slice(0, 5).join(", ")}.`
  };
}

// src/audits/geo/trust-signals.ts
function auditTrustSignals(ctx) {
  const $ = ctx.$;
  const signals = [];
  const missing = [];
  const hasAuthor = $('[rel="author"]').length > 0 || $('[itemprop="author"]').length > 0 || $('meta[name="author"]').length > 0;
  hasAuthor ? signals.push("author") : missing.push("author");
  let hasOrg = false;
  let hasPublisher = false;
  let hasCitation = false;
  let hasAbout = false;
  $('script[type="application/ld+json"]').each((_idx, el) => {
    try {
      const data = JSON.parse($(el).html() ?? "{}");
      if (data["publisher"] || data["sourceOrganization"]) hasPublisher = true;
      if (data["citation"]) hasCitation = true;
      if (data["about"]) hasAbout = true;
      if (data["@type"] === "Organization") hasOrg = true;
      if (typeof data["author"] === "object") {
        const authorType = data["author"]["@type"];
        if (authorType === "Person" || authorType === "Organization") {
          hasOrg = true;
        }
      }
    } catch {
    }
  });
  hasPublisher ? signals.push("publisher/organization") : missing.push("publisher");
  hasCitation ? signals.push("citations") : missing.push("citation schema");
  hasAbout ? signals.push("about/topic schema") : null;
  const domain = (() => {
    try {
      return new URL(ctx.url).hostname;
    } catch {
      return "";
    }
  })();
  const externalLinks = $("a[href]").filter((_, el) => {
    const href = $(el).attr("href") ?? "";
    return href.startsWith("http") && !href.includes(domain);
  });
  const hasSources = externalLinks.length >= 2;
  hasSources ? signals.push(`${externalLinks.length} external sources`) : missing.push("external source links");
  const hasDate = $('meta[property="article:published_time"]').length > 0 || $('meta[property="article:modified_time"]').length > 0 || $("time[datetime]").length > 0;
  hasDate ? signals.push("publication date") : missing.push("publication date");
  const signalCount = signals.length;
  const passes = signalCount >= 3;
  return {
    id: "trust_signals",
    category: "geo",
    title: "Trust signals (EEAT) \u2014 author, org, sources",
    status: passes ? "pass" : "fail",
    weight: 1.3,
    score: passes ? 1 : 0,
    evidence: passes ? `${signalCount} EEAT signals present: ${signals.join(", ")}.` : `Only ${signalCount} EEAT signal(s) found: ${signals.length > 0 ? signals.join(", ") : "none"}. Missing: ${missing.join(", ")}.`
  };
}

// src/audits/geo/content-freshness.ts
function parseDate(val) {
  if (!val) return null;
  const d = new Date(val);
  return isNaN(d.getTime()) ? null : d;
}
function auditContentFreshness(ctx) {
  const $ = ctx.$;
  const now = /* @__PURE__ */ new Date();
  const twelveMonthsAgo = new Date(now);
  twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 12);
  const candidates = [];
  const metaModified = $('meta[property="article:modified_time"]').attr("content");
  const metaPublished = $('meta[property="article:published_time"]').attr("content");
  const metaDate = $('meta[name="date"]').attr("content");
  const timeEl = $("time[datetime]").first().attr("datetime");
  if (metaModified) candidates.push({ label: "article:modified_time", value: metaModified });
  if (metaPublished) candidates.push({ label: "article:published_time", value: metaPublished });
  if (metaDate) candidates.push({ label: "meta[name=date]", value: metaDate });
  if (timeEl) candidates.push({ label: "<time datetime>", value: timeEl });
  $('script[type="application/ld+json"]').each((_, el) => {
    try {
      const data = JSON.parse($(el).html() ?? "{}");
      if (data["dateModified"])
        candidates.push({ label: "JSON-LD dateModified", value: data["dateModified"] });
      if (data["datePublished"])
        candidates.push({ label: "JSON-LD datePublished", value: data["datePublished"] });
    } catch {
    }
  });
  if (candidates.length === 0) {
    return {
      id: "content_freshness",
      category: "geo",
      title: "Content freshness (publish / modified date)",
      status: "fail",
      weight: 1.2,
      score: 0,
      evidence: "No publication or modification date found. Missing: dateModified, datePublished, article:published_time, or <time datetime>."
    };
  }
  let mostRecent = null;
  let mostRecentLabel = "";
  for (const candidate of candidates) {
    const d = parseDate(candidate.value);
    if (d && (!mostRecent || d > mostRecent)) {
      mostRecent = d;
      mostRecentLabel = `${candidate.label}: ${candidate.value}`;
    }
  }
  if (!mostRecent) {
    return {
      id: "content_freshness",
      category: "geo",
      title: "Content freshness (publish / modified date)",
      status: "fail",
      weight: 1.2,
      score: 0,
      evidence: `Date fields found but could not be parsed: ${candidates.map((c) => c.value).join(", ")}`
    };
  }
  const isFresh = mostRecent >= twelveMonthsAgo;
  const monthsOld = Math.round(
    (now.getTime() - mostRecent.getTime()) / (1e3 * 60 * 60 * 24 * 30)
  );
  return {
    id: "content_freshness",
    category: "geo",
    title: "Content freshness (publish / modified date)",
    status: isFresh ? "pass" : "fail",
    weight: 1.2,
    score: isFresh ? 1 : 0,
    evidence: isFresh ? `Content is fresh \u2014 ${mostRecentLabel} (${monthsOld} month(s) ago).` : `Content may be stale \u2014 ${mostRecentLabel} (${monthsOld} month(s) ago, target \u226412 months). Update the dateModified field.`
  };
}

// src/audits/geo/external-links.ts
function auditExternalLinks(ctx) {
  const $ = ctx.$;
  let domain = "";
  try {
    domain = new URL(ctx.url).hostname;
  } catch {
  }
  const allExternalLinks = [];
  $("a[href]").each((_, el) => {
    const href = $(el).attr("href") ?? "";
    const rel = $(el).attr("rel") ?? "";
    const text = $(el).text().trim();
    if (!href.startsWith("http")) return;
    let linkDomain = "";
    try {
      linkDomain = new URL(href).hostname;
    } catch {
      return;
    }
    if (domain && linkDomain === domain) return;
    const nofollow = rel.includes("nofollow");
    allExternalLinks.push({ href, text, nofollow });
  });
  const followLinks = allExternalLinks.filter((l) => !l.nofollow);
  const passes = followLinks.length >= 2;
  const examples = followLinks.slice(0, 3).map((l) => `${l.text || l.href} (${l.href})`).join(", ");
  const nofollowCount = allExternalLinks.length - followLinks.length;
  return {
    id: "external_links",
    category: "geo",
    title: "External citation / link quality",
    status: passes ? "pass" : "fail",
    weight: 1,
    score: passes ? 1 : 0,
    evidence: passes ? `${followLinks.length} non-nofollow external link(s) found${nofollowCount > 0 ? ` (+${nofollowCount} nofollow)` : ""}. Examples: ${examples}` : `Only ${followLinks.length} qualifying external link(s) found (target \u22652)${nofollowCount > 0 ? `, ${nofollowCount} are nofollow` : ""}. Add authoritative external citations to improve trust signals.`
  };
}

// src/audits/geo/comparison-content.ts
var COMPARISON_PATTERNS = [
  /\bvs\.?\b/i,
  /\bversus\b/i,
  /\bcompared?\s+to\b/i,
  /\bcomparison\b/i,
  /\balternatives?\b/i,
  /\bbest\s+\w+\b/i,
  /\btop\s+\d+\b/i,
  /\bpros?\s+(and|&|vs)\s+cons?\b/i,
  /\bdifference[s]?\s+between\b/i,
  /\bwhich\s+(is\s+)?(better|best)\b/i
];
function auditComparisonContent(ctx) {
  const $ = ctx.$;
  const headings = [];
  $("h1, h2, h3, h4").each((_, el) => {
    headings.push($(el).text().trim());
  });
  const matchedHeadings = [];
  for (const heading of headings) {
    if (COMPARISON_PATTERNS.some((p) => p.test(heading))) {
      matchedHeadings.push(heading);
    }
  }
  const hasTables = $("table").length > 0;
  const tableBonus = hasTables ? 1 : 0;
  const passes = matchedHeadings.length > 0 || tableBonus > 0;
  return {
    id: "comparison_content",
    category: "geo",
    title: "Comparison content present",
    status: passes ? "pass" : "fail",
    weight: 1,
    score: passes ? 1 : 0,
    evidence: passes ? `Comparison signals detected: ${matchedHeadings.length > 0 ? `headings matching comparison patterns: "${matchedHeadings[0]}"` : ""}${hasTables ? `${matchedHeadings.length > 0 ? "; " : ""}comparison table(s) present` : ""}.` : 'No comparison-oriented content found. No headings with "vs", "alternatives", "best", "compared to" patterns, and no comparison tables.'
  };
}

// src/audits/geo/citation-likelihood.ts
function auditCitationLikelihood(ctx) {
  const $ = ctx.$;
  const signals = [];
  const missing = [];
  const hasSchema = $('script[type="application/ld+json"]').length > 0;
  hasSchema ? signals.push("structured schema") : missing.push("JSON-LD schema");
  const hasAuthor = $('[rel="author"]').length > 0 || $('[itemprop="author"]').length > 0 || $('meta[name="author"]').length > 0;
  hasAuthor ? signals.push("author byline") : missing.push("author byline");
  let hasFaq = false;
  $('script[type="application/ld+json"]').each((_, el) => {
    try {
      const data = JSON.parse($(el).html() ?? "{}");
      if (data["@type"] === "FAQPage" || data["@type"] === "HowTo") {
        hasFaq = true;
      }
    } catch {
    }
  });
  hasFaq ? signals.push("FAQ/HowTo schema") : missing.push("FAQ/HowTo schema");
  let domain = "";
  try {
    domain = new URL(ctx.url).hostname;
  } catch {
  }
  const externalLinks = $("a[href]").filter((_, el) => {
    const href = $(el).attr("href") ?? "";
    if (!href.startsWith("http")) return false;
    try {
      return new URL(href).hostname !== domain;
    } catch {
      return false;
    }
  }).length;
  const hasCitations = externalLinks >= 3;
  hasCitations ? signals.push(`${externalLinks} external citations`) : missing.push(`\u22653 external citations (found ${externalLinks})`);
  const hasStructure = $("h2, h3").length >= 3;
  hasStructure ? signals.push("well-structured headings") : missing.push("structured headings (H2/H3 \u22653)");
  const signalScore = signals.length;
  const passes = signalScore >= 3;
  return {
    id: "citation_likelihood",
    category: "geo",
    title: "Citation likelihood signals",
    status: passes ? "pass" : "fail",
    weight: 1.3,
    score: passes ? 1 : 0,
    evidence: passes ? `${signalScore}/5 citation likelihood signals present: ${signals.join(", ")}.` : `Only ${signalScore}/5 citation signals present${signals.length > 0 ? `: ${signals.join(", ")}` : ""}. Missing: ${missing.join("; ")}.`
  };
}

// src/audits/runner.ts
function runAudits(page) {
  const $ = cheerio.load(page.html);
  $("script, style, noscript").remove();
  const text = $("body").text().replace(/\s+/g, " ").trim();
  const ctx = {
    url: page.url,
    html: page.html,
    text,
    $
  };
  return [
    auditFaqSchema(ctx),
    auditDirectAnswer(ctx),
    auditQaDensity(ctx),
    auditReadability(ctx),
    auditNamedEntities(ctx),
    auditAuthorByline(ctx),
    auditTopicalDepth(ctx),
    auditTrustSignals(ctx),
    auditContentFreshness(ctx),
    auditExternalLinks(ctx),
    auditComparisonContent(ctx),
    auditCitationLikelihood(ctx)
  ];
}

// src/scoring/index.ts
function computeScores(audits, config) {
  const aeoAudits = audits.filter((a) => a.category === "aeo");
  const geoAudits = audits.filter((a) => a.category === "geo");
  const aeoScore = weightedAvg(aeoAudits, config) * 100;
  const geoScore = weightedAvg(geoAudits, config) * 100;
  const composite = aeoScore * config.audit.aeo_weight + geoScore * config.audit.geo_weight;
  const rounded = {
    aeo: Math.round(aeoScore),
    geo: Math.round(geoScore),
    composite: Math.round(composite)
  };
  return {
    ...rounded,
    band: scoreBand(rounded.composite),
    percentile: null
  };
}
function weightedAvg(audits, config) {
  if (audits.length === 0) return 0;
  let weightedSum = 0;
  let totalWeight = 0;
  for (const audit of audits) {
    const weight = getWeight(config, audit.id);
    weightedSum += audit.score * weight;
    totalWeight += weight;
  }
  return totalWeight > 0 ? weightedSum / totalWeight : 0;
}
function scoreBand(score) {
  if (score >= 90) return "excellent";
  if (score >= 75) return "good";
  if (score >= 50) return "needs-improvement";
  return "poor";
}
function bandColor(band) {
  switch (band) {
    case "excellent":
      return "#0cce6b";
    case "good":
      return "#0cce6b";
    case "needs-improvement":
      return "#ffa400";
    case "poor":
      return "#ff4e42";
  }
}
function bandLabel(band) {
  switch (band) {
    case "excellent":
      return "Excellent";
    case "good":
      return "Good";
    case "needs-improvement":
      return "Needs Improvement";
    case "poor":
      return "Poor";
  }
}

// src/recommendations/index.ts
var WEIGHT_TO_PRIORITY = [
  [1.3, "high"],
  [1, "medium"],
  [0, "low"]
];
function priorityFromWeight(weight) {
  for (const [threshold, priority] of WEIGHT_TO_PRIORITY) {
    if (weight >= threshold) return priority;
  }
  return "low";
}
function scoreImpact(audit) {
  return Math.round(audit.weight * 5);
}
var RECOMMENDATIONS = {
  faq_schema: (audit) => ({
    priority: priorityFromWeight(audit.weight),
    score_impact: scoreImpact(audit),
    instruction: "Add a FAQPage or HowTo JSON-LD block to your <head>. LLMs heavily weight structured FAQ schema when selecting content to cite in answer responses. Pages without it are deprioritized in AI summaries.",
    code_snippet: `<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "FAQPage",
  "mainEntity": [
    {
      "@type": "Question",
      "name": "What is [your main topic]?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "Provide a concise, factual answer here (2\u20133 sentences)."
      }
    },
    {
      "@type": "Question",
      "name": "How does [your topic] work?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "Step-by-step explanation here."
      }
    }
  ]
}
</script>`
  }),
  direct_answer: (audit) => ({
    priority: priorityFromWeight(audit.weight),
    score_impact: scoreImpact(audit),
    instruction: "Rewrite your first paragraph to open with a direct, factual statement that answers the primary question your page addresses. LLMs extract the opening paragraph as the primary answer candidate. Avoid starting with navigation prompts, promotional text, or questions.",
    code_snippet: `<!-- Before (weak) -->
<p>In this article, we'll explore everything you need to know about React hooks.</p>

<!-- After (direct answer) -->
<p>React hooks are functions introduced in React 16.8 that let you use state and other React features
in functional components without writing a class. The most common hooks are useState, useEffect,
and useContext.</p>`
  }),
  qa_density: (audit) => ({
    priority: priorityFromWeight(audit.weight),
    score_impact: scoreImpact(audit),
    instruction: "Add question-framed H2 and H3 headings throughout your content. Aim for at least 2 questions per 500 words. Question headings signal AEO readiness and give LLMs clear anchors for answer extraction.",
    code_snippet: `<!-- Add question headings like these based on your topic -->
<h2>What is [Topic] and how does it work?</h2>
<h2>When should you use [Topic]?</h2>
<h3>What are the common mistakes with [Topic]?</h3>
<h3>How is [Topic] different from [Alternative]?</h3>
<h2>Is [Topic] right for your use case?</h2>`
  }),
  readability: (audit) => ({
    priority: priorityFromWeight(audit.weight),
    score_impact: scoreImpact(audit),
    instruction: "Simplify long, complex sentences to bring your Flesch-Kincaid grade level to \u226410. Split sentences longer than 25 words into two. Replace jargon with plain-language equivalents. LLMs prefer content that reads at a general audience level.",
    code_snippet: `<!-- Before (grade 14+) -->
<p>The implementation of a comprehensive content optimization strategy that simultaneously
addresses both the technical and editorial dimensions of AI-driven search visibility
represents a paradigm shift in how organizations approach digital content architecture.</p>

<!-- After (grade 8) -->
<p>Optimizing content for AI search requires two things: strong technical structure and
clear writing. When you address both, your pages are more likely to appear in AI-generated
answers. This is a new approach to content strategy.</p>`
  }),
  named_entities: (audit) => ({
    priority: priorityFromWeight(audit.weight),
    score_impact: scoreImpact(audit),
    instruction: "Add named entities (people, organizations, places) throughout your content. LLMs use named entities to verify a page's authority and topical relevance. Include expert names, company names, research institutions, and geographic contexts relevant to your topic.",
    code_snippet: `<!-- Add entity-rich context to your content -->
<p>According to <span itemprop="name">Jane Smith</span>, Head of Research at
<span itemprop="name">Acme Corp</span>, the approach was first developed
at <span itemprop="name">MIT</span> in 2019.</p>

<!-- Or in JSON-LD -->
<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "Article",
  "about": {
    "@type": "Thing",
    "name": "[Your main topic]"
  },
  "mentions": [
    { "@type": "Person", "name": "Expert Name" },
    { "@type": "Organization", "name": "Relevant Organization" }
  ]
}
</script>`
  }),
  author_byline: (audit) => ({
    priority: priorityFromWeight(audit.weight),
    score_impact: scoreImpact(audit),
    instruction: "Add an author byline with credentials. LLMs evaluate EEAT (Experience, Expertise, Authoritativeness, Trustworthiness) signals. Pages with identified authors rank higher in AI citation selection.",
    code_snippet: `<!-- HTML author markup -->
<span rel="author" itemprop="author" itemscope itemtype="https://schema.org/Person">
  <span itemprop="name">Author Name</span>,
  <span itemprop="jobTitle">Senior Engineer</span> at
  <span itemprop="worksFor" itemscope itemtype="https://schema.org/Organization">
    <span itemprop="name">Company Name</span>
  </span>
</span>

<!-- JSON-LD author -->
<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "Article",
  "author": {
    "@type": "Person",
    "name": "Author Name",
    "jobTitle": "Your Title",
    "url": "https://yoursite.com/about/author"
  }
}
</script>`
  }),
  topical_depth: (audit) => ({
    priority: priorityFromWeight(audit.weight),
    score_impact: scoreImpact(audit),
    instruction: "Your content's key topic terms are not reflected in your headings. Add H2/H3 sections that cover the main subtopics identified by TF-IDF analysis. Comprehensive topical coverage increases the likelihood LLMs will cite your page as an authoritative source."
  }),
  trust_signals: (audit) => ({
    priority: priorityFromWeight(audit.weight),
    score_impact: scoreImpact(audit),
    instruction: "Strengthen EEAT signals by adding missing Schema.org fields. LLMs use structured metadata to evaluate trustworthiness.",
    code_snippet: `<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "Article",
  "author": {
    "@type": "Person",
    "name": "Author Name",
    "url": "https://yoursite.com/author"
  },
  "publisher": {
    "@type": "Organization",
    "name": "Your Organization",
    "url": "https://yoursite.com",
    "logo": {
      "@type": "ImageObject",
      "url": "https://yoursite.com/logo.png"
    }
  },
  "datePublished": "2024-01-01",
  "dateModified": "2024-06-01",
  "citation": "https://authoritative-source.com/article"
}
</script>`
  }),
  content_freshness: (audit) => ({
    priority: priorityFromWeight(audit.weight),
    score_impact: scoreImpact(audit),
    instruction: "Add or update the dateModified field in your Schema.org markup and Open Graph meta tags. LLMs prefer recent content \u2014 pages without a modification date are treated as potentially stale.",
    code_snippet: `<!-- Open Graph / Article meta tags -->
<meta property="article:published_time" content="2024-01-15T00:00:00Z" />
<meta property="article:modified_time" content="${(/* @__PURE__ */ new Date()).toISOString().split("T")[0]}T00:00:00Z" />

<!-- HTML time element -->
<time datetime="${(/* @__PURE__ */ new Date()).toISOString().split("T")[0]}">Last updated: ${(/* @__PURE__ */ new Date()).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}</time>

<!-- JSON-LD dateModified -->
<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "Article",
  "dateModified": "${(/* @__PURE__ */ new Date()).toISOString().split("T")[0]}"
}
</script>`
  }),
  external_links: (audit) => ({
    priority: priorityFromWeight(audit.weight),
    score_impact: scoreImpact(audit),
    instruction: "Add at least 2 non-nofollow external links to authoritative sources. Citations to reputable sources are a strong trust signal for LLMs. Replace or remove nofollow attributes from legitimate citations.",
    code_snippet: `<!-- Good external citation -->
<p>According to <a href="https://authoritative-source.com/study" target="_blank">
research published by [Organization]</a>, this approach reduces errors by 40%.</p>

<!-- Replace nofollow citations -->
<!-- Before: <a href="..." rel="nofollow">Source</a> -->
<!-- After:  <a href="..." target="_blank" rel="noopener">Source</a> -->`
  }),
  comparison_content: (_audit) => ({
    priority: "medium",
    score_impact: 4,
    instruction: "Add a comparison section or 'vs' content to your page. LLMs frequently cite pages that compare options, list alternatives, or rank choices because users commonly ask comparison questions. Consider adding an H2 section like 'How [Topic] compares to alternatives' or a pros/cons table."
  }),
  citation_likelihood: (audit) => ({
    priority: priorityFromWeight(audit.weight),
    score_impact: scoreImpact(audit),
    instruction: "Your page has a low citation likelihood composite score. Focus on the highest-impact fixes above: (1) add FAQ/HowTo JSON-LD schema, (2) add an author byline, (3) add \u22653 external citations to authoritative sources. These three changes have the largest combined effect on AI citation selection."
  })
};
function generateRecommendations(audits) {
  return audits.map((audit) => {
    if (audit.status === "pass") return audit;
    const recFn = RECOMMENDATIONS[audit.id];
    if (!recFn) return audit;
    return {
      ...audit,
      recommendation: recFn(audit)
    };
  });
}

// src/reporters/html.ts
var import_fs3 = __toESM(require("fs"));
var import_path3 = __toESM(require("path"));
var import_handlebars = __toESM(require("handlebars"));
import_handlebars.default.registerHelper("bandColor", (band) => bandColor(band));
import_handlebars.default.registerHelper("bandLabel", (band) => bandLabel(band));
import_handlebars.default.registerHelper("eq", (a, b) => a === b);
import_handlebars.default.registerHelper("ne", (a, b) => a !== b);
import_handlebars.default.registerHelper("upper", (s) => s?.toUpperCase());
import_handlebars.default.registerHelper(
  "capitalize",
  (s) => s ? s.charAt(0).toUpperCase() + s.slice(1) : ""
);
import_handlebars.default.registerHelper("gaugeOffset", (score) => {
  const circumference = 339.3;
  return circumference - score / 100 * circumference;
});
import_handlebars.default.registerHelper(
  "preEscape",
  (code) => code ? code.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;") : ""
);
import_handlebars.default.registerHelper("priorityClass", (priority) => {
  switch (priority) {
    case "high":
      return "priority-high";
    case "medium":
      return "priority-medium";
    case "low":
      return "priority-low";
    default:
      return "";
  }
});
import_handlebars.default.registerHelper("sortByImpact", (audits) => {
  return [...audits].filter((a) => a.status !== "pass").sort((a, b) => (b.recommendation?.score_impact ?? 0) - (a.recommendation?.score_impact ?? 0));
});
import_handlebars.default.registerHelper(
  "passedAudits",
  (audits) => audits.filter((a) => a.status === "pass")
);
import_handlebars.default.registerHelper(
  "failCount",
  (audits) => audits.filter((a) => a.status !== "pass").length
);
import_handlebars.default.registerHelper(
  "passCount",
  (audits) => audits.filter((a) => a.status === "pass").length
);
var compiledTemplate = null;
function getTemplate() {
  if (compiledTemplate) return compiledTemplate;
  const candidates = [
    import_path3.default.join(process.cwd(), "templates/report.hbs"),
    import_path3.default.join(__dirname, "../templates/report.hbs"),
    import_path3.default.join(__dirname, "../../templates/report.hbs"),
    import_path3.default.join(__dirname, "../../../templates/report.hbs")
  ];
  for (const candidate of candidates) {
    if (import_fs3.default.existsSync(candidate)) {
      const source = import_fs3.default.readFileSync(candidate, "utf-8");
      compiledTemplate = import_handlebars.default.compile(source);
      return compiledTemplate;
    }
  }
  throw new Error(
    "HTML report template not found. Expected at templates/report.hbs"
  );
}
function generateHtmlReport(report, outputPath) {
  const template = getTemplate();
  const html = template({
    report,
    generatedAt: new Date(report.timestamp).toLocaleString(),
    scoreColor: bandColor(report.scores.band),
    bandLabel: bandLabel(report.scores.band)
  });
  if (outputPath) {
    import_fs3.default.writeFileSync(outputPath, html, "utf-8");
  }
  return html;
}

// src/reporters/json.ts
var import_fs4 = __toESM(require("fs"));
function generateJsonReport(report, outputPath) {
  const json = JSON.stringify(report, null, 2);
  if (outputPath) {
    import_fs4.default.writeFileSync(outputPath, json, "utf-8");
  }
  return json;
}

// src/reporters/csv.ts
var import_fs5 = __toESM(require("fs"));
var CSV_HEADERS = [
  "url",
  "timestamp",
  "composite",
  "aeo",
  "geo",
  "band",
  "pass_count",
  "fail_count",
  "warn_count"
];
function generateCsvReport(reports, outputPath) {
  const rows = reports.map((r) => {
    const passCount = r.audits.filter((a) => a.status === "pass").length;
    const failCount = r.audits.filter((a) => a.status === "fail").length;
    const warnCount = r.audits.filter((a) => a.status === "warn").length;
    return [
      csvEscape(r.url),
      csvEscape(r.timestamp),
      r.scores.composite,
      r.scores.aeo,
      r.scores.geo,
      csvEscape(r.scores.band),
      passCount,
      failCount,
      warnCount
    ].join(",");
  });
  const csv = [CSV_HEADERS.join(","), ...rows].join("\n");
  if (outputPath) {
    import_fs5.default.writeFileSync(outputPath, csv, "utf-8");
  }
  return csv;
}
function csvEscape(val) {
  if (val.includes(",") || val.includes('"') || val.includes("\n")) {
    return `"${val.replace(/"/g, '""')}"`;
  }
  return val;
}

// src/cli/commands/audit.ts
async function runAudit(options) {
  const spinner = (0, import_ora.default)({ color: "cyan" });
  try {
    spinner.start("Loading configuration\u2026");
    let config;
    try {
      config = loadConfig(options.config);
      spinner.succeed("Configuration loaded.");
    } catch (err) {
      spinner.fail(`Invalid configuration: ${err.message}`);
      process.exit(3);
    }
    spinner.start("Fetching content\u2026");
    let pages;
    try {
      pages = await crawl(options);
      spinner.succeed(`Fetched ${pages.length} page(s).`);
    } catch (err) {
      spinner.fail(`Crawl error: ${err.message}`);
      process.exit(2);
    }
    const reports = [];
    for (const page of pages) {
      spinner.start(`Auditing ${page.url}\u2026`);
      const rawAudits = runAudits(page);
      const auditResults = generateRecommendations(rawAudits);
      const scores = computeScores(auditResults, config);
      const report = {
        url: page.url,
        timestamp: (/* @__PURE__ */ new Date()).toISOString(),
        scores,
        audits: auditResults,
        probe: { enabled: false, results: [] }
      };
      reports.push(report);
      spinner.succeed(`Audited ${page.url} \u2014 composite: ${scores.composite}`);
    }
    if (reports.length === 0) {
      console.error(import_chalk.default.red("No pages were successfully audited."));
      process.exit(2);
    }
    const firstReport = reports[0];
    if (options.output === "json") {
      const outPath = options.outputPath ?? "./citeops-report.json";
      generateJsonReport(firstReport, outPath);
      console.log(import_chalk.default.green(`
JSON report saved to ${outPath}`));
    } else if (options.output === "csv") {
      const outPath = options.outputPath ?? "./citeops-report.csv";
      generateCsvReport(reports, outPath);
      console.log(import_chalk.default.green(`
CSV report saved to ${outPath}`));
    } else {
      const outPath = options.outputPath ?? `./citeops-report-${(/* @__PURE__ */ new Date()).toISOString().replace(/[:.]/g, "-")}.html`;
      generateHtmlReport(firstReport, outPath);
      console.log(import_chalk.default.green(`
HTML report saved to ${outPath}`));
    }
    printSummary(firstReport);
    if (options.ci) {
      const { composite } = firstReport.scores;
      const threshold = options.threshold;
      if (composite < threshold) {
        console.log(
          import_chalk.default.red(
            `
\u2716 CI check FAILED: composite score ${composite} is below threshold ${threshold}`
          )
        );
        process.exit(1);
      } else {
        console.log(
          import_chalk.default.green(
            `
\u2714 CI check PASSED: composite score ${composite} \u2265 threshold ${threshold}`
          )
        );
        process.exit(0);
      }
    }
  } catch (err) {
    spinner.fail(`Unexpected error: ${err.message}`);
    if (process.env.DEBUG) console.error(err);
    process.exit(2);
  }
}
function printSummary(report) {
  const { scores, audits } = report;
  const color = bandColor(scores.band);
  const label = bandLabel(scores.band);
  console.log("\n" + import_chalk.default.bold("\u2500".repeat(60)));
  console.log(import_chalk.default.bold("  citeops Audit Summary"));
  console.log(import_chalk.default.bold("\u2500".repeat(60)));
  console.log(`  URL: ${import_chalk.default.cyan(report.url)}`);
  console.log(`  Composite: ${import_chalk.default.hex(color).bold(String(scores.composite))} / 100 \u2014 ${import_chalk.default.hex(color)(label)}`);
  console.log(`  AEO Score: ${import_chalk.default.blue.bold(String(scores.aeo))} / 100`);
  console.log(`  GEO Score: ${import_chalk.default.magenta.bold(String(scores.geo))} / 100`);
  console.log(import_chalk.default.bold("\u2500".repeat(60)));
  const passed = audits.filter((a) => a.status === "pass");
  const failed = audits.filter((a) => a.status !== "pass");
  if (failed.length > 0) {
    console.log(import_chalk.default.red.bold(`
  ${failed.length} Recommendation(s):`));
    for (const audit of failed) {
      const impact = audit.recommendation?.score_impact ?? 0;
      const priority = audit.recommendation?.priority ?? "low";
      const priorityColor = priority === "high" ? import_chalk.default.red : priority === "medium" ? import_chalk.default.yellow : import_chalk.default.blue;
      console.log(
        `  ${import_chalk.default.red("\u2716")} ${audit.title} ${priorityColor(`[${priority}]`)} ${import_chalk.default.green(`+${impact} pts`)}`
      );
    }
  }
  if (passed.length > 0) {
    console.log(import_chalk.default.green.bold(`
  ${passed.length} Passed:`));
    for (const audit of passed) {
      console.log(`  ${import_chalk.default.green("\u2714")} ${audit.title}`);
    }
  }
  console.log(import_chalk.default.bold("\n" + "\u2500".repeat(60) + "\n"));
}

// src/cli/index.ts
var program = new import_commander.Command();
program.name("llm-citeops").description(
  "Lighthouse-inspired CLI tool that audits web content for AEO and GEO scores"
).version("1.0.0");
program.command("audit").description("Audit a URL, local file, directory, or sitemap").option("--url <url>", "Audit a single URL").option("--file <path>", "Audit a local .md or .html file").option("--dir <path>", "Audit a directory of local files").option("--sitemap <url>", "Audit all URLs in a sitemap.xml").option("--output <format>", "Report format: html | json | csv (default: html)", "html").option("--output-path <path>", "Save report to a specific path").option("--probe", "Enable LLM probe mode (Phase 2)", false).option("--models <list>", "Comma-separated model list for probe", (v) => v.split(","), ["gpt4o", "claude"]).option("--threshold <n>", "Minimum composite score for CI pass", (v) => parseInt(v, 10), 70).option("--ci", "Exit with code 1 if score is below threshold", false).option("--ignore-robots", "Ignore robots.txt restrictions", false).option("--depth <n>", "Crawl depth (default: 1)", (v) => parseInt(v, 10), 1).option("--rate <n>", "Requests per second (default: 1)", (v) => parseFloat(v), 1).option("--config <path>", "Path to custom .citeops.json config file").option("--compare <url>", "Compare against a competitor URL (Phase 3)").action(async (opts) => {
  const options = {
    url: opts.url,
    file: opts.file,
    dir: opts.dir,
    sitemap: opts.sitemap,
    output: opts.output ?? "html",
    outputPath: opts.outputPath,
    probe: Boolean(opts.probe),
    models: Array.isArray(opts.models) ? opts.models : ["gpt4o", "claude"],
    threshold: typeof opts.threshold === "number" ? opts.threshold : 70,
    ci: Boolean(opts.ci),
    compare: opts.compare,
    ignoreRobots: Boolean(opts.ignoreRobots),
    depth: typeof opts.depth === "number" ? opts.depth : 1,
    rate: typeof opts.rate === "number" ? opts.rate : 1,
    config: opts.config
  };
  if (!options.url && !options.file && !options.dir && !options.sitemap) {
    console.error(
      "Error: Provide at least one input with --url, --file, --dir, or --sitemap"
    );
    process.exit(3);
  }
  await runAudit(options);
});
program.parse(process.argv);
