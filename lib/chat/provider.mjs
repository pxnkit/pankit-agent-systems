import { DeterministicMockProvider } from "./deterministic-mock-provider.mjs";
import { RetrievalOnlyProvider } from "./retrieval-only-provider.mjs";
import {
  CLOUDFLARE_MODELS,
  WorkersAiProvider,
} from "./workers-ai-provider.mjs";

export const AI_MODES = Object.freeze({
  CLOUDFLARE: "cloudflare",
  MOCK: "mock",
  RETRIEVAL_ONLY: "retrieval-only",
});

/** @param {unknown} value */
export function isEnabledFlag(value) {
  return typeof value === "string"
    ? ["1", "true", "yes", "on"].includes(value.trim().toLowerCase())
    : value === true;
}

/** @param {{aiMode?: unknown, mode?: unknown, mockMode?: unknown, ai?: unknown}} config */
export function resolveAiMode(config = {}) {
  const explicit = String(config.aiMode ?? config.mode ?? "")
    .trim()
    .toLowerCase();
  if (Object.values(AI_MODES).includes(explicit)) return explicit;
  if (explicit) return AI_MODES.RETRIEVAL_ONLY;
  if (isEnabledFlag(config.mockMode)) return AI_MODES.MOCK;
  return config.ai ? AI_MODES.CLOUDFLARE : AI_MODES.RETRIEVAL_ONLY;
}

/**
 * @param {{
 *   aiMode?: unknown,
 *   mode?: unknown,
 *   mockMode?: unknown,
 *   ai?: {run(model: string, inputs: Record<string, unknown>, options?: Record<string, unknown>): Promise<unknown>},
 *   enableEconomyRouting?: unknown
 * }} config
 */
export function selectChatProvider(config = {}) {
  const requestedMode = resolveAiMode(config);
  if (requestedMode === AI_MODES.MOCK) {
    return new DeterministicMockProvider();
  }
  if (requestedMode === AI_MODES.CLOUDFLARE) {
    if (config.ai && typeof config.ai.run === "function") {
      return new WorkersAiProvider(config.ai, {
        enableEconomyRouting: isEnabledFlag(config.enableEconomyRouting),
      });
    }
    const fallback = new RetrievalOnlyProvider();
    fallback.aiMode = AI_MODES.CLOUDFLARE;
    fallback.configured = false;
    fallback.configurationIssue = "missing-ai-binding";
    fallback.primaryModel = CLOUDFLARE_MODELS.primary;
    return fallback;
  }
  return new RetrievalOnlyProvider();
}

export { CLOUDFLARE_MODELS };
