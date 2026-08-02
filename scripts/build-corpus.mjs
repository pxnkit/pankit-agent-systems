import { createHash } from "node:crypto";
import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { extname, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { format as formatText } from "prettier";
import { containsExcludedSourceContent } from "../lib/content-policy.mjs";
import { classifyLink } from "../lib/link-policy.mjs";
import {
  validateProjectCollection,
  validateRankedProjects,
} from "../lib/project-validation.mjs";
import { normalizeSearchText, retrieveKnowledge } from "../lib/retrieval.mjs";
import {
  assertProjectPath,
  parseArguments,
  projectRoot,
  readLiteralExport,
  readOptionalJson,
} from "./_safe-project-data.mjs";

const GENERATED_AT = "2026-07-28T00:00:00.000Z";
const CAPTURED_AT = "2026-07-28";
const SOURCE_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:/-]{0,159}$/;
const REPOSITORY_EVIDENCE_FILE = "github-repository-evidence.json";
const MAX_EVIDENCE_CHUNK_CHARACTERS = 1_600;
const MAX_EVIDENCE_CHUNKS_PER_DOCUMENT = 12;

export const CORPUS_INVARIANTS = Object.freeze({
  minimumChunkCount: 60,
  minimumVerifiedPublicProjects: 15,
  minimumProfileSources: 1,
  minimumProfileChunks: 2,
  minimumThemeChunks: 4,
  mandatoryRetrievalAssertionCount: 8,
});

export const REQUIRED_CONTENT_SEEDS = Object.freeze([
  {
    fileName: "profile.mdx",
    sourceId: "curated:profile",
    kind: "profile",
  },
  {
    fileName: "research-overview.mdx",
    sourceId: "curated:research-overview",
    kind: "overview",
  },
  {
    fileName: "research-themes.mdx",
    sourceId: "curated:research-themes",
    kind: "theme",
  },
  {
    fileName: "project-map.mdx",
    sourceId: "curated:project-map",
    kind: "project-map",
  },
  {
    fileName: "site-scope.mdx",
    sourceId: "curated:site-scope",
    kind: "site-scope",
  },
  {
    fileName: "profile-education.mdx",
    sourceId: "curated:cv-education",
    kind: "profile",
  },
  {
    fileName: "profile-projects.mdx",
    sourceId: "curated:cv-projects",
    kind: "profile",
  },
  {
    fileName: "profile-technical.mdx",
    sourceId: "curated:cv-technical",
    kind: "profile",
  },
  {
    fileName: "profile-experience.mdx",
    sourceId: "curated:cv-experience",
    kind: "profile",
  },
  {
    fileName: "profile-publications.mdx",
    sourceId: "curated:cv-publications",
    kind: "profile",
  },
]);

const EXPECTED_ALLOWLIST = Object.freeze([
  "rka-lab",
  "txnmem",
  "chronicle-guard",
  "intentledger",
  "freshindex",
  "recallresolve",
  "hippogate",
  "hypothesisops",
  "methodchain",
  "changepilot",
  "memequiv",
  "currigraph",
  "communicate-to-remember",
  "scopeguard",
  "worldmodel-lstar",
  "lineagerag",
  "robustask",
  "skillfalsify",
  "regimebank",
  "memintervene",
  "certicompress",
  "tempo-trust",
  "temporags",
  "paramledger",
  "verifysplit",
  "evidroute",
  "trace-mem",
  "barriernow",
  "whofixesthis",
]);

const EXPECTED_EXCLUSIONS = Object.freeze([
  { slug: "matscisynth", aliases: ["matscisynth"] },
  { slug: "dosemirror", aliases: ["dosemirror"] },
  {
    slug: "fidelityttt",
    aliases: ["fidelityttt", "fidelityttt-lab"],
  },
  { slug: "novelnest", aliases: ["novelnest"] },
]);

const EXPECTED_RANKING = Object.freeze([
  { rank: 1, projectNumber: 24, title: "ChaffMem", slug: "chaffmem" },
  { rank: 2, projectNumber: 21, title: "MemEquiv", slug: "memequiv" },
  {
    rank: 3,
    projectNumber: 41,
    title: "SynthesisAutopsy",
    slug: "synthesisautopsy",
  },
  { rank: 4, projectNumber: 46, title: "RowWitness", slug: "rowwitness" },
  { rank: 5, projectNumber: 45, title: "ProbeDiff", slug: "probediff" },
  { rank: 6, projectNumber: 35, title: "VeriForget", slug: "veriforget" },
]);

const REQUIRED_PROJECT_MAP_SLUGS = Object.freeze([
  "rka-lab",
  "txnmem",
  "freshindex",
  "hippogate",
  "memequiv",
  "scopeguard",
  "regimebank",
  "memintervene",
  "certicompress",
  "paramledger",
  "trace-mem",
]);

const REQUIRED_PROJECT_MAP_CONCEPTS = Object.freeze([
  "recognition",
  "recall",
  "source",
  "action",
  "concurrency",
  "temporal validity",
  "consolidation",
  "causal influence",
  "correction",
  "forgetting",
  "scope",
  "provenance",
  "parameter promotion",
]);

const REQUIRED_RETRIEVAL_ASSERTION_IDS = Object.freeze([
  "identity",
  "overview",
  "research-connection",
  "exact-project",
  "comparison",
  "theme",
  "navigation",
  "excluded-topic",
]);

const GENERATED_FILE_NAMES = Object.freeze([
  "knowledge-chunks.json",
  "source-manifest.json",
  "search-index.json",
  "corpus-version.json",
]);

