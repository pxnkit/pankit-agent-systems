import { containsExcludedSourceContent } from "./content-policy.mjs";
import { sanitizeLink } from "./link-policy.mjs";

const STOP_WORDS = new Set([
  "a",
  "about",
  "an",
  "and",
  "are",
  "as",
  "at",
  "be",
  "by",
  "can",
  "did",
  "do",
  "does",
  "explain",
  "for",
  "from",
  "how",
  "i",
  "in",
  "is",
  "it",
  "me",
  "of",
  "on",
  "or",
  "please",
  "portfolio",
  "say",
  "show",
  "that",
  "the",
  "their",
  "this",
  "tell",
  "to",
  "was",
  "what",
  "when",
  "which",
  "who",
  "why",
  "with",
  "would",
  "you",
]);

const COMPARISON_PATTERN =
  /\b(?:compare|comparison|versus|vs\.?|difference|different|trade[-\s]?offs?|between)\b/i;
const LIMITATION_PATTERN =
  /\b(?:limit(?:ation|ations|ed)?|weakness(?:es)?|failure(?:s|\s+mode)?|risk(?:s)?|constraint(?:s)?|caveat(?:s)?|drawback(?:s)?|doesn'?t|cannot|can'?t|open\s+issue)\b/i;
const IDENTITY_PATTERN =
  /\b(?:who\s+is\s+pankit|pankit(?:\s+brahmkhatri)?(?:'s|’s)?\s+(?:background|profile|bio(?:graphy)?|identity)|tell\s+me\s+about\s+pankit)\b/i;
const PORTFOLIO_OVERVIEW_PATTERN =
  /\b(?:what\s+does\s+pankit\s+(?:work\s+on|research|study)|portfolio\s+(?:overview|summary)|overview\s+of\s+(?:pankit(?:'s|’s)?\s+)?(?:work|research|projects?)|how\s+many\s+(?:public\s+|verified\s+|indexed\s+)?projects?|indexed\s+(?:project\s+)?count)\b/i;
const RESEARCH_CONNECTION_PATTERN =
  /\b(?:connect(?:s|ed|ing|ion)?|fit\s+together|research\s+(?:agenda|program|programme)|common\s+(?:thread|agenda)|relat(?:e|es|ed|ionship)|across\s+(?:the\s+)?projects?|memory\s+as\s+(?:a\s+)?decision\s+system)\b/i;
const THEME_PATTERN =
  /\b(?:themes?|focus\s+areas?|research\s+areas?|research\s+topics?|main\s+topics?|portfolio\s+topics?)\b/i;
const SITE_PATTERN =
  /\b(?:this\s+(?:site|website)|portfolio\s+(?:site|website)|site\s+(?:about|purpose)|website\s+(?:about|purpose)|purpose\s+of\s+(?:this\s+)?(?:site|website))\b/i;
const SCOPE_PATTERN =
  /\b(?:content\s+(?:is\s+)?excluded|excluded\s+content|what\s+(?:is|isn'?t|is\s+not)\s+(?:included|indexed)|index(?:ed)?\s+scope|site\s+scope|source\s+scope|coverage|exclusions?|privacy\s+scope)\b/i;
const GITHUB_PATTERN =
  /\b(?:pankit(?:'s|’s)?\s+github|github\s+(?:profile|account)|source\s+code\s+profile)\b/i;
const PENDING_SHORTLIST_PATTERN =
  /\b(?:pending\s+(?:projects?|shortlist|verification)|shortlist\s+(?:projects?|status)|title[-\s]?only|unverified\s+(?:projects?|entries)|awaiting\s+(?:public\s+)?verification)\b/i;

export const QUERY_INTENTS = Object.freeze({
  IDENTITY: "identity",
  PORTFOLIO_OVERVIEW: "portfolio-overview",
  RESEARCH_CONNECTION: "research-connection",
  EXACT: "exact",
  COMPARE: "compare",
  THEME: "theme",
  SITE: "site",
  SCOPE: "scope",
  GITHUB: "github",
  PENDING_SHORTLIST: "pending-shortlist",
  LIMITATION: "limitation",
  UNKNOWN: "unknown",
});

const INTENT_SOURCE_PRIORITIES = Object.freeze({
  [QUERY_INTENTS.IDENTITY]: ["curated:profile"],
  [QUERY_INTENTS.PORTFOLIO_OVERVIEW]: [
    "curated:research-overview",
    "curated:project-map",
    "curated:profile",
  ],
  [QUERY_INTENTS.RESEARCH_CONNECTION]: [
    "curated:research-overview",
    "curated:research-themes",
    "curated:project-map",
  ],
  [QUERY_INTENTS.THEME]: [
    "curated:research-themes",
    "curated:research-overview",
    "curated:project-map",
  ],
  [QUERY_INTENTS.SITE]: ["curated:site-scope", "curated:profile"],
  [QUERY_INTENTS.SCOPE]: ["curated:site-scope", "curated:project-map"],
  [QUERY_INTENTS.GITHUB]: ["curated:site-scope", "curated:profile"],
  [QUERY_INTENTS.PENDING_SHORTLIST]: [
    "manual:project-ranking",
    "manual:ranked-projects",
    "curated:project-map",
  ],
});

const INTENT_KIND_PRIORITIES = Object.freeze({
  [QUERY_INTENTS.IDENTITY]: ["profile"],
  [QUERY_INTENTS.PORTFOLIO_OVERVIEW]: ["project-map", "overview", "profile"],
  [QUERY_INTENTS.RESEARCH_CONNECTION]: ["overview", "theme", "project-map"],
  [QUERY_INTENTS.THEME]: ["theme", "overview", "project-map"],
  [QUERY_INTENTS.SITE]: ["site-scope", "profile"],
  [QUERY_INTENTS.SCOPE]: ["site-scope", "project-map"],
  [QUERY_INTENTS.GITHUB]: ["site-scope", "profile"],
  [QUERY_INTENTS.PENDING_SHORTLIST]: ["ranking", "project-map"],
});

/** @param {unknown} value */
export function normalizeSearchText(value) {
  return String(value ?? "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9+#./-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Normalize human-facing names while discarding terminal sentence punctuation. */
function normalizeNameText(value) {
  return normalizeSearchText(value)
    .split(" ")
    .map((part) => part.replace(/^[+#./-]+|[+#./-]+$/g, ""))
    .filter(Boolean)
    .join(" ");
}

/** @param {unknown} value */
export function tokenize(value) {
  return normalizeSearchText(value)
    .split(" ")
    .map((token) => token.replace(/^[+#./-]+|[+#./-]+$/g, ""))
    .filter((token) => token.length > 1 && !STOP_WORDS.has(token));
}

/** @param {unknown} value */
function stringList(value) {
  return Array.isArray(value)
    ? value.filter((entry) => typeof entry === "string" && entry.trim())
    : [];
}

/**
 * @param {unknown} input
 * @returns {null | {id: string, sourceId: string, kind: string, projectSlug?: string, title: string, text: string, url?: string, tags: string[]}}
 */
export function normalizeKnowledgeChunk(input) {
  if (!input || typeof input !== "object" || Array.isArray(input)) return null;
  const chunk = /** @type {Record<string, unknown>} */ (input);
  const id = typeof chunk.id === "string" ? chunk.id.trim() : "";
  const sourceId =
    typeof chunk.sourceId === "string" ? chunk.sourceId.trim() : "";
  const title = typeof chunk.title === "string" ? chunk.title.trim() : "";
  const text =
    typeof chunk.text === "string"
      ? chunk.text.trim()
      : typeof chunk.content === "string"
        ? chunk.content.trim()
        : "";
  if (
    !id ||
    !sourceId ||
    !title ||
    !text ||
    containsExcludedSourceContent(`${title}\n${text}`)
  ) {
    return null;
  }

  const url = chunk.url === undefined ? undefined : sanitizeLink(chunk.url);
  return {
    id,
    sourceId,
    kind:
      typeof chunk.kind === "string" && chunk.kind.trim()
        ? chunk.kind.trim()
        : "overview",
    projectSlug:
      typeof chunk.projectSlug === "string" && chunk.projectSlug.trim()
        ? chunk.projectSlug.trim()
        : undefined,
    title,
    text,
    ...(url ? { url } : {}),
    tags: [...new Set(stringList(chunk.tags).map((tag) => tag.trim()))],
  };
}

/**
 * Convert authoritative project records into a useful minimum index. These
 * chunks keep local development functional when generated knowledge is absent.
 *
 * @param {Iterable<Record<string, unknown>>} projects
 */
export function projectsToKnowledgeChunks(projects) {
  const chunks = [];
  for (const project of projects) {
    const slug = String(project.slug ?? "").trim();
    const title = String(project.title ?? "").trim();
    const sourceIds = stringList(project.sourceIds);
    if (!slug || !title || sourceIds.length === 0) continue;

    const descriptions = [project.shortDescription, project.longDescription]
      .filter((value) => typeof value === "string" && value.trim())
      .map(String);
    const metadata = [
      ...stringList(project.tags),
      ...stringList(project.languages),
      ...stringList(project.technologies),
    ];
    const overviewText = [
      ...descriptions,
      metadata.length ? `Topics and technologies: ${metadata.join(", ")}.` : "",
    ]
      .filter(Boolean)
      .join(" ");
    if (overviewText && !containsExcludedSourceContent(overviewText)) {
      chunks.push({
        id: `project:${slug}:overview`,
        sourceId: sourceIds[0],
        kind: "overview",
        projectSlug: slug,
        title,
        text: overviewText,
        ...(sanitizeLink(project.repositoryUrl)
          ? { url: sanitizeLink(project.repositoryUrl) }
          : {}),
        tags: [
          ...new Set([
            ...stringList(project.tags),
            ...stringList(project.aliases),
          ]),
        ],
      });
    }

    stringList(project.limitations).forEach((limitation, index) => {
      if (containsExcludedSourceContent(limitation)) return;
      chunks.push({
        id: `project:${slug}:limitation:${index + 1}`,
        sourceId: sourceIds[Math.min(index, sourceIds.length - 1)],
        kind: "limitation",
        projectSlug: slug,
        title: `${title} — limitation`,
        text: limitation,
        tags: ["limitation", ...stringList(project.tags)],
      });
    });
  }
  return chunks;
}

/**
 * @param {unknown} envelope
 */
export function chunksFromEnvelope(envelope) {
  const rawChunks =
    envelope && typeof envelope === "object" && !Array.isArray(envelope)
      ? /** @type {Record<string, unknown>} */ (envelope).chunks
      : undefined;
  if (!Array.isArray(rawChunks)) return [];
  return rawChunks.map(normalizeKnowledgeChunk).filter(Boolean);
}

/**
 * @param {Iterable<ReturnType<typeof normalizeKnowledgeChunk>>} chunks
 */
export function dedupeChunks(chunks) {
  const ids = new Set();
  const fingerprints = new Set();
  const output = [];
  for (const chunk of chunks) {
    if (!chunk) continue;
    const fingerprint = [
      chunk.projectSlug ?? "",
      chunk.kind,
      normalizeSearchText(chunk.text),
    ].join("|");
    if (ids.has(chunk.id) || fingerprints.has(fingerprint)) continue;
    ids.add(chunk.id);
    fingerprints.add(fingerprint);
    output.push(chunk);
  }
  return output;
}

/** @param {ReturnType<typeof normalizeKnowledgeChunk>} chunk */
export function knowledgeChunkFingerprint(chunk) {
  if (!chunk) return "";
  return [
    chunk.projectSlug ?? "",
    chunk.kind,
    normalizeSearchText(chunk.text),
  ].join("|");
}

/**
 * Runtime de-duplication remains defensive, while health checks can use this
 * report to make duplicate generated records visible instead of hiding them.
 *
 * @param {Iterable<ReturnType<typeof normalizeKnowledgeChunk>>} chunks
 */
export function findDuplicateChunks(chunks) {
  const ids = new Set();
  const fingerprints = new Set();
  const duplicateIds = new Set();
  const duplicateFingerprints = new Set();
  for (const chunk of chunks) {
    if (!chunk) continue;
    const fingerprint = knowledgeChunkFingerprint(chunk);
    if (ids.has(chunk.id)) duplicateIds.add(chunk.id);
    if (fingerprints.has(fingerprint)) duplicateFingerprints.add(fingerprint);
    ids.add(chunk.id);
    fingerprints.add(fingerprint);
  }
  return {
    duplicateIds: [...duplicateIds].sort(),
    duplicateFingerprints: [...duplicateFingerprints].sort(),
  };
}

/**
 * Accepts both the legacy grouped project entries and the curated source
 * records emitted by the deterministic corpus builder.
 *
 * @param {unknown} manifest
 */
export function sourceRegistryFromManifest(manifest) {
  const sourceIds = new Set();
  const projectBySourceId = new Map();
  if (!manifest || typeof manifest !== "object" || Array.isArray(manifest)) {
    return { sourceIds, projectBySourceId };
  }
  const value = /** @type {Record<string, unknown>} */ (manifest);
  const entries = [
    ...(Array.isArray(value.sources) ? value.sources : []),
    ...(Array.isArray(value.rankedEntries) ? value.rankedEntries : []),
  ];
  for (const rawEntry of entries) {
    if (!rawEntry || typeof rawEntry !== "object" || Array.isArray(rawEntry)) {
      continue;
    }
    const entry = /** @type {Record<string, unknown>} */ (rawEntry);
    const projectSlug =
      typeof entry.projectSlug === "string" && entry.projectSlug.trim()
        ? entry.projectSlug.trim()
        : typeof entry.slug === "string" && entry.slug.trim()
          ? entry.slug.trim()
          : undefined;
    const ids = [
      ...(typeof entry.id === "string" ? [entry.id] : []),
      ...(typeof entry.sourceId === "string" ? [entry.sourceId] : []),
      ...stringList(entry.sourceIds),
    ]
      .map((id) => id.trim())
      .filter(Boolean);
    for (const id of ids) {
      sourceIds.add(id);
      if (projectSlug) projectBySourceId.set(id, projectSlug);
    }
  }
  return { sourceIds, projectBySourceId };
}

/**
 * Generated chunks are accepted only for known projects and known project
 * source IDs. Global chunks must be registered when a manifest is supplied.
 * Manual records remain authoritative.
 *
 * @param {Iterable<Record<string, unknown>>} projects
 * @param {unknown} [knowledgeEnvelope]
 * @param {{sourceManifest?: unknown}} [options]
 */
export function buildKnowledgeCorpus(
  projects,
  knowledgeEnvelope,
  options = {},
) {
  const projectList = [...projects];
  const projectBySlug = new Map(
    projectList.map((project) => [String(project.slug), project]),
  );
  const registry = sourceRegistryFromManifest(options.sourceManifest);
  const enforceManifest = registry.sourceIds.size > 0;
  const generated = chunksFromEnvelope(knowledgeEnvelope).filter((chunk) => {
    if (enforceManifest && !registry.sourceIds.has(chunk.sourceId))
      return false;
    if (!chunk.projectSlug) return true;
    const project = projectBySlug.get(chunk.projectSlug);
    if (!project) return false;
    const registeredProject = registry.projectBySourceId.get(chunk.sourceId);
    return (
      stringList(project.sourceIds).includes(chunk.sourceId) ||
      chunk.sourceId === `project:${chunk.projectSlug}` ||
      registeredProject === chunk.projectSlug
    );
  });
  const derived = projectsToKnowledgeChunks(projectList).filter(
    (chunk) => !enforceManifest || registry.sourceIds.has(chunk.sourceId),
  );
  return dedupeChunks([...generated, ...derived]);
}

/** @param {string} query @param {Iterable<Record<string, unknown>>} rankedProjects */
export function matchedProjectNumbers(query, rankedProjects) {
  const queryText = query.toLowerCase();
  const matches = new Set();
  for (const ranked of rankedProjects) {
    const number = Number(ranked.projectNumber);
    if (!Number.isInteger(number)) continue;
    const pattern = new RegExp(`(?:project\\s*#?\\s*|#)${number}(?!\\d)`, "i");
    if (pattern.test(queryText)) matches.add(String(ranked.slug));
  }
  return matches;
}

/**
 * @param {string} query
 * @param {Iterable<Record<string, unknown>>} projects
 */
export function matchedProjectNames(query, projects) {
  const normalizedQuery = normalizeNameText(query);
  const matches = new Map();
  for (const project of projects) {
    const names = [project.title, ...stringList(project.aliases)]
      .filter((name) => typeof name === "string")
      .map(normalizeNameText)
      .filter(Boolean);
    const exact = names.some((name) => normalizedQuery === name);
    const contained = names.some(
      (name) =>
        name.length >= 4 && ` ${normalizedQuery} `.includes(` ${name} `),
    );
    if (exact || contained) {
      matches.set(String(project.slug), exact ? "exact-name" : "name");
    }
  }
  return matches;
}

/**
 * A small explicit intent layer keeps canonical portfolio questions stable
 * across live-model changes and provider outages.
 *
 * @param {string} query
 * @param {{projects?: Iterable<Record<string, unknown>>, rankedProjects?: Iterable<Record<string, unknown>>}} [options]
 */
export function classifyQueryIntent(query, options = {}) {
  const value = String(query ?? "")
    .normalize("NFKC")
    .trim();
  const projects = [...(options.projects ?? [])];
  const rankedProjects = [...(options.rankedProjects ?? [])];
  const nameMatches = matchedProjectNames(value, projects);
  const numberMatches = matchedProjectNumbers(value, rankedProjects);

  if (COMPARISON_PATTERN.test(value)) {
    return QUERY_INTENTS.COMPARE;
  }
  if (nameMatches.size > 0 || numberMatches.size > 0) {
    return LIMITATION_PATTERN.test(value)
      ? QUERY_INTENTS.LIMITATION
      : QUERY_INTENTS.EXACT;
  }
  if (PENDING_SHORTLIST_PATTERN.test(value)) {
    return QUERY_INTENTS.PENDING_SHORTLIST;
  }
  if (GITHUB_PATTERN.test(value)) return QUERY_INTENTS.GITHUB;
  if (SCOPE_PATTERN.test(value)) return QUERY_INTENTS.SCOPE;
  if (SITE_PATTERN.test(value)) return QUERY_INTENTS.SITE;
  if (IDENTITY_PATTERN.test(value)) return QUERY_INTENTS.IDENTITY;
  if (RESEARCH_CONNECTION_PATTERN.test(value)) {
    return QUERY_INTENTS.RESEARCH_CONNECTION;
  }
  if (THEME_PATTERN.test(value)) return QUERY_INTENTS.THEME;
  if (PORTFOLIO_OVERVIEW_PATTERN.test(value)) {
    return QUERY_INTENTS.PORTFOLIO_OVERVIEW;
  }
  return QUERY_INTENTS.UNKNOWN;
}

/** @param {string} intent @param {ReturnType<typeof normalizeKnowledgeChunk>} chunk */
function intentPriority(intent, chunk) {
  if (!chunk) return 0;
  const sourcePriorities = INTENT_SOURCE_PRIORITIES[intent] ?? [];
  const kindPriorities = INTENT_KIND_PRIORITIES[intent] ?? [];
  const sourceIndex = sourcePriorities.indexOf(chunk.sourceId);
  const kind = chunk.kind.toLowerCase();
  const kindIndex = kindPriorities.findIndex(
    (candidate) => kind === candidate || kind.includes(candidate),
  );
  let score = 0;
  if (sourceIndex >= 0) score += 220 - sourceIndex * 24;
  if (kindIndex >= 0) score += 120 - kindIndex * 16;
  if (
    intent === QUERY_INTENTS.PENDING_SHORTLIST &&
    /\b(?:pending|title[-\s]?only|verification)\b/i.test(chunk.text)
  ) {
    score += 70;
  }
  return score;
}

/**
 * Deterministic lexical retrieval with explicit boosts for exact project
 * references, comparisons, and limitation questions.
 *
 * @param {string} query
 * @param {{
 *   chunks: Iterable<ReturnType<typeof normalizeKnowledgeChunk>>,
 *   projects?: Iterable<Record<string, unknown>>,
 *   rankedProjects?: Iterable<Record<string, unknown>>,
 *   limit?: number,
 *   minimumScore?: number,
 *   intent?: string
 * }} options
 */
export function retrieveKnowledge(query, options) {
  const chunks = dedupeChunks(options.chunks);
  const projects = [...(options.projects ?? [])];
  const rankedProjects = [...(options.rankedProjects ?? [])];
  const limit = Math.max(1, Math.min(24, options.limit ?? 6));
  const minimumScore = options.minimumScore ?? 0.01;
  const queryTokens = tokenize(query);
  const intent =
    options.intent ??
    classifyQueryIntent(query, {
      projects,
      rankedProjects,
    });
  if (queryTokens.length === 0 && intent === QUERY_INTENTS.UNKNOWN) return [];

  const normalizedQuery = normalizeSearchText(query);
  const comparison = COMPARISON_PATTERN.test(query);
  const limitation = LIMITATION_PATTERN.test(query);
  const nameMatches = matchedProjectNames(query, projects);
  const numberMatches = matchedProjectNumbers(query, rankedProjects);
  const documentFrequency = new Map();
  for (const token of new Set(queryTokens)) {
    documentFrequency.set(
      token,
      chunks.filter((chunk) =>
        new Set(
          tokenize(`${chunk.title} ${chunk.text} ${chunk.tags.join(" ")}`),
        ).has(token),
      ).length,
    );
  }

  const results = chunks.map((chunk) => {
    const title = normalizeSearchText(chunk.title);
    const text = normalizeSearchText(chunk.text);
    const tags = normalizeSearchText(chunk.tags.join(" "));
    let score = 0;
    const reasons = [];
    const matchedTokens = new Set();
    const intentScore = intentPriority(intent, chunk);
    if (intentScore > 0) {
      score += intentScore;
      reasons.push(`intent:${intent}`);
    }

    for (const token of queryTokens) {
      const df = documentFrequency.get(token) ?? 0;
      const idf = Math.log(1 + chunks.length / (1 + df));
      const titleHits = title
        .split(" ")
        .filter((part) => part === token).length;
      const tagHits = tags.split(" ").filter((part) => part === token).length;
      const textHits = Math.min(
        4,
        text.split(" ").filter((part) => part === token).length,
      );
      if (titleHits + tagHits + textHits > 0) matchedTokens.add(token);
      score += idf * (titleHits * 6 + tagHits * 3 + textHits);
    }

    if (normalizedQuery.length >= 4 && title.includes(normalizedQuery)) {
      score += 30;
      reasons.push("title-phrase");
    }
    if (chunk.projectSlug && nameMatches.has(chunk.projectSlug)) {
      const reason = nameMatches.get(chunk.projectSlug);
      score += reason === "exact-name" ? 120 : 80;
      reasons.push(reason);
    }
    if (chunk.projectSlug && numberMatches.has(chunk.projectSlug)) {
      score += 140;
      reasons.push("project-number");
    }
    if (
      limitation &&
      (chunk.kind.toLowerCase().includes("limitation") ||
        chunk.tags.some((tag) => LIMITATION_PATTERN.test(tag)))
    ) {
      score += 45;
      reasons.push("limitation");
    }
    if ((comparison || intent === QUERY_INTENTS.COMPARE) && chunk.projectSlug) {
      score += 8;
      reasons.push("comparison");
    }
    const hasDirectReference =
      reasons.includes("exact-name") ||
      reasons.includes("name") ||
      reasons.includes("project-number");
    if (
      !hasDirectReference &&
      intentScore === 0 &&
      queryTokens.length >= 3 &&
      matchedTokens.size < 2
    ) {
      score = 0;
    }
    return { chunk, score, reasons };
  });

  results.sort(
    (left, right) =>
      right.score - left.score || left.chunk.id.localeCompare(right.chunk.id),
  );
  const relevant = results.filter((result) => result.score >= minimumScore);

  if (!comparison && intent !== QUERY_INTENTS.COMPARE) {
    return relevant.slice(0, limit);
  }

  // A comparison is more useful with project diversity than with several
  // nearly-identical chunks from one project.
  const selected = [];
  const selectedIds = new Set();
  const seenProjects = new Set();
  for (const result of relevant) {
    const slug = result.chunk.projectSlug;
    if (!slug || seenProjects.has(slug)) continue;
    selected.push(result);
    selectedIds.add(result.chunk.id);
    seenProjects.add(slug);
    if (selected.length >= Math.min(limit, 4)) break;
  }
  for (const result of relevant) {
    if (selected.length >= limit) break;
    if (selectedIds.has(result.chunk.id)) continue;
    selected.push(result);
    selectedIds.add(result.chunk.id);
  }
  return selected;
}

export function isComparisonQuery(query) {
  return COMPARISON_PATTERN.test(String(query));
}

export function isLimitationQuery(query) {
  return LIMITATION_PATTERN.test(String(query));
}
