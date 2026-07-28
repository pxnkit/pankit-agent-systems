import {
  INDEXED_SCOPE_RESPONSE,
  classifyExcludedQuery,
  containsExcludedSourceContent,
} from "../content-policy.mjs";
import {
  QUERY_INTENTS,
  buildKnowledgeCorpus,
  classifyQueryIntent,
  dedupeChunks,
  retrieveKnowledge,
} from "../retrieval.mjs";
import {
  sourcesFromRetrieval,
  validateProviderOutput,
} from "../source-validation.mjs";
import { buildSystemPrompt } from "./system-prompt.mjs";
import { RetrievalOnlyProvider } from "./retrieval-only-provider.mjs";

const CANONICAL_INTENTS = new Set([
  QUERY_INTENTS.IDENTITY,
  QUERY_INTENTS.PORTFOLIO_OVERVIEW,
  QUERY_INTENTS.RESEARCH_CONNECTION,
  QUERY_INTENTS.EXACT,
  QUERY_INTENTS.COMPARE,
  QUERY_INTENTS.THEME,
  QUERY_INTENTS.SITE,
  QUERY_INTENTS.SCOPE,
  QUERY_INTENTS.GITHUB,
  QUERY_INTENTS.PENDING_SHORTLIST,
  QUERY_INTENTS.LIMITATION,
]);

/** @param {unknown} error */
export function providerFallbackReason(error) {
  const value =
    error && typeof error === "object"
      ? /** @type {Record<string, unknown>} */ (error)
      : {};
  const status = Number(value.status ?? value.statusCode ?? value.code);
  const message =
    error instanceof Error
      ? error.message.toLowerCase()
      : String(error ?? "").toLowerCase();
  if (
    status === 429 ||
    /\b(?:quota|rate.?limit|capacity|too many requests|allocation)\b/.test(
      message,
    )
  ) {
    return "provider-quota-or-capacity";
  }
  if (status === 408 || /\b(?:timeout|timed out)\b/.test(message)) {
    return "provider-timeout";
  }
  return "provider-unavailable";
}

/** @param {Iterable<{id: string}>} sources @param {Iterable<string>} usedIds */
function usedSources(sources, usedIds) {
  const used = new Set(usedIds);
  return [...sources].filter((source) => used.has(source.id));
}

/**
 * @param {{
 *   projects: Iterable<Record<string, unknown>>,
 *   rankedProjects?: Iterable<Record<string, unknown>>,
 *   knowledgeEnvelope?: unknown,
 *   sourceManifest?: unknown,
 *   chunks?: Iterable<Record<string, unknown>>,
 *   provider?: {id: string, aiMode?: string, configured?: boolean, generate(input: Record<string, unknown>): Promise<unknown>},
 *   baseOrigin?: string
 * }} options
 */
