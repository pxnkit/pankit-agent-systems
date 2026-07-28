import corpusVersionEnvelope from "../generated/corpus-version.json";
import knowledgeEnvelope from "../generated/knowledge-chunks.json";
import searchIndexEnvelope from "../generated/search-index.json";
import sourceManifestEnvelope from "../generated/source-manifest.json";
import { projects as projectRecords } from "../data/projects";
import { rankedProjects as rankedProjectRecords } from "../data/ranked-projects";
import { containsExcludedSourceContent } from "./content-policy.mjs";
import {
  validateProjectCollection,
  validateRankedProjects,
} from "./project-validation.mjs";
import {
  buildKnowledgeCorpus,
  chunksFromEnvelope,
  findDuplicateChunks,
  sourceRegistryFromManifest,
} from "./retrieval.mjs";

const REQUIRED_CURATED_SOURCES = [
  "curated:profile",
  "curated:research-overview",
  "curated:research-themes",
  "curated:project-map",
  "curated:site-scope",
] as const;

type MandatoryRetrievalChecks = Record<string, boolean> & {
  allPassed: boolean;
};

type RuntimeData = {
  projects: Record<string, unknown>[];
  rankedProjects: Record<string, unknown>[];
  knowledgeEnvelope: unknown;
  sourceManifest: unknown;
  corpusVersionEnvelope: unknown;
  searchIndexEnvelope: unknown;
  chunks: ReturnType<typeof buildKnowledgeCorpus>;
  issues: Array<{ path: string; code: string; message: string }>;
  generatedKnowledgeLoaded: boolean;
  indexedProjects: number;
  knowledgeChunks: number;
  profileSources: number;
  corpusVersion: string | null;
  snapshotGeneratedAt: string | null;
  mandatoryRetrievalChecks: MandatoryRetrievalChecks;
};

let cached: RuntimeData | undefined;

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function booleanCheck(
  checks: Record<string, unknown>,
  key: string,
  fallback: boolean,
) {
  return typeof checks[key] === "boolean" ? checks[key] : fallback;
}

function duplicateDocumentIds(documents: unknown[]) {
  const seen = new Set<string>();
  for (const document of documents) {
    if (!isRecord(document) || typeof document.id !== "string") return true;
    if (seen.has(document.id)) return true;
    seen.add(document.id);
  }
  return false;
}

function snapshotTimestamp(...values: unknown[]) {
  for (const value of values) {
    if (typeof value !== "string" || !value.trim()) continue;
    const timestamp = Date.parse(value);
    if (Number.isFinite(timestamp)) return new Date(timestamp).toISOString();
  }
  return null;
}

/**
 * Bad optional generated data never takes down the portfolio: the retrieval
 * layer derives a minimum corpus from validated manual project records. Health
 * still reports every mandatory corpus failure so incomplete releases degrade.
 */
