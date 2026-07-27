import { RetrievalOnlyProvider } from "./retrieval-only-provider.mjs";

/**
 * Deterministic test/demo mode. It exercises the complete chat pipeline while
 * staying grounded in the same retrieved sources as production.
 */
export class DeterministicMockProvider {
  constructor() {
    this.id = "deterministic-mock";
    this.fallback = new RetrievalOnlyProvider();
  }

  /**
   * @param {Parameters<RetrievalOnlyProvider["generate"]>[0]} input
   */
  async generate(input) {
    const result = await this.fallback.generate(input);
    if (input.sources.length === 0) return result;
    return {
      ...result,
      answer: `From Pankit’s indexed project records:\n${result.answer}`,
    };
  }
}