export function createChatService(options) {
  const projects = [...options.projects];
  const rankedProjects = [...(options.rankedProjects ?? [])];
  const chunks = options.chunks
    ? dedupeChunks(options.chunks)
    : buildKnowledgeCorpus(projects, options.knowledgeEnvelope, {
        sourceManifest: options.sourceManifest,
      });
  const fallback = new RetrievalOnlyProvider();
  const provider = options.provider ?? fallback;
  const providerId = provider.id ?? fallback.id;
  const aiMode = provider.aiMode ?? providerId;

  /** @param {{message: string, history?: Array<{role: "user" | "assistant", content: string}>}} input */
  function prepareInput(input) {
    const excludedCategory = classifyExcludedQuery(input.message);
    if (excludedCategory) {
      return { excludedCategory };
    }
    const intent = classifyQueryIntent(input.message, {
      projects,
      rankedProjects,
    });
    const retrieved = retrieveKnowledge(input.message, {
      chunks,
      projects,
      rankedProjects,
      intent,
      limit: 24,
    });
    const sources = sourcesFromRetrieval(retrieved, {
      maxSources: 6,
      baseOrigin: options.baseOrigin,
    });
    return {
      excludedCategory: null,
      intent,
      sources,
      providerInput: {
        message: input.message,
        history: (input.history ?? []).slice(-6),
        intent,
        sources,
        systemPrompt: buildSystemPrompt(sources),
      },
    };
  }

  /**
   * @param {ReturnType<typeof prepareInput>} prepared
   * @param {string | null} fallbackReason
   */
  async function renderRetrievalFallback(prepared, fallbackReason) {
    if (
      prepared.excludedCategory ||
      !("providerInput" in prepared) ||
      !("sources" in prepared) ||
      !("intent" in prepared)
    ) {
      return {
        answer: INDEXED_SCOPE_RESPONSE,
        sources: [],
        sourceIds: [],
        mode: "scope-policy",
        aiMode,
        providerId,
        intent: QUERY_INTENTS.SCOPE,
        excludedCategory: prepared.excludedCategory ?? "scope",
        fallbackUsed: false,
        fallbackReason: null,
      };
    }

    const output = await fallback.generate(prepared.providerInput);
    const validated = validateProviderOutput(output, prepared.sources, {
      baseOrigin: options.baseOrigin,
      allowSourceLessAbstention: true,
    });
    if (!validated.ok) {
      return {
        answer:
          "The retrieved records could not be rendered safely. Browse the cited project catalogue while the index is refreshed.",
        sources: [],
        sourceIds: [],
        mode: fallback.id,
        aiMode,
        providerId,
        intent: prepared.intent,
        excludedCategory: null,
        fallbackUsed: true,
        fallbackReason: "fallback-validation-failed",
      };
    }
    return {
      answer: validated.answer,
      sources: usedSources(prepared.sources, validated.sourceIds),
      sourceIds: validated.sourceIds,
      mode: fallback.id,
      aiMode,
      providerId,
      intent: prepared.intent,
      excludedCategory: null,
      fallbackUsed: true,
      fallbackReason,
    };
  }

  return {
    projectCount: projects.length,
    chunkCount: chunks.length,
    providerId,
    aiMode,

    /**
     * Return the verified evidence and prompt needed for an actual provider
     * stream. Canonical and source-less questions stay on deterministic paths.
     *
     * @param {{message: string, history?: Array<{role: "user" | "assistant", content: string}>}} input
     */
    prepareStreamingAnswer(input) {
      const prepared = prepareInput(input);
      if (
        prepared.excludedCategory ||
        !("intent" in prepared) ||
        !("sources" in prepared) ||
        !("providerInput" in prepared) ||
        CANONICAL_INTENTS.has(prepared.intent) ||
        prepared.sources.length === 0 ||
        typeof provider.stream !== "function"
      ) {
        return null;
      }
      return {
        intent: prepared.intent,
        sources: prepared.sources,
        providerInput: prepared.providerInput,
        aiMode,
        providerId,
      };
    },

    /**
     * Produce a deterministic, source-validated answer after a live provider
     * stream cannot start or cannot finish safely.
     *
     * @param {{message: string, history?: Array<{role: "user" | "assistant", content: string}>}} input
     * @param {string | null} reason
     */
    async retrievalFallback(input, reason = "provider-unavailable") {
      return renderRetrievalFallback(prepareInput(input), reason);
    },

    /**
     * @param {{message: string, history?: Array<{role: "user" | "assistant", content: string}>}} input
     */
    async answer(input) {
      const prepared = prepareInput(input);
      if (prepared.excludedCategory) {
        return {
          answer: INDEXED_SCOPE_RESPONSE,
          sources: [],
          sourceIds: [],
          mode: "scope-policy",
          aiMode,
          providerId,
          intent: QUERY_INTENTS.SCOPE,
          excludedCategory: prepared.excludedCategory,
          fallbackUsed: false,
          fallbackReason: null,
        };
      }

      const { intent, sources, providerInput } = prepared;

      if (CANONICAL_INTENTS.has(intent) || sources.length === 0) {
        const output = await fallback.generate(providerInput);
        const validated = validateProviderOutput(output, sources, {
          baseOrigin: options.baseOrigin,
          allowSourceLessAbstention: true,
        });
        if (!validated.ok) {
          return {
            answer:
              "The indexed source record could not be validated. Browse the verified project catalogue while the index is refreshed.",
            sources: [],
            sourceIds: [],
            mode: "retrieval-only",
            aiMode,
            providerId,
            intent,
            excludedCategory: null,
            fallbackUsed: false,
            fallbackReason: null,
          };
        }
        return {
          answer: validated.answer,
          sources: usedSources(sources, validated.sourceIds),
          sourceIds: validated.sourceIds,
          mode: CANONICAL_INTENTS.has(intent) ? "canonical" : "retrieval-only",
          aiMode,
          providerId,
          intent,
          excludedCategory: null,
          fallbackUsed: false,
          fallbackReason: null,
        };
      }

      let providerOutput;
      let mode = providerId;
      let fallbackUsed = false;
      let fallbackReason = null;
      try {
        providerOutput = await provider.generate(providerInput);
      } catch (error) {
        providerOutput = await fallback.generate(providerInput);
        mode = fallback.id;
        fallbackUsed = true;
        fallbackReason = providerFallbackReason(error);
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
        fallbackUsed = providerId !== fallback.id;
        fallbackReason = !validated.ok
          ? "fallback-validation-failed"
          : "invalid-provider-output";
      }

      if (!validated.ok) {
        return {
          answer:
            "The retrieved records could not be rendered safely. Browse the cited project catalogue while the index is refreshed.",
          sources: [],
          sourceIds: [],
          mode: fallback.id,
          aiMode,
          providerId,
          intent,
          excludedCategory: null,
          fallbackUsed: true,
          fallbackReason: "fallback-validation-failed",
        };
      }

      return {
        answer: validated.answer,
        sources: usedSources(sources, validated.sourceIds),
        sourceIds: validated.sourceIds,
        mode,
        aiMode,
        providerId,
        intent,
        excludedCategory: null,
        fallbackUsed,
        fallbackReason,
      };
    },
  };
}
