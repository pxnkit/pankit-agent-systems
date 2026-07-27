import {
  INDEXED_SCOPE_RESPONSE,
  classifyExcludedQuery,
  containsExcludedSourceContent,
} from "../content-policy.mjs";
import { buildKnowledgeCorpus, retrieveKnowledge } from "../retrieval.mjs";
import {
  sourcesFromRetrieval,
  validateProviderOutput,
} from "../source-validation.mjs";
import { buildSystemPrompt } from "./system-prompt.mjs";
import { RetrievalOnlyProvider } from "./retrieval-only-provider.mjs";

/**
 * @param {{
 *   projects: Iterable<Record<string, unknown>>,
 *   rankedProjects?: Iterable<Record<string, unknown>>,
 *   knowledgeEnvelope?: unknown,
 *   provider: {id: string, generate(input: Record<string, unknown>): Promise<unknown>},
 *   baseOrigin?: string
 * }} options
 */
export function createChatService(options) {
  const projects = [...options.projects];
  const rankedProjects = [...(options.rankedProjects ?? [])];
  const chunks = buildKnowledgeCorpus(projects, options.knowledgeEnvelope);
  const fallback = new RetrievalOnlyProvider();

  return {
    projectCount: projects.length,
    chunkCount: chunks.length,
    providerId: options.provider.id,

    /**
     * @param {{message: string, history?: Array<{role: "user" | "assistant", content: string}>}} input
     */
    async answer(input) {
      const excludedCategory = classifyExcludedQuery(input.message);
      if (excludedCategory) {
        return {
          answer: INDEXED_SCOPE_RESPONSE,
          sources: [],
          sourceIds: [],
          mode: "scope-policy",
          excludedCategory,
        };
      }

      const retrieved = retrieveKnowledge(input.message, {
        chunks,
        projects,
        rankedProjects,
        limit: 6,
      });
      const sources = sourcesFromRetrieval(retrieved, {
        maxSources: 5,
        baseOrigin: options.baseOrigin,
      });
      const providerInput = {
        message: input.message,
        history: input.history ?? [],
        sources,
        systemPrompt: buildSystemPrompt(sources),
      };

      let providerOutput;
      let mode = options.provider.id;
      try {
        providerOutput = await options.provider.generate(providerInput);
      } catch {
        providerOutput = await fallback.generate(providerInput);
        mode = fallback.id;
      }

      let validated = validateProviderOutput(providerOutput, sources, {
        baseOrigin: options.baseOrigin,
      });
      if (!validated.ok || containsExcludedSourceContent(validated.answer)) {
        providerOutput = await fallback.generate(providerInput);
        validated = validateProviderOutput(providerOutput, sources, {
          baseOrigin: options.baseOrigin,
        });
        mode = fallback.id;
      }

      if (!validated.ok) {
        return {
          answer:
            "I couldn’t find enough evidence in the indexed portfolio sources to answer that.",
          sources: [],
          sourceIds: [],
          mode: fallback.id,
          excludedCategory: null,
        };
      }

      const usedSourceIds = new Set(validated.sourceIds);
      return {
        answer: validated.answer,
        sources: sources.filter((source) => usedSourceIds.has(source.id)),
        sourceIds: validated.sourceIds,
        mode,
        excludedCategory: null,
      };
    },
  };
}
