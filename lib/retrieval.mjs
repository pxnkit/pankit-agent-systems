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
  const text = typeof chunk.text === "string" ? chunk.text.trim() : "";
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

/**
 * Generated chunks are accepted only for known projects and known project
 * source IDs. Manual records remain authoritative.
 *
 * @param {Iterable<Record<string, unknown>>} projects
 * @param {unknown} [knowledgeEnvelope]
 */
export function buildKnowledgeCorpus(projects, knowledgeEnvelope) {
  const projectList = [...projects];
  const projectBySlug = new Map(
    projectList.map((project) => [String(project.slug), project]),
  );
  const generated = chunksFromEnvelope(knowledgeEnvelope).filter((chunk) => {
    if (!chunk.projectSlug) return true;
    const project = projectBySlug.get(chunk.projectSlug);
    return (
      project !== undefined &&
      stringList(project.sourceIds).includes(chunk.sourceId)
    );
  });
  return dedupeChunks([
    ...generated,
    ...projectsToKnowledgeChunks(projectList),
  ]);
}

/** @param {string} query @param {Iterable<Record<string, unknown>>} rankedProjects */
function matchedProjectNumbers(query, rankedProjects) {
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
function matchedProjectNames(query, projects) {
  const normalizedQuery = normalizeSearchText(query);
  const matches = new Map();
  for (const project of projects) {
    const names = [project.title, ...stringList(project.aliases)]
      .filter((name) => typeof name === "string")
      .map(normalizeSearchText)
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
 * Deterministic lexical retrieval with explicit boosts for exact project
 * references, comparisons, and limitation questions.
 *
 * @param {string} query
 * @param {{
 *   chunks: Iterable<ReturnType<typeof normalizeKnowledgeChunk>>,
 *   projects?: Iterable<Record<string, unknown>>,
 *   rankedProjects?: Iterable<Record<string, unknown>>,
 *   limit?: number,
 *   minimumScore?: number
 * }} options
 */
export function retrieveKnowledge(query, options) {
  const chunks = dedupeChunks(options.chunks);
  const projects = [...(options.projects ?? [])];
  const rankedProjects = [...(options.rankedProjects ?? [])];
  const limit = Math.max(1, Math.min(12, options.limit ?? 6));
  const minimumScore = options.minimumScore ?? 0.01;
  const queryTokens = tokenize(query);
  if (queryTokens.length === 0) return [];

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
    if (comparison && chunk.projectSlug) {
      score += 8;
      reasons.push("comparison");
    }
    const hasDirectReference =
      reasons.includes("exact-name") ||
      reasons.includes("name") ||
      reasons.includes("project-number");
    if (
      !hasDirectReference &&
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

  if (!comparison) return relevant.slice(0, limit);

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
