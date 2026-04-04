import { AuditResult, Recommendation, Priority } from '../types/index.js';

const WEIGHT_TO_PRIORITY: Array<[number, Priority]> = [
  [1.3, 'high'],
  [1.0, 'medium'],
  [0.0, 'low'],
];

function priorityFromWeight(weight: number): Priority {
  for (const [threshold, priority] of WEIGHT_TO_PRIORITY) {
    if (weight >= threshold) return priority;
  }
  return 'low';
}

function scoreImpact(audit: AuditResult): number {
  // Approximate how many composite points fixing this audit is worth
  // Max composite = 100, 12 audits weighted — this gives a rough impact
  return Math.round(audit.weight * 5);
}

const RECOMMENDATIONS: Record<string, (audit: AuditResult) => Recommendation> = {
  faq_schema: (audit) => ({
    priority: priorityFromWeight(audit.weight),
    score_impact: scoreImpact(audit),
    instruction:
      'Add a FAQPage or HowTo JSON-LD block to your <head>. LLMs heavily weight structured FAQ schema when selecting content to cite in answer responses. Pages without it are deprioritized in AI summaries.',
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
        "text": "Provide a concise, factual answer here (2–3 sentences)."
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
</script>`,
  }),

  direct_answer: (audit) => ({
    priority: priorityFromWeight(audit.weight),
    score_impact: scoreImpact(audit),
    instruction:
      'Rewrite your first paragraph to open with a direct, factual statement that answers the primary question your page addresses. LLMs extract the opening paragraph as the primary answer candidate. Avoid starting with navigation prompts, promotional text, or questions.',
    code_snippet: `<!-- Before (weak) -->
<p>In this article, we'll explore everything you need to know about React hooks.</p>

<!-- After (direct answer) -->
<p>React hooks are functions introduced in React 16.8 that let you use state and other React features
in functional components without writing a class. The most common hooks are useState, useEffect,
and useContext.</p>`,
  }),

  qa_density: (audit) => ({
    priority: priorityFromWeight(audit.weight),
    score_impact: scoreImpact(audit),
    instruction:
      'Add question-framed H2 and H3 headings throughout your content. Aim for at least 2 questions per 500 words. Question headings signal AEO readiness and give LLMs clear anchors for answer extraction.',
    code_snippet: `<!-- Add question headings like these based on your topic -->
<h2>What is [Topic] and how does it work?</h2>
<h2>When should you use [Topic]?</h2>
<h3>What are the common mistakes with [Topic]?</h3>
<h3>How is [Topic] different from [Alternative]?</h3>
<h2>Is [Topic] right for your use case?</h2>`,
  }),

  readability: (audit) => ({
    priority: priorityFromWeight(audit.weight),
    score_impact: scoreImpact(audit),
    instruction:
      'Simplify long, complex sentences to bring your Flesch-Kincaid grade level to ≤10. Split sentences longer than 25 words into two. Replace jargon with plain-language equivalents. LLMs prefer content that reads at a general audience level.',
    code_snippet: `<!-- Before (grade 14+) -->
<p>The implementation of a comprehensive content optimization strategy that simultaneously
addresses both the technical and editorial dimensions of AI-driven search visibility
represents a paradigm shift in how organizations approach digital content architecture.</p>

<!-- After (grade 8) -->
<p>Optimizing content for AI search requires two things: strong technical structure and
clear writing. When you address both, your pages are more likely to appear in AI-generated
answers. This is a new approach to content strategy.</p>`,
  }),

  named_entities: (audit) => ({
    priority: priorityFromWeight(audit.weight),
    score_impact: scoreImpact(audit),
    instruction:
      "Add named entities (people, organizations, places) throughout your content. LLMs use named entities to verify a page's authority and topical relevance. Include expert names, company names, research institutions, and geographic contexts relevant to your topic.",
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
</script>`,
  }),

  author_byline: (audit) => ({
    priority: priorityFromWeight(audit.weight),
    score_impact: scoreImpact(audit),
    instruction:
      "Add an author byline with credentials. LLMs evaluate EEAT (Experience, Expertise, Authoritativeness, Trustworthiness) signals. Pages with identified authors rank higher in AI citation selection.",
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
</script>`,
  }),

  topical_depth: (audit) => ({
    priority: priorityFromWeight(audit.weight),
    score_impact: scoreImpact(audit),
    instruction:
      "Your content's key topic terms are not reflected in your headings. Add H2/H3 sections that cover the main subtopics identified by TF-IDF analysis. Comprehensive topical coverage increases the likelihood LLMs will cite your page as an authoritative source.",
  }),

  trust_signals: (audit) => ({
    priority: priorityFromWeight(audit.weight),
    score_impact: scoreImpact(audit),
    instruction:
      'Strengthen EEAT signals by adding missing Schema.org fields. LLMs use structured metadata to evaluate trustworthiness.',
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
</script>`,
  }),

  content_freshness: (audit) => ({
    priority: priorityFromWeight(audit.weight),
    score_impact: scoreImpact(audit),
    instruction:
      'Add or update the dateModified field in your Schema.org markup and Open Graph meta tags. LLMs prefer recent content — pages without a modification date are treated as potentially stale.',
    code_snippet: `<!-- Open Graph / Article meta tags -->
<meta property="article:published_time" content="2024-01-15T00:00:00Z" />
<meta property="article:modified_time" content="${new Date().toISOString().split('T')[0]}T00:00:00Z" />

<!-- HTML time element -->
<time datetime="${new Date().toISOString().split('T')[0]}">Last updated: ${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</time>

<!-- JSON-LD dateModified -->
<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "Article",
  "dateModified": "${new Date().toISOString().split('T')[0]}"
}
</script>`,
  }),

  external_links: (audit) => ({
    priority: priorityFromWeight(audit.weight),
    score_impact: scoreImpact(audit),
    instruction:
      'Add at least 2 non-nofollow external links to authoritative sources. Citations to reputable sources are a strong trust signal for LLMs. Replace or remove nofollow attributes from legitimate citations.',
    code_snippet: `<!-- Good external citation -->
<p>According to <a href="https://authoritative-source.com/study" target="_blank">
research published by [Organization]</a>, this approach reduces errors by 40%.</p>

<!-- Replace nofollow citations -->
<!-- Before: <a href="..." rel="nofollow">Source</a> -->
<!-- After:  <a href="..." target="_blank" rel="noopener">Source</a> -->`,
  }),

  comparison_content: (_audit) => ({
    priority: 'medium',
    score_impact: 4,
    instruction:
      "Add a comparison section or 'vs' content to your page. LLMs frequently cite pages that compare options, list alternatives, or rank choices because users commonly ask comparison questions. Consider adding an H2 section like 'How [Topic] compares to alternatives' or a pros/cons table.",
  }),

  citation_likelihood: (audit) => ({
    priority: priorityFromWeight(audit.weight),
    score_impact: scoreImpact(audit),
    instruction:
      'Your page has a low citation likelihood composite score. Focus on the highest-impact fixes above: (1) add FAQ/HowTo JSON-LD schema, (2) add an author byline, (3) add ≥3 external citations to authoritative sources. These three changes have the largest combined effect on AI citation selection.',
  }),
};

export function generateRecommendations(audits: AuditResult[]): AuditResult[] {
  return audits.map((audit) => {
    if (audit.status === 'pass') return audit;

    const recFn = RECOMMENDATIONS[audit.id];
    if (!recFn) return audit;

    return {
      ...audit,
      recommendation: recFn(audit),
    };
  });
}