export function getPortfolioRuntimeData(): RuntimeData {
  if (cached) return cached;

  const projectResult = validateProjectCollection(projectRecords);
  const rankResult = validateRankedProjects(
    rankedProjectRecords,
    projectResult.projects.map((project) => String(project.slug)),
  );
  const rawKnowledge: Record<string, unknown> = isRecord(knowledgeEnvelope)
    ? (knowledgeEnvelope as unknown as Record<string, unknown>)
    : { chunks: [] };
  const rawChunks: unknown[] = Array.isArray(rawKnowledge.chunks)
    ? [...rawKnowledge.chunks]
    : [];
  const normalizedGeneratedChunks = chunksFromEnvelope(rawKnowledge);
  const generatedKnowledgeLoaded = normalizedGeneratedChunks.length > 0;
  const registry = sourceRegistryFromManifest(sourceManifestEnvelope);
  const duplicateReport = findDuplicateChunks(normalizedGeneratedChunks);
  const knownProjectSlugs = new Set(
    projectResult.projects.map((project) => String(project.slug)),
  );
  const generatedProjectSlugsValid = normalizedGeneratedChunks.every(
    (chunk) => !chunk?.projectSlug || knownProjectSlugs.has(chunk.projectSlug),
  );
  const prohibitedContentAbsent = rawChunks.every((chunk) => {
    if (!isRecord(chunk)) return false;
    const record = chunk as Record<string, unknown>;
    const title = typeof record.title === "string" ? record.title : "";
    const text =
      typeof record.text === "string"
        ? record.text
        : typeof record.content === "string"
          ? record.content
          : "";
    return !containsExcludedSourceContent(`${title}\n${text}`);
  });
  const profileChunks = normalizedGeneratedChunks.filter(
    (chunk) =>
      chunk?.kind.toLowerCase() === "profile" ||
      chunk?.sourceId === "curated:profile",
  );
  const profileSourceIds = new Set(
    profileChunks.map((chunk) => chunk?.sourceId).filter(Boolean),
  );
  const themeChunks = normalizedGeneratedChunks.filter(
    (chunk) =>
      chunk?.kind.toLowerCase().includes("theme") ||
      chunk?.sourceId === "curated:research-themes",
  );
  const verifiedPublicProjects = projectResult.projects.filter(
    (project) => project.sourceStatus === "verified",
  ).length;
  const sourceIdsRegistered = normalizedGeneratedChunks.every(
    (chunk) => chunk && registry.sourceIds.has(chunk.sourceId),
  );
  const requiredSourcesPresent = REQUIRED_CURATED_SOURCES.every(
    (sourceId) =>
      registry.sourceIds.has(sourceId) &&
      normalizedGeneratedChunks.some((chunk) => chunk?.sourceId === sourceId),
  );

  const sourceManifest: Record<string, unknown> = isRecord(
    sourceManifestEnvelope,
  )
    ? (sourceManifestEnvelope as unknown as Record<string, unknown>)
    : {};
  const corpusVersionRecord: Record<string, unknown> = isRecord(
    corpusVersionEnvelope,
  )
    ? (corpusVersionEnvelope as unknown as Record<string, unknown>)
    : {};
  const searchIndex: Record<string, unknown> = isRecord(searchIndexEnvelope)
    ? (searchIndexEnvelope as unknown as Record<string, unknown>)
    : {};
  const corpusChecks = isRecord(corpusVersionRecord.checks)
    ? corpusVersionRecord.checks
    : {};
  const retrievalAssertions = Array.isArray(
    corpusVersionRecord.retrievalAssertions,
  )
    ? corpusVersionRecord.retrievalAssertions
    : [];
  const retrievalAssertionsPassed =
    retrievalAssertions.length >= 8 &&
    retrievalAssertions.every(
      (assertion: unknown) => isRecord(assertion) && assertion.ok === true,
    );
  const searchDocuments = Array.isArray(searchIndex.documents)
    ? searchIndex.documents
    : [];
  const declaredDocumentCount =
    typeof searchIndex.documentCount === "number"
      ? searchIndex.documentCount
      : searchDocuments.length;
  const searchIndexValid =
    searchDocuments.length >= projectResult.projects.length &&
    declaredDocumentCount === searchDocuments.length &&
    !duplicateDocumentIds(searchDocuments);
  const manifestValid =
    Array.isArray(sourceManifest.sources) && registry.sourceIds.size > 0;
  const corpusVersion =
    typeof corpusVersionRecord.version === "string" &&
    corpusVersionRecord.version.trim()
      ? corpusVersionRecord.version.trim()
      : typeof rawKnowledge.version === "string" && rawKnowledge.version.trim()
        ? rawKnowledge.version.trim()
        : null;
  const checksWithoutSummary: Record<string, boolean> = {
    uniqueChunkIds: booleanCheck(
      corpusChecks,
      "uniqueChunkIds",
      duplicateReport.duplicateIds.length === 0,
    ),
    uniqueChunkFingerprints: booleanCheck(
      corpusChecks,
      "uniqueChunkFingerprints",
      duplicateReport.duplicateFingerprints.length === 0,
    ),
    sourceIdsRegistered: booleanCheck(
      corpusChecks,
      "sourceIdsRegistered",
      sourceIdsRegistered,
    ),
    allowlistExact: booleanCheck(
      corpusChecks,
      "allowlistExact",
      generatedProjectSlugsValid && projectResult.issues.length === 0,
    ),
    exclusionsExact: booleanCheck(
      corpusChecks,
      "exclusionsExact",
      prohibitedContentAbsent,
    ),
    internalLinksValid: booleanCheck(corpusChecks, "internalLinksValid", false),
    prohibitedContentAbsent: booleanCheck(
      corpusChecks,
      "prohibitedContentAbsent",
      prohibitedContentAbsent,
    ),
    minimumChunkCount: booleanCheck(
      corpusChecks,
      "minimumChunkCount",
      normalizedGeneratedChunks.length >= 60,
    ),
    minimumVerifiedPublicProjects: booleanCheck(
      corpusChecks,
      "minimumVerifiedPublicProjects",
      verifiedPublicProjects >= 15,
    ),
    profileCoverage: booleanCheck(
      corpusChecks,
      "profileCoverage",
      profileSourceIds.size >= 1 && profileChunks.length >= 2,
    ),
    themeCoverage: booleanCheck(
      corpusChecks,
      "themeCoverage",
      themeChunks.length >= 4,
    ),
    requiredSourcesPresent: booleanCheck(
      corpusChecks,
      "requiredSourcesPresent",
      requiredSourcesPresent,
    ),
    retrievalAssertionsPassed: booleanCheck(
      corpusChecks,
      "retrievalAssertionsPassed",
      retrievalAssertionsPassed,
    ),
    manifestValid,
    searchIndexValid,
    corpusVersionValid: Boolean(corpusVersion),
  };
  const mandatoryRetrievalChecks: MandatoryRetrievalChecks = {
    ...checksWithoutSummary,
    allPassed: Object.values(checksWithoutSummary).every(Boolean),
  };
  const chunks = buildKnowledgeCorpus(
    projectResult.projects,
    generatedKnowledgeLoaded ? rawKnowledge : { chunks: [] },
    { sourceManifest: sourceManifestEnvelope },
  );

  cached = {
    projects: projectResult.projects,
    rankedProjects: rankResult.rankedProjects,
    knowledgeEnvelope: generatedKnowledgeLoaded ? rawKnowledge : { chunks: [] },
    sourceManifest: sourceManifestEnvelope,
    corpusVersionEnvelope,
    searchIndexEnvelope,
    chunks,
    issues: [...projectResult.issues, ...rankResult.issues],
    generatedKnowledgeLoaded,
    indexedProjects: projectResult.projects.length,
    knowledgeChunks: normalizedGeneratedChunks.length,
    profileSources: profileSourceIds.size,
    corpusVersion,
    snapshotGeneratedAt: snapshotTimestamp(
      corpusVersionRecord.generatedAt,
      rawKnowledge.generatedAt,
      sourceManifest.generatedAt,
      sourceManifest.capturedAt,
    ),
    mandatoryRetrievalChecks,
  };
  return cached;
}
