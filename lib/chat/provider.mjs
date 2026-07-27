import { DeterministicMockProvider } from "./deterministic-mock-provider.mjs";
import { RetrievalOnlyProvider } from "./retrieval-only-provider.mjs";
import { WorkersAiProvider } from "./workers-ai-provider.mjs";

/** @param {unknown} value */
export function isEnabledFlag(value) {
  return typeof value === "string"
    ? ["1", "true", "yes", "on"].includes(value.trim().toLowerCase())
    : value === true;
}

/**
 * @param {{
 *   mockMode?: unknown,
 *   ai?: {run(model: string, inputs: Record<string, unknown>, options?: Record<string, unknown>): Promise<unknown>},
 *   model?: string
 * }} config
 */
export function selectChatProvider(config = {}) {
  if (isEnabledFlag(config.mockMode)) return new DeterministicMockProvider();
  if (config.ai && typeof config.model === "string" && config.model.trim()) {
    return new WorkersAiProvider(config.ai, config.model.trim());
  }
  return new RetrievalOnlyProvider();
}
