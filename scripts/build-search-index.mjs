import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { containsExcludedSourceContent } from "../lib/content-policy.mjs";
import {
  validateProjectCollection,
  validateRankedProjects,
} from "../lib/project-validation.mjs";
import {
  assertProjectPath,
  parseArguments,
  projectRoot,
  readLiteralExport,
  readOptionalJson,
} from "./_safe-project-data.mjs";

/**
 * @param {{
 *   projectsPath?: string,
 *   rankedProjectsPath?: string,
 *   knowledgePath?: string,
 *   outputPath?: string,
 *   write?: boolean
 * }} [options]
 */
export async function buildSearchIndex(options = {}) {
  const projectsPath = assertProjectPath(
    options.projectsPath ?? resolve(projectRoot, "data/projects.ts"),
  );
  const rankedProjectsPath = assertProjectPath(
    options.rankedProjectsPath ??
      resolve(projectRoot, "data/ranked-projects.ts"),
  );
  const knowledgePath = assertProjectPath(
    options.knowledgePath ??
      resolve(projectRoot, "generated/knowledge-chunks.json"),
  );
  const outputPath = assertProjectPath(
    options.outputPath ?? resolve(projectRoot, "generated/search-index.json"),
  );

  const [rawProjects, rawRanked, knowledgeEnvelope, existingIndex] =
    await Promise.all([
      readLiteralExport(projectsPath, "projects"),
      readLiteralExport(rankedProjectsPath, "rankedProjects"),
      readOptionalJson(knowledgePath, { version: 1, chunks: [] }),
      readOptionalJson(outputPath, null),
    ]);
  const projectResult = validateProjectCollection(rawProjects);
  const rankResult = validateRankedProjects(
    rawRanked,
    projectResult.projects.map((project) => String(project.slug)),
  );
  const issues = [...projectResult.issues, ...rankResult.issues];
  if (issues.length > 0) {
    throw new Error(
      `Content validation failed:\n${issues
        .map((issue) => `- ${issue.path}: ${issue.message}`)
        .join("\n")}`,
    );
  }

  const existingDocuments =
    existingIndex &&
    typeof existingIndex === "object" &&
    Array.isArray(existingIndex.documents)
      ? new Map(
          existingIndex.documents
            .filter(
              (document) =>
                document &&
                typeof document === "object" &&
                typeof document.slug === "string",
            )
            .map((document) => [document.slug, document]),
        )
      : new Map();
  const rankBySlug = new Map(
    rankResult.rankedProjects.map((ranked) => [String(ranked.slug), ranked]),
  );
  const documents = projectResult.projects.map((project) => {
    const slug = String(project.slug);
    const existing = existingDocuments.get(slug);
    const fallbackSummary =
      typeof project.shortDescription === "string"
        ? project.shortDescription
        : String(project.longDescription ?? "");
    const summaryCandidate =
      existing && typeof existing.summary === "string"
        ? existing.summary
        : fallbackSummary;
    const summary = containsExcludedSourceContent(summaryCandidate)
      ? fallbackSummary
      : summaryCandidate;
    const existingTerms =
      existing && Array.isArray(existing.terms)
        ? existing.terms.filter(
            (term) => typeof term === "string" && term.trim(),
          )
        : [];
    const ranked = rankBySlug.get(slug);
    const derivedTerms = [
      ...(Array.isArray(project.aliases) ? project.aliases : []),
      ...(Array.isArray(project.tags) ? project.tags : []),
      ...(ranked
        ? [`project ${ranked.projectNumber}`, `rank ${ranked.rank}`]
        : []),
    ];
    const terms = [
      ...new Set(existingTerms.length > 0 ? existingTerms : derivedTerms),
    ];
    return {
      id: `project:${slug}`,
      kind: "project",
      slug,
      title: String(project.title),
      summary,
      terms,
      ...(typeof project.repositoryUrl === "string"
        ? { url: project.repositoryUrl }
        : {}),
      sourceIds: Array.isArray(project.sourceIds) ? project.sourceIds : [],
    };
  });
  const generatedAt =
    existingIndex &&
    typeof existingIndex === "object" &&
    typeof existingIndex.generatedAt === "string"
      ? existingIndex.generatedAt
      : knowledgeEnvelope &&
          typeof knowledgeEnvelope === "object" &&
          typeof knowledgeEnvelope.generatedAt === "string"
        ? knowledgeEnvelope.generatedAt
        : "1970-01-01T00:00:00.000Z";
  const index = {
    schemaVersion: 1,
    generatedAt,
    documentCount: documents.length,
    documents,
  };

  if (options.write !== false) {
    await mkdir(dirname(outputPath), { recursive: true });
    await writeFile(outputPath, `${JSON.stringify(index, null, 2)}\n`, "utf8");
  }
  return index;
}

async function main() {
  const args = parseArguments(process.argv.slice(2));
  const output =
    typeof args.get("output") === "string"
      ? resolve(projectRoot, args.get("output"))
      : undefined;
  const index = await buildSearchIndex({
    outputPath: output,
    write: !args.has("check"),
  });
  console.log(
    `Search index valid (${index.documentCount} project documents)` +
      (args.has("check") ? "; no files written." : "."),
  );
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  await main();
}
