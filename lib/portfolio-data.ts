import knowledgeEnvelope from "../generated/knowledge-chunks.json";
import { projects as projectRecords } from "../data/projects";
import { rankedProjects as rankedProjectRecords } from "../data/ranked-projects";
import {
  validateProjectCollection,
  validateRankedProjects,
} from "./project-validation.mjs";
import { buildKnowledgeCorpus } from "./retrieval.mjs";

let cached:
  | {
      projects: Record<string, unknown>[];
      rankedProjects: Record<string, unknown>[];
      knowledgeEnvelope: unknown;
      chunks: ReturnType<typeof buildKnowledgeCorpus>;
      issues: Array<{ path: string; code: string; message: string }>;
      generatedKnowledgeLoaded: boolean;
    }
  | undefined;

/**
 * Bad optional generated data never takes down the portfolio: the retrieval
 * layer derives a minimum corpus from validated manual project records.
 */
export function getPortfolioRuntimeData() {
  if (cached) return cached;

  const projectResult = validateProjectCollection(projectRecords);
  const rankResult = validateRankedProjects(
    rankedProjectRecords,
    projectResult.projects.map((project) => String(project.slug)),
  );
  const generatedKnowledgeLoaded =
    knowledgeEnvelope !== null &&
    typeof knowledgeEnvelope === "object" &&
    Array.isArray((knowledgeEnvelope as { chunks?: unknown }).chunks) &&
    (knowledgeEnvelope as { chunks: unknown[] }).chunks.length > 0;

  cached = {
    projects: projectResult.projects,
    rankedProjects: rankResult.rankedProjects,
    knowledgeEnvelope: generatedKnowledgeLoaded
      ? knowledgeEnvelope
      : { chunks: [] },
    chunks: buildKnowledgeCorpus(
      projectResult.projects,
      generatedKnowledgeLoaded ? knowledgeEnvelope : { chunks: [] },
    ),
    issues: [...projectResult.issues, ...rankResult.issues],
    generatedKnowledgeLoaded,
  };
  return cached;
}