/** @param {unknown} value */
function isRecord(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

/** @param {unknown} value */
function stringList(value) {
  return Array.isArray(value)
    ? value.filter((entry) => typeof entry === "string" && entry.trim())
    : [];
}

/** @param {Iterable<string>} values */
function uniqueStrings(values) {
  return [...new Set([...values].map((value) => value.trim()).filter(Boolean))];
}

/** @param {unknown} value */
function hashValue(value) {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

/** @param {unknown} left @param {unknown} right */
function sameJson(left, right) {
  return JSON.stringify(left) === JSON.stringify(right);
}

/** @param {string} heading */
function headingSlug(heading) {
  return heading
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/** @param {string} markdown */
function markdownToText(markdown) {
  return markdown
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, "$1")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/[*_~>#]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** @param {string} markdown */
function markdownLinks(markdown) {
  return [...markdown.matchAll(/\[[^\]]+\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g)].map(
    (match) => match[1],
  );
}

/** @param {string} frontmatter @param {string} relativePath */
function parseSeedMetadata(frontmatter, relativePath) {
  const trimmed = frontmatter.trim();
  if (trimmed.startsWith("{")) {
    try {
      return JSON.parse(trimmed);
    } catch (error) {
      throw new Error(`${relativePath}: invalid JSON frontmatter.`, {
        cause: error,
      });
    }
  }

  const metadata = {};
  let listKey = null;
  for (const [index, rawLine] of frontmatter.split("\n").entries()) {
    if (!rawLine.trim()) continue;
    const listItem = rawLine.match(/^\s{2}-\s+(.+?)\s*$/);
    if (listItem) {
      if (!listKey || !Array.isArray(metadata[listKey])) {
        throw new Error(
          `${relativePath}: unexpected frontmatter list item on line ${index + 1}.`,
        );
      }
      metadata[listKey].push(listItem[1]);
      continue;
    }
    const property = rawLine.match(/^([A-Za-z][A-Za-z0-9-]*):(?:\s+(.*))?$/);
    if (!property) {
      throw new Error(
        `${relativePath}: unsupported frontmatter syntax on line ${index + 1}.`,
      );
    }
    const [, key, rawValue] = property;
    if (Object.hasOwn(metadata, key)) {
      throw new Error(`${relativePath}: duplicate frontmatter key: ${key}.`);
    }
    if (rawValue === undefined) {
      metadata[key] = [];
      listKey = key;
    } else {
      metadata[key] = rawValue.trim();
      listKey = null;
    }
  }
  return metadata;
}

/**
 * The five seed files use a deliberately small, data-only frontmatter subset.
 * The parser accepts conventional scalar/list YAML and one-line JSON fixtures,
 * while rejecting executable MDX constructs.
 *
 * @param {string} source
 * @param {string} relativePath
 */
export function parseContentSeed(source, relativePath) {
  const normalized = source.replace(/\r\n?/g, "\n");
  const match = normalized.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  if (!match) {
    throw new Error(
      `${relativePath}: expected frontmatter between --- markers.`,
    );
  }

  const metadata = parseSeedMetadata(match[1], relativePath);
  if (!isRecord(metadata)) {
    throw new Error(`${relativePath}: frontmatter must be an object.`);
  }

  const sourceId =
    typeof metadata.sourceId === "string" ? metadata.sourceId.trim() : "";
  const kind = typeof metadata.kind === "string" ? metadata.kind.trim() : "";
  const title = typeof metadata.title === "string" ? metadata.title.trim() : "";
  const url = typeof metadata.url === "string" ? metadata.url.trim() : "";
  const tags = uniqueStrings(stringList(metadata.tags));
  if (!SOURCE_ID_PATTERN.test(sourceId)) {
    throw new Error(`${relativePath}: invalid or missing sourceId.`);
  }
  if (!kind || !title || !url || tags.length === 0) {
    throw new Error(
      `${relativePath}: kind, title, url, and at least one tag are required.`,
    );
  }

  const body = match[2].trim();
  if (/<(?:script|iframe|object|embed)\b/i.test(body)) {
    throw new Error(`${relativePath}: executable embeds are not allowed.`);
  }
  const headings = [...body.matchAll(/^##[ \t]+(.+?)[ \t]*$/gm)];
  if (headings.length === 0) {
    throw new Error(
      `${relativePath}: at least one level-two section is required.`,
    );
  }

  const chunks = headings.map((heading, index) => {
    const sectionTitle = markdownToText(heading[1]);
    const start = heading.index + heading[0].length;
    const end =
      index + 1 < headings.length ? headings[index + 1].index : body.length;
    const text = markdownToText(body.slice(start, end));
    const sectionSlug = headingSlug(sectionTitle);
    if (!sectionTitle || !sectionSlug || !text) {
      throw new Error(
        `${relativePath}: every level-two section needs a title and body.`,
      );
    }
    return {
      id: `content:${sourceId.slice("curated:".length)}:${sectionSlug}`,
      sourceId,
      kind,
      title: `${title} — ${sectionTitle}`,
      text,
      url,
      tags: uniqueStrings([...tags, sectionTitle.toLowerCase()]),
    };
  });

  return {
    relativePath,
    metadata: { sourceId, kind, title, url, tags },
    body,
    links: markdownLinks(body),
    chunks,
  };
}

/** @param {string} url @param {Set<string>} projectSlugs */
function validateInternalUrl(url, projectSlugs) {
  let parsed;
  try {
    parsed = new URL(url, "https://portfolio.invalid");
  } catch {
    return false;
  }
  if (parsed.origin !== "https://portfolio.invalid") return false;

  const path = parsed.pathname.replace(/\/+$/, "") || "/";
  const staticRoutes = new Set([
    "/",
    "/portfolio",
    "/projects",
    "/writing",
    "/privacy",
    "/rss.xml",
  ]);
  if (staticRoutes.has(path)) {
    if (!parsed.hash) return true;
    return path === "/portfolio" && parsed.hash === "#themes-heading";
  }
  const projectMatch = path.match(/^\/projects\/([a-z0-9-]+)$/);
  return Boolean(projectMatch && projectSlugs.has(projectMatch[1]));
}

/** @param {Record<string, unknown>[]} projects @param {string[]} allowlist */
function projectChunks(projects, allowlist) {
  const bySlug = new Map(
    projects.map((project) => [String(project.slug), project]),
  );
  const chunks = [];
  for (const slug of allowlist) {
    const project = bySlug.get(slug);
    if (!project) continue;
    const sourceIds = stringList(project.sourceIds);
    const sourceId = sourceIds[0];
    const descriptions = [project.shortDescription, project.longDescription]
      .filter((value) => typeof value === "string" && value.trim())
      .map((value) => String(value).trim());
    chunks.push({
      id: `project:${slug}:summary`,
      sourceId,
      kind: "project-summary",
      projectSlug: slug,
      title: String(project.title),
      text: descriptions.join(" "),
      url: String(project.repositoryUrl),
      tags: uniqueStrings([
        ...stringList(project.tags),
        String(project.primaryPillar ?? ""),
      ]),
    });
    stringList(project.limitations).forEach((limitation, index) => {
      chunks.push({
        id: `project:${slug}:limitation:${index + 1}`,
        sourceId: sourceIds[Math.min(index, sourceIds.length - 1)],
        kind: "project-limitation",
        projectSlug: slug,
        title: `${String(project.title)} — limitation`,
        text: limitation.trim(),
        url: String(project.repositoryUrl),
        tags: uniqueStrings(["limitation", ...stringList(project.tags)]),
      });
    });
  }
  return chunks;
}

/** @param {string} value */
function splitEvidenceText(value) {
  const clean = markdownToText(value);
  if (!clean) return [];
  const chunks = [];
  let remainder = clean;
  while (remainder && chunks.length < MAX_EVIDENCE_CHUNKS_PER_DOCUMENT) {
    if (remainder.length <= MAX_EVIDENCE_CHUNK_CHARACTERS) {
      chunks.push(remainder);
      break;
    }
    const boundary = Math.max(
      remainder.lastIndexOf(". ", MAX_EVIDENCE_CHUNK_CHARACTERS),
      remainder.lastIndexOf("; ", MAX_EVIDENCE_CHUNK_CHARACTERS),
      remainder.lastIndexOf(" ", MAX_EVIDENCE_CHUNK_CHARACTERS),
    );
    const end = boundary > 300 ? boundary + 1 : MAX_EVIDENCE_CHUNK_CHARACTERS;
    chunks.push(remainder.slice(0, end).trim());
    remainder = remainder.slice(end).trim();
  }
  return chunks.filter(Boolean);
}

/** @param {unknown} evidence */
function repositoryEvidenceChunks(evidence) {
  if (!isRecord(evidence) || !Array.isArray(evidence.documents)) return [];
  return evidence.documents.flatMap((document) => {
    if (!isRecord(document)) return [];
    const id = typeof document.id === "string" ? document.id : "";
    const sourceId =
      typeof document.sourceId === "string" ? document.sourceId : "";
    const title = typeof document.title === "string" ? document.title : "";
    const url = typeof document.url === "string" ? document.url : "";
    const tags = uniqueStrings([
      ...stringList(document.tags),
      typeof document.repository === "string" ? document.repository : "",
    ]);
    const parts = splitEvidenceText(
      typeof document.content === "string" ? document.content : "",
    );
    if (
      !SOURCE_ID_PATTERN.test(id) ||
      !SOURCE_ID_PATTERN.test(sourceId) ||
      !title ||
      !url ||
      tags.length === 0
    ) {
      return [];
    }
    return parts.map((text, index) => ({
      id: `${id}:part:${index + 1}`,
      sourceId,
      kind: "repository-documentation",
      title: parts.length > 1 ? `${title} - part ${index + 1}` : title,
      text,
      url,
      tags,
    }));
  });
}

/** @param {Record<string, unknown>[]} rankedProjects */
function rankingChunk(rankedProjects) {
  const ranking = rankedProjects
    .map(
      (project) =>
        `Rank ${project.rank}: ${project.title}, project ${project.projectNumber}.`,
    )
    .join(" ");
  return {
    id: "manual:ranked-projects",
    sourceId: "manual:ranked-projects",
    kind: "ranking",
    title: "Curated project ranking",
    text: `${ranking} Only MemEquiv has a verified public repository source; the other ranked entries remain title-only and pending.`,
    url: "/projects",
    tags: ["ranking", "manual curation"],
  };
}

/**
 * @param {Record<string, unknown>[]} projects
 * @param {string[]} allowlist
 * @param {ReturnType<typeof parseContentSeed>[]} seeds
 * @param {Record<string, unknown>[]} rankedProjects
 * @param {Record<string, unknown>[]} repositoryDocuments
 * @param {string} version
 */
function buildSourceManifest(
  projects,
  allowlist,
  seeds,
  rankedProjects,
  repositoryDocuments,
  version,
) {
  const bySlug = new Map(
    projects.map((project) => [String(project.slug), project]),
  );
  const sources = allowlist.map((slug) => {
    const project = bySlug.get(slug);
    const sourceIds = stringList(project?.sourceIds);
    const localSource = sourceIds.find((sourceId) =>
      sourceId.startsWith("local:"),
    );
    return {
      projectSlug: slug,
      sourceIds,
      primaryKind: localSource
        ? localSource.includes("implementation-brief")
          ? "local-implementation-brief"
          : "local-readme"
        : "trusted-github-metadata",
      ...(localSource
        ? {
            localPath:
              slug === "recallresolve"
                ? "../prompts/14_RECALLRESOLVE_PUBLICATION_GRADE_IMPLEMENTATION_PROMPT.md"
                : `../${slug}/README.md`,
          }
        : {}),
      trustedUrls: [String(project?.repositoryUrl)],
    };
  });
  const pendingRankedSourceIds = rankedProjects
    .map((ranked) => bySlug.get(String(ranked.slug)))
    .filter((project) => project?.sourceStatus === "pending")
    .flatMap((project) => stringList(project?.sourceIds));
  sources.push({
    sourceIds: uniqueStrings([
      "manual:ranked-projects",
      ...pendingRankedSourceIds,
    ]),
    primaryKind: "manual-curation",
    localPath: "data/ranked-projects.ts",
    trustedUrls: [],
  });
  seeds.forEach((seed) => {
    sources.push({
      sourceIds: [seed.metadata.sourceId],
      primaryKind: "curated-mdx",
      contentKind: seed.metadata.kind,
      title: seed.metadata.title,
      localPath: seed.relativePath,
      url: seed.metadata.url,
      trustedUrls: [],
    });
  });
  repositoryDocuments.forEach((document) => {
    if (!isRecord(document)) return;
    const sourceId =
      typeof document.sourceId === "string" ? document.sourceId : "";
    const url = typeof document.url === "string" ? document.url : "";
    if (!SOURCE_ID_PATTERN.test(sourceId) || !url) return;
    sources.push({
      sourceIds: [sourceId],
      primaryKind: "trusted-github-documentation",
      title: typeof document.title === "string" ? document.title : sourceId,
      trustedUrls: [url],
    });
  });

  const rankedEntries = rankedProjects.map((ranked) => {
    const project = bySlug.get(String(ranked.slug));
    const verified = project?.sourceStatus === "verified";
    const sourceIds = stringList(project?.sourceIds);
    const githubSourceId = sourceIds.find((sourceId) =>
      sourceId.startsWith("github:"),
    );
    return {
      rank: ranked.rank,
      projectNumber: ranked.projectNumber,
      title: ranked.title,
      slug: ranked.slug,
      sourceId: verified
        ? (githubSourceId ?? sourceIds[0])
        : (sourceIds[0] ?? `ranked:project-${ranked.projectNumber}`),
      sourceStatus: verified ? "verified" : "pending",
      evidenceLevel: verified ? "public-repository" : "title-only",
      ...(verified && typeof project?.repositoryUrl === "string"
        ? { trustedUrl: project.repositoryUrl }
        : {}),
    };
  });

  return {
    schemaVersion: 1,
    version,
    capturedAt: CAPTURED_AT,
    generatedAt: GENERATED_AT,
    precedence: [
      "manual-curation",
      "curated-mdx",
      "local-readme-and-docs",
      "trusted-github-documentation",
      "trusted-github-metadata",
    ],
    overridePolicy:
      "Manual descriptions, rankings, aliases, featured choices, and exclusions always override generated metadata.",
    trustedHosts: ["github.com"],
    sourceCount: sources.length,
    sources,
    rankedEntries,
  };
}

/**
 * @param {Record<string, unknown>[]} projects
 * @param {Record<string, unknown>[]} rankedProjects
 * @param {Record<string, unknown>[]} chunks
 */
function buildSearchDocuments(projects, rankedProjects, chunks) {
  const rankBySlug = new Map(
    rankedProjects.map((project) => [String(project.slug), project]),
  );
  const projectDocuments = projects.map((project) => {
    const slug = String(project.slug);
    const ranked = rankBySlug.get(slug);
    return {
      id: `project:${slug}`,
      kind: "project",
      slug,
      title: String(project.title),
      summary: String(
        project.shortDescription ?? project.longDescription ?? "",
      ),
      terms: uniqueStrings([
        ...stringList(project.aliases),
        ...stringList(project.tags),
        ...(ranked
          ? [`project ${ranked.projectNumber}`, `rank ${ranked.rank}`]
          : []),
      ]),
      ...(typeof project.repositoryUrl === "string"
        ? { url: project.repositoryUrl }
        : { url: `/projects/${slug}` }),
      sourceIds: stringList(project.sourceIds),
    };
  });
  const corpusDocuments = chunks
    .filter((chunk) => !chunk.projectSlug)
    .map((chunk) => ({
      id: `knowledge:${chunk.id}`,
      kind: String(chunk.kind),
      title: String(chunk.title),
      summary: String(chunk.text),
      terms: stringList(chunk.tags),
      ...(typeof chunk.url === "string" ? { url: chunk.url } : {}),
      sourceIds: [String(chunk.sourceId)],
    }));
  return [...projectDocuments, ...corpusDocuments];
}

/**
 * @param {Record<string, unknown>[]} chunks
 * @param {Record<string, unknown>[]} projects
 * @param {Record<string, unknown>[]} rankedProjects
 */
function runRetrievalAssertions(chunks, projects, rankedProjects) {
  const retrieve = (query) =>
    retrieveKnowledge(query, {
      chunks,
      projects,
      rankedProjects,
      limit: 8,
      minimumScore: 0.01,
    });

  const cases = [
    {
      id: "identity",
      results: retrieve("Who is Pankit Brahmkhatri?"),
      check: (results) =>
        results.some(
          ({ chunk }) =>
            chunk.sourceId === "curated:profile" && chunk.kind === "profile",
        ),
    },
    {
      id: "overview",
      results: retrieve("Give me Pankit's research overview."),
      check: (results) =>
        results.some(
          ({ chunk }) => chunk.sourceId === "curated:research-overview",
        ),
    },
    {
      id: "research-connection",
      results: retrieve(
        "Explain the research connection between causal influence, scope, and provenance",
      ),
      check: (results) =>
        results.some(({ chunk }) => chunk.sourceId === "curated:project-map"),
    },
    {
      id: "exact-project",
      results: retrieve("What is MemEquiv?"),
      check: (results) =>
        results.some(({ chunk }) => chunk.projectSlug === "memequiv"),
    },
    {
      id: "comparison",
      results: retrieve("Compare TxnMem and FreshIndex"),
      check: (results) => {
        const slugs = new Set(
          results.map(({ chunk }) => chunk.projectSlug).filter(Boolean),
        );
        return slugs.has("txnmem") && slugs.has("freshindex");
      },
    },
    {
      id: "theme",
      results: retrieve(
        "What are the research themes in test-time learning and reliable tool agents?",
      ),
      check: (results) =>
        results.some(
          ({ chunk }) => chunk.sourceId === "curated:research-themes",
        ),
    },
    {
      id: "navigation",
      results: retrieve("Where can I browse all projects and writing?"),
      check: (results) =>
        results.some(({ chunk }) => chunk.sourceId === "curated:site-scope"),
    },
    {
      id: "excluded-topic",
      results: retrieve("What is Pankit's present employer?"),
      check: (results) => results.length === 0,
    },
  ];

  return cases.map(({ id, results, check }) => ({
    id,
    ok: check(results),
    matchCount: results.length,
  }));
}

/**
 * @param {{
 *   projects: Record<string, unknown>[],
 *   rankedProjects: Record<string, unknown>[],
 *   allowlist: string[],
 *   exclusions: Record<string, unknown>[],
 *   seeds: ReturnType<typeof parseContentSeed>[],
 *   knowledge: Record<string, unknown>,
 *   sourceManifest: Record<string, unknown>,
 *   searchIndex: Record<string, unknown>,
 *   retrievalAssertions: Array<{id: string, ok: boolean, matchCount: number}>
 * }} input
 */
function validateBuiltCorpus(input) {
  const issues = [];
  const {
    projects,
    rankedProjects,
    allowlist,
    exclusions,
    seeds,
    knowledge,
    sourceManifest,
    searchIndex,
    retrievalAssertions,
  } = input;

  const add = (message) => issues.push(message);
  if (!sameJson(allowlist, EXPECTED_ALLOWLIST)) {
    add("The project allowlist differs from the canonical 29-project order.");
  }
  const normalizedExclusions = exclusions.map((exclusion) => ({
    slug: String(exclusion.slug ?? "").toLowerCase(),
    aliases: uniqueStrings([
      String(exclusion.slug ?? "").toLowerCase(),
      ...stringList(exclusion.aliases).map((alias) => alias.toLowerCase()),
    ]).sort(),
  }));
  const expectedExclusions = EXPECTED_EXCLUSIONS.map((exclusion) => ({
    slug: exclusion.slug,
    aliases: [...exclusion.aliases].sort(),
  }));
  const excludedProjectNames = uniqueStrings(
    normalizedExclusions.flatMap(({ aliases }) => aliases),
  );
  const containsExcludedProjectName = (value) => {
    const normalized = normalizeSearchText(value);
    return excludedProjectNames.some((name) => {
      const normalizedName = normalizeSearchText(name);
      return ` ${normalized} `.includes(` ${normalizedName} `);
    });
  };
  if (!sameJson(normalizedExclusions, expectedExclusions)) {
    add("The explicit project exclusion set differs from the canonical set.");
  }
  exclusions.forEach((exclusion, index) => {
    if (
      exclusion.reason !== "explicit-request" ||
      exclusion.disposition !== "exclude-from-ingestion-and-display"
    ) {
      add(`projectExclusions[${index}] has an invalid policy disposition.`);
    }
  });
  if (!sameJson(rankedProjects, EXPECTED_RANKING)) {
    add("The manually curated six-project ranking has changed.");
  }

  const projectBySlug = new Map(
    projects.map((project) => [String(project.slug), project]),
  );
  const allowlistSet = new Set(allowlist);
  const verifiedProjects = allowlist
    .map((slug) => projectBySlug.get(slug))
    .filter(
      (project) =>
        project?.sourceStatus === "verified" &&
        typeof project.repositoryUrl === "string",
    );
  for (const slug of allowlist) {
    const project = projectBySlug.get(slug);
    if (!project) {
      add(`Allowlisted project is missing: ${slug}.`);
      continue;
    }
    if (
      project.sourceStatus !== "verified" ||
      project.repositoryUrl !== `https://github.com/pxnkit/${slug}`
    ) {
      add(
        `Allowlisted project is not a verified canonical repository: ${slug}.`,
      );
    }
  }

  const rootSeedNames = seeds.map(({ relativePath }) =>
    relativePath.replace(/^content\//, ""),
  );
  if (
    !sameJson(
      rootSeedNames,
      REQUIRED_CONTENT_SEEDS.map(({ fileName }) => fileName),
    )
  ) {
    add(
      "The five root content seed files are missing, extra, or out of order.",
    );
  }
  REQUIRED_CONTENT_SEEDS.forEach((required, index) => {
    const seed = seeds[index];
    if (
      !seed ||
      seed.metadata.sourceId !== required.sourceId ||
      seed.metadata.kind !== required.kind
    ) {
      add(
        `${required.fileName} does not use its canonical source ID and kind.`,
      );
    }
  });

  const profile = seeds.find(
    ({ metadata }) => metadata.sourceId === "curated:profile",
  );
  if (
    !profile?.body.includes(
      "Pankit Brahmkhatri is a Master's CS student at TU Dresden",
    )
  ) {
    add("The approved education identity is missing from profile.mdx.");
  }
  for (const focus of [
    "agent memory",
    "information retrieval",
    "test-time learning",
    "search-guided reasoning",
    "reliable tool agents",
  ]) {
    if (!profile?.body.toLowerCase().includes(focus)) {
      add(`profile.mdx is missing the research focus: ${focus}.`);
    }
  }
  const researchOverview = seeds.find(
    ({ metadata }) => metadata.sourceId === "curated:research-overview",
  );
  if (
    !researchOverview?.body
      .toLowerCase()
      .includes("memory as a decision system")
  ) {
    add(
      "research-overview.mdx is missing the shared memory-as-a-decision-system framing.",
    );
  }

  const projectMap = seeds.find(
    ({ metadata }) => metadata.sourceId === "curated:project-map",
  );
  const normalizedProjectMap = normalizeSearchText(projectMap?.body ?? "");
  for (const concept of REQUIRED_PROJECT_MAP_CONCEPTS) {
    if (!normalizedProjectMap.includes(normalizeSearchText(concept))) {
      add(`project-map.mdx is missing the concept: ${concept}.`);
    }
  }
  for (const slug of REQUIRED_PROJECT_MAP_SLUGS) {
    if (!projectMap?.links.includes(`/projects/${slug}`)) {
      add(`project-map.mdx is missing the project link: ${slug}.`);
    }
  }
  if (
    !projectMap?.body.includes("verified public metadata level") ||
    !projectMap.body.includes("intentionally not inferred")
  ) {
    add("Trace-Mem needs an explicit metadata-only caveat in project-map.mdx.");
  }

  const allKnownProjectSlugs = new Set(
    projects.map(({ slug }) => String(slug)),
  );
  for (const seed of seeds) {
    if (
      containsExcludedSourceContent(
        `${seed.metadata.title}\n${seed.body}\n${seed.metadata.tags.join("\n")}`,
      )
    ) {
      add(`${seed.relativePath} contains prohibited source content.`);
    }
    if (
      containsExcludedProjectName(
        `${seed.metadata.title}\n${seed.body}\n${seed.metadata.tags.join("\n")}`,
      )
    ) {
      add(`${seed.relativePath} names an explicitly excluded project.`);
    }
    for (const link of [seed.metadata.url, ...seed.links]) {
      const classification = classifyLink(link);
      if (!classification.allowed) {
        add(`${seed.relativePath} contains a blocked source link: ${link}.`);
      } else if (
        classification.kind === "internal" &&
        !validateInternalUrl(link, allKnownProjectSlugs)
      ) {
        add(
          `${seed.relativePath} contains a broken internal source link: ${link}.`,
        );
      }
    }
  }

  const chunks = Array.isArray(knowledge.chunks) ? knowledge.chunks : [];
  if (!Array.isArray(knowledge.chunks)) {
    add("knowledge-chunks.json must contain a chunks array.");
  }
  const pendingProjectCount = projects.filter(
    ({ sourceStatus }) => sourceStatus === "pending",
  ).length;
  const catalogCountChunk = chunks.find(
    (chunk) => chunk?.id === "content:project-map:indexed-catalog",
  );
  const expectedCatalogCount =
    `${projects.length} indexed project records: ` +
    `${verifiedProjects.length} verified public projects and ` +
    `${pendingProjectCount} pending title-only records`;
  if (!catalogCountChunk?.text?.includes(expectedCatalogCount)) {
    add("The computed indexed catalog count chunk is missing or stale.");
  }
  const registeredSourceIds = new Set();
  const sourceIdOwners = new Map();
  const sources = Array.isArray(sourceManifest.sources)
    ? sourceManifest.sources
    : [];
  if (!Array.isArray(sourceManifest.sources)) {
    add("source-manifest.json must contain a sources array.");
  }
  sources.forEach((source, index) => {
    if (!isRecord(source)) {
      add(`source-manifest sources[${index}] must be an object.`);
      return;
    }
    const sourcePath = `source-manifest sources[${index}]`;
    const sourceIds = stringList(source.sourceIds);
    if (
      sourceIds.length === 0 ||
      typeof source.primaryKind !== "string" ||
      !source.primaryKind.trim()
    ) {
      add(`${sourcePath} needs sourceIds and a primaryKind.`);
    }
    sourceIds.forEach((sourceId) => {
      if (!SOURCE_ID_PATTERN.test(sourceId)) {
        add(`${sourcePath} has an invalid source ID: ${sourceId}.`);
      }
      if (sourceIdOwners.has(sourceId)) {
        add(
          `${sourcePath} duplicates source ID ${sourceId} from ${sourceIdOwners.get(sourceId)}.`,
        );
      }
      sourceIdOwners.set(sourceId, sourcePath);
      registeredSourceIds.add(sourceId);
    });
    if (!Array.isArray(source.trustedUrls)) {
      add(`${sourcePath}.trustedUrls must be an array.`);
    }
    stringList(source.trustedUrls).forEach((url) => {
      const classification = classifyLink(url);
      if (!classification.allowed || classification.kind !== "external") {
        add(`${sourcePath} contains an invalid trusted URL: ${url}.`);
      }
    });
    if (typeof source.projectSlug === "string") {
      const project = projectBySlug.get(source.projectSlug);
      if (
        !allowlistSet.has(source.projectSlug) ||
        !project ||
        !sameJson(sourceIds, stringList(project.sourceIds))
      ) {
        add(`${sourcePath} does not match its allowlisted project record.`);
      }
    }
    if (typeof source.url === "string") {
      const classification = classifyLink(source.url);
      if (
        !classification.allowed ||
        (classification.kind === "internal" &&
          !validateInternalUrl(source.url, allKnownProjectSlugs))
      ) {
        add(`${sourcePath} contains an invalid canonical URL.`);
      }
    }
  });
  if (
    sourceManifest.schemaVersion !== 1 ||
    sourceManifest.sourceCount !== sources.length
  ) {
    add("source-manifest sourceCount does not match the sources array.");
  }
  const rankedEntries = Array.isArray(sourceManifest.rankedEntries)
    ? sourceManifest.rankedEntries
    : [];
  if (rankedEntries.length !== EXPECTED_RANKING.length) {
    add(
      "source-manifest rankedEntries must contain the canonical six entries.",
    );
  }
  rankedEntries.forEach((entry, index) => {
    if (
      !isRecord(entry) ||
      !registeredSourceIds.has(String(entry.sourceId ?? "")) ||
      entry.rank !== EXPECTED_RANKING[index]?.rank ||
      entry.projectNumber !== EXPECTED_RANKING[index]?.projectNumber ||
      entry.title !== EXPECTED_RANKING[index]?.title ||
      entry.slug !== EXPECTED_RANKING[index]?.slug
    ) {
      add(`source-manifest rankedEntries[${index}] is invalid.`);
    }
  });

  const ids = new Set();
  const fingerprints = new Set();
  for (const [index, chunk] of chunks.entries()) {
    const path = `knowledge chunks[${index}]`;
    if (!isRecord(chunk)) {
      add(`${path} must be an object.`);
      continue;
    }
    const requiredStrings = ["id", "sourceId", "kind", "title", "text"];
    for (const field of requiredStrings) {
      if (typeof chunk[field] !== "string" || !chunk[field].trim()) {
        add(`${path}.${field} must be a non-empty string.`);
      }
    }
    if (!SOURCE_ID_PATTERN.test(String(chunk.sourceId ?? ""))) {
      add(`${path}.sourceId is invalid.`);
    }
    if (!SOURCE_ID_PATTERN.test(String(chunk.id ?? ""))) {
      add(`${path}.id is invalid.`);
    }
    if (!registeredSourceIds.has(chunk.sourceId)) {
      add(`${path} references an unregistered source ID: ${chunk.sourceId}.`);
    }
    if (!Array.isArray(chunk.tags) || stringList(chunk.tags).length === 0) {
      add(`${path}.tags must contain at least one string.`);
    }
    if (ids.has(chunk.id)) add(`Duplicate chunk ID: ${chunk.id}.`);
    ids.add(chunk.id);
    const fingerprint = [
      String(chunk.projectSlug ?? ""),
      String(chunk.kind ?? ""),
      normalizeSearchText(chunk.text),
    ].join("|");
    if (fingerprints.has(fingerprint)) {
      add(`Duplicate chunk fingerprint: ${chunk.id}.`);
    }
    fingerprints.add(fingerprint);
    if (
      containsExcludedSourceContent(
        `${chunk.title ?? ""}\n${chunk.text ?? ""}\n${stringList(chunk.tags).join("\n")}`,
      )
    ) {
      add(`${path} contains prohibited source content.`);
    }
    if (
      containsExcludedProjectName(
        `${chunk.title ?? ""}\n${chunk.text ?? ""}\n${stringList(chunk.tags).join("\n")}`,
      )
    ) {
      add(`${path} names an explicitly excluded project.`);
    }
    if (typeof chunk.projectSlug === "string") {
      const project = projectBySlug.get(chunk.projectSlug);
      if (!allowlistSet.has(chunk.projectSlug) || !project) {
        add(`${path} references a project outside the allowlist.`);
      } else if (
        !stringList(project.sourceIds).includes(String(chunk.sourceId))
      ) {
        add(`${path} uses a source ID not owned by its project.`);
      }
    }
    if (typeof chunk.url === "string") {
      const classification = classifyLink(chunk.url);
      if (!classification.allowed) {
        add(`${path}.url is blocked by the link policy.`);
      } else if (
        classification.kind === "internal" &&
        !validateInternalUrl(chunk.url, allKnownProjectSlugs)
      ) {
        add(`${path}.url does not resolve to a known internal route.`);
      }
    }
  }

  const profileSources = sources.filter(
    (source) => source?.contentKind === "profile",
  ).length;
  const profileChunks = chunks.filter(
    (chunk) => chunk?.kind === "profile",
  ).length;
  const themeChunks = chunks.filter((chunk) => chunk?.kind === "theme").length;
  const requiredSourceIdsPresent = REQUIRED_CONTENT_SEEDS.every(
    ({ sourceId }) => registeredSourceIds.has(sourceId),
  );
  if (chunks.length < CORPUS_INVARIANTS.minimumChunkCount) {
    add(
      `Corpus has ${chunks.length} chunks; minimum is ${CORPUS_INVARIANTS.minimumChunkCount}.`,
    );
  }
  if (
    verifiedProjects.length < CORPUS_INVARIANTS.minimumVerifiedPublicProjects
  ) {
    add(
      `Corpus has ${verifiedProjects.length} verified projects; minimum is ${CORPUS_INVARIANTS.minimumVerifiedPublicProjects}.`,
    );
  }
  if (profileSources < CORPUS_INVARIANTS.minimumProfileSources) {
    add("Corpus needs at least one profile source.");
  }
  if (profileChunks < CORPUS_INVARIANTS.minimumProfileChunks) {
    add("Corpus needs at least two profile chunks.");
  }
  if (themeChunks < CORPUS_INVARIANTS.minimumThemeChunks) {
    add("Corpus needs at least four theme chunks.");
  }
  if (!requiredSourceIdsPresent) {
    add("One or more required curated source IDs are missing.");
  }

  const documents = Array.isArray(searchIndex.documents)
    ? searchIndex.documents
    : [];
  if (
    searchIndex.schemaVersion !== 1 ||
    searchIndex.documentCount !== documents.length
  ) {
    add("search-index.json has an invalid envelope or document count.");
  }
  const documentIds = new Set();
  documents.forEach((document, index) => {
    if (
      !isRecord(document) ||
      typeof document.id !== "string" ||
      typeof document.kind !== "string" ||
      typeof document.title !== "string" ||
      typeof document.summary !== "string"
    ) {
      add(`search-index documents[${index}] is invalid.`);
      return;
    }
    if (documentIds.has(document.id)) {
      add(`Duplicate search document ID: ${document.id}.`);
    }
    documentIds.add(document.id);
    const documentSourceIds = stringList(document.sourceIds);
    if (documentSourceIds.length === 0) {
      add(`Search document ${document.id} has no source IDs.`);
    }
    for (const sourceId of documentSourceIds) {
      if (!registeredSourceIds.has(sourceId)) {
        add(`Search document ${document.id} uses an unregistered source ID.`);
      }
    }
    const documentText = `${document.title}\n${document.summary}\n${stringList(
      document.terms,
    ).join("\n")}`;
    if (
      containsExcludedSourceContent(documentText) ||
      containsExcludedProjectName(documentText)
    ) {
      add(`Search document ${document.id} contains prohibited content.`);
    }
    if (typeof document.url === "string") {
      const classification = classifyLink(document.url);
      if (
        !classification.allowed ||
        (classification.kind === "internal" &&
          !validateInternalUrl(document.url, allKnownProjectSlugs))
      ) {
        add(`Search document ${document.id} contains an invalid URL.`);
      }
    }
  });
  for (const sourceId of REQUIRED_CONTENT_SEEDS.map(
    ({ sourceId }) => sourceId,
  )) {
    if (
      !documents.some((document) =>
        stringList(document?.sourceIds).includes(sourceId),
      )
    ) {
      add(`Search index is missing curated source: ${sourceId}.`);
    }
  }

  if (
    !sameJson(
      retrievalAssertions.map(({ id }) => id),
      REQUIRED_RETRIEVAL_ASSERTION_IDS,
    ) ||
    retrievalAssertions.length !==
      CORPUS_INVARIANTS.mandatoryRetrievalAssertionCount
  ) {
    add("The mandatory retrieval assertion set is incomplete or reordered.");
  }
  retrievalAssertions.forEach((assertion) => {
    if (!assertion.ok) add(`Retrieval assertion failed: ${assertion.id}.`);
  });
  if (
    knowledge.version !== sourceManifest.version ||
    knowledge.version !== searchIndex.version ||
    knowledge.generatedAt !== GENERATED_AT ||
    sourceManifest.generatedAt !== GENERATED_AT ||
    searchIndex.generatedAt !== GENERATED_AT
  ) {
    add("Generated artifact versions or timestamps are inconsistent.");
  }

  const checks = {
    uniqueChunkIds: ids.size === chunks.length,
    uniqueChunkFingerprints: fingerprints.size === chunks.length,
    sourceIdsRegistered: !issues.some((issue) =>
      issue.includes("unregistered source ID"),
    ),
    allowlistExact: sameJson(allowlist, EXPECTED_ALLOWLIST),
    exclusionsExact: sameJson(normalizedExclusions, expectedExclusions),
    internalLinksValid: !issues.some(
      (issue) =>
        issue.includes("broken internal source link") ||
        issue.includes("known internal route"),
    ),
    prohibitedContentAbsent: !issues.some((issue) =>
      /prohibited (?:source )?content|explicitly excluded project/.test(issue),
    ),
    minimumChunkCount: chunks.length >= CORPUS_INVARIANTS.minimumChunkCount,
    minimumVerifiedPublicProjects:
      verifiedProjects.length >=
      CORPUS_INVARIANTS.minimumVerifiedPublicProjects,
    profileCoverage:
      profileSources >= CORPUS_INVARIANTS.minimumProfileSources &&
      profileChunks >= CORPUS_INVARIANTS.minimumProfileChunks,
    themeCoverage: themeChunks >= CORPUS_INVARIANTS.minimumThemeChunks,
    requiredSourcesPresent: requiredSourceIdsPresent,
    retrievalAssertionsPassed:
      retrievalAssertions.length ===
        CORPUS_INVARIANTS.mandatoryRetrievalAssertionCount &&
      retrievalAssertions.every(({ ok }) => ok),
  };

  return {
    ok: issues.length === 0,
    issues,
    checks,
    counts: {
      chunkCount: chunks.length,
      verifiedPublicProjectCount: verifiedProjects.length,
      profileSourceCount: profileSources,
      profileChunkCount: profileChunks,
      themeChunkCount: themeChunks,
      sourceCount: sources.length,
      searchDocumentCount: documents.length,
    },
  };
}

/** @param {string} contentDirectory */
async function loadSeeds(contentDirectory) {
  const rootMdxFiles = (
    await readdir(contentDirectory, { withFileTypes: true })
  )
    .filter((entry) => entry.isFile() && extname(entry.name) === ".mdx")
    .map((entry) => entry.name)
    .sort();
  const expectedSorted = REQUIRED_CONTENT_SEEDS.map(
    ({ fileName }) => fileName,
  ).sort();
  if (!sameJson(rootMdxFiles, expectedSorted)) {
    throw new Error(
      `content/ must contain exactly these curated root MDX seeds: ${expectedSorted.join(", ")}.`,
    );
  }

  return Promise.all(
    REQUIRED_CONTENT_SEEDS.map(async ({ fileName }) => {
      const path = assertProjectPath(resolve(contentDirectory, fileName));
      return parseContentSeed(
        await readFile(path, "utf8"),
        `content/${fileName}`,
      );
    }),
  );
}

/**
 * Build and validate every generated retrieval artifact from data-only project
 * records, public repository documentation, and curated MDX seeds.
 *
 * @param {{
 *   projectsPath?: string,
 *   rankedProjectsPath?: string,
 *   allowlistPath?: string,
 *   exclusionsPath?: string,
 *   contentDirectory?: string,
 *   generatedDirectory?: string,
 *   repositoryEvidencePath?: string,
 *   write?: boolean
 * }} [options]
 */
export async function buildCorpus(options = {}) {
  const projectsPath = assertProjectPath(
    options.projectsPath ?? resolve(projectRoot, "data/projects.ts"),
  );
  const rankedProjectsPath = assertProjectPath(
    options.rankedProjectsPath ??
      resolve(projectRoot, "data/ranked-projects.ts"),
  );
  const allowlistPath = assertProjectPath(
    options.allowlistPath ?? resolve(projectRoot, "data/project-allowlist.ts"),
  );
  const exclusionsPath = assertProjectPath(
    options.exclusionsPath ??
      resolve(projectRoot, "data/project-exclusions.ts"),
  );
  const contentDirectory = assertProjectPath(
    options.contentDirectory ?? resolve(projectRoot, "content"),
  );
  const generatedDirectory = assertProjectPath(
    options.generatedDirectory ?? resolve(projectRoot, "generated"),
  );
  const repositoryEvidencePath = assertProjectPath(
    options.repositoryEvidencePath ??
      resolve(projectRoot, "data", REPOSITORY_EVIDENCE_FILE),
  );

  const [
    rawProjects,
    rawRankedProjects,
    rawAllowlist,
    rawExclusions,
    seeds,
    repositoryEvidence,
  ] = await Promise.all([
    readLiteralExport(projectsPath, "projects"),
    readLiteralExport(rankedProjectsPath, "rankedProjects"),
    readLiteralExport(allowlistPath, "projectAllowlist"),
    readLiteralExport(exclusionsPath, "projectExclusions"),
    loadSeeds(contentDirectory),
    readOptionalJson(repositoryEvidencePath, { documents: [] }),
  ]);

  const projectResult = validateProjectCollection(rawProjects);
  const rankResult = validateRankedProjects(
    rawRankedProjects,
    projectResult.projects.map((project) => String(project.slug)),
  );
  const dataIssues = [...projectResult.issues, ...rankResult.issues];
  if (dataIssues.length > 0) {
    throw new Error(
      `Portfolio data validation failed:\n${dataIssues
        .map((issue) => `- ${issue.path}: ${issue.message}`)
        .join("\n")}`,
    );
  }
  if (!Array.isArray(rawAllowlist) || !Array.isArray(rawExclusions)) {
    throw new Error("Allowlist and exclusion exports must both be arrays.");
  }

  const projects = projectResult.projects;
  const rankedProjects = rankResult.rankedProjects;
  const allowlist = rawAllowlist.map(String);
  const exclusions = rawExclusions;
  const verifiedPublicProjectCount = projects.filter(
    ({ sourceStatus, repositoryUrl }) =>
      sourceStatus === "verified" && typeof repositoryUrl === "string",
  ).length;
  const pendingTitleOnlyProjectCount = projects.filter(
    ({ sourceStatus }) => sourceStatus === "pending",
  ).length;
  const seedChunks = seeds
    .flatMap(({ chunks: parsedChunks }) => parsedChunks)
    .map((chunk) =>
      chunk.id === "content:project-map:indexed-catalog"
        ? {
            ...chunk,
            text: `${chunk.text} The portfolio has ${projects.length} indexed project records: ${verifiedPublicProjectCount} verified public projects and ${pendingTitleOnlyProjectCount} pending title-only records.`,
          }
        : chunk,
    );
  const evidenceChunks = repositoryEvidenceChunks(repositoryEvidence);
  const repositoryDocuments =
    isRecord(repositoryEvidence) && Array.isArray(repositoryEvidence.documents)
      ? repositoryEvidence.documents.filter(isRecord)
      : [];
  const chunks = [
    ...projectChunks(projects, allowlist),
    ...seedChunks,
    ...evidenceChunks,
    rankingChunk(rankedProjects),
  ];
  const versionSeed = {
    allowlist,
    exclusions,
    rankedProjects,
    chunks,
    repositoryEvidence: repositoryDocuments.map((document) => ({
      id: document.id,
      sourceId: document.sourceId,
      url: document.url,
    })),
    seedMetadata: seeds.map(({ metadata, relativePath }) => ({
      relativePath,
      ...metadata,
    })),
  };
  const version = `${CAPTURED_AT}.${hashValue(versionSeed).slice(0, 12)}`;
  const knowledge = { version, generatedAt: GENERATED_AT, chunks };
  const sourceManifest = buildSourceManifest(
    projects,
    allowlist,
    seeds,
    rankedProjects,
    repositoryDocuments,
    version,
  );
  const documents = buildSearchDocuments(projects, rankedProjects, chunks);
  const searchIndex = {
    schemaVersion: 1,
    version,
    generatedAt: GENERATED_AT,
    documentCount: documents.length,
    documents,
  };
  const retrievalAssertions = runRetrievalAssertions(
    chunks,
    projects,
    rankedProjects,
  );
  const validation = validateBuiltCorpus({
    projects,
    rankedProjects,
    allowlist,
    exclusions,
    seeds,
    knowledge,
    sourceManifest,
    searchIndex,
    retrievalAssertions,
  });
  if (!validation.ok) {
    throw new Error(
      `Corpus validation failed:\n${validation.issues
        .map((issue) => `- ${issue}`)
        .join("\n")}`,
    );
  }

  const kindCounts = Object.fromEntries(
    [...new Set(chunks.map(({ kind }) => kind))]
      .sort()
      .map((kind) => [
        kind,
        chunks.filter((chunk) => chunk.kind === kind).length,
      ]),
  );
  const corpusVersion = {
    schemaVersion: 1,
    version,
    generatedAt: GENERATED_AT,
    catalogProjectCount: projects.length,
    verifiedPublicProjectCount,
    pendingTitleOnlyProjectCount,
    featuredProjectCount: projects.filter(({ featured }) => featured).length,
    rankedProjectCount: rankedProjects.length,
    knowledgeChunkCount: validation.counts.chunkCount,
    searchDocumentCount: validation.counts.searchDocumentCount,
    sourceCount: validation.counts.sourceCount,
    profileSourceCount: validation.counts.profileSourceCount,
    profileChunkCount: validation.counts.profileChunkCount,
    themeChunkCount: validation.counts.themeChunkCount,
    kindCounts,
    sourceManifestVersion: sourceManifest.schemaVersion,
    contentPolicyVersion: 1,
    manualOverrideRevision: 1,
    hashes: {
      knowledge: hashValue(knowledge),
      sourceManifest: hashValue(sourceManifest),
      searchIndex: hashValue(searchIndex),
    },
    checks: validation.checks,
    retrievalAssertions,
    notes: [
      "Manual project records override generated metadata.",
      "Only allowlisted verified projects contribute project knowledge chunks.",
      "Explicit project and indexed-source exclusions are enforced.",
      "Corpus release minima are hard validation invariants, not environment configuration.",
    ],
  };

  const artifacts = { knowledge, sourceManifest, searchIndex, corpusVersion };
  if (options.write !== false) {
    await mkdir(generatedDirectory, { recursive: true });
    const [
      knowledgeText,
      sourceManifestText,
      searchIndexText,
      corpusVersionText,
    ] = await Promise.all(
      [knowledge, sourceManifest, searchIndex, corpusVersion].map((artifact) =>
        formatText(JSON.stringify(artifact), { parser: "json" }),
      ),
    );
    await Promise.all([
      writeFile(
        resolve(generatedDirectory, "knowledge-chunks.json"),
        knowledgeText,
        "utf8",
      ),
      writeFile(
        resolve(generatedDirectory, "source-manifest.json"),
        sourceManifestText,
        "utf8",
      ),
      writeFile(
        resolve(generatedDirectory, "search-index.json"),
        searchIndexText,
        "utf8",
      ),
      writeFile(
        resolve(generatedDirectory, "corpus-version.json"),
        corpusVersionText,
        "utf8",
      ),
    ]);
  }

  return { ...artifacts, validation };
}

/**
 * Rebuild in memory and require the committed generated artifacts to be byte-
 * semantically equivalent to that canonical result.
 *
 * @param {Parameters<typeof buildCorpus>[0]} [options]
 */
export async function checkCorpus(options = {}) {
  const generatedDirectory = assertProjectPath(
    options.generatedDirectory ?? resolve(projectRoot, "generated"),
  );
  const expected = await buildCorpus({ ...options, write: false });
  const expectedByFile = new Map([
    ["knowledge-chunks.json", expected.knowledge],
    ["source-manifest.json", expected.sourceManifest],
    ["search-index.json", expected.searchIndex],
    ["corpus-version.json", expected.corpusVersion],
  ]);
  const actualValues = await Promise.all(
    GENERATED_FILE_NAMES.map((fileName) =>
      readOptionalJson(resolve(generatedDirectory, fileName), null),
    ),
  );
  const issues = [];
  GENERATED_FILE_NAMES.forEach((fileName, index) => {
    if (!sameJson(actualValues[index], expectedByFile.get(fileName))) {
      issues.push(`${fileName} is missing or out of date.`);
    }
  });
  return {
    ok: issues.length === 0,
    issues,
    counts: expected.validation.counts,
    checks: expected.validation.checks,
    retrievalAssertions: expected.corpusVersion.retrievalAssertions,
  };
}

function printReport(result, suffix) {
  console.log(
    `Corpus valid: ${result.counts.chunkCount} chunks, ${result.counts.verifiedPublicProjectCount} verified public projects, ${result.counts.sourceCount} sources${suffix}.`,
  );
  console.log("Mandatory retrieval assertions:");
  result.retrievalAssertions.forEach((assertion) => {
    console.log(
      `- ${assertion.id}: ${assertion.ok ? "PASS" : "FAIL"} (${assertion.matchCount} matches)`,
    );
  });
}

async function main() {
  const args = parseArguments(process.argv.slice(2));
  if (args.has("check")) {
    const result = await checkCorpus();
    if (!result.ok) {
      console.error("Corpus check failed:");
      result.issues.forEach((issue) => console.error(`- ${issue}`));
      process.exitCode = 1;
      return;
    }
    printReport(result, "; generated artifacts are current");
    return;
  }
  const result = await buildCorpus();
  printReport(
    {
      counts: result.validation.counts,
      retrievalAssertions: result.corpusVersion.retrievalAssertions,
    },
    "; generated artifacts written",
  );
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  await main();
}
