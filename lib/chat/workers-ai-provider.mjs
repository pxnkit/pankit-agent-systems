import { citedSourceIds } from "../source-validation.mjs";

/** @param {unknown} result */
function responseText(result) {
  if (typeof result === "string") return result;
  if (!result || typeof result !== "object" || Array.isArray(result)) return "";
  if (typeof result.response === "string") return result.response;
  if (
    result.result &&
    typeof result.result === "object" &&
    typeof result.result.response === "string"
  ) {
    return result.result.response;
  }
  return "";
}

export class WorkersAiProvider {
  /**
   * @param {{run(model: string, inputs: Record<string, unknown>, options?: Record<string, unknown>): Promise<unknown>}} binding
   * @param {string} model
   */
  constructor(binding, model) {
    this.id = "workers-ai";
    this.binding = binding;
    this.model = model;
  }

  /**
   * @param {{
   *   message: string,
   *   history: Array<{role: "user" | "assistant", content: string}>,
   *   systemPrompt: string
   * }} input
   */
  async generate(input) {
    const result = await this.binding.run(this.model, {
      messages: [
        { role: "system", content: input.systemPrompt },
        ...input.history.slice(-6),
        { role: "user", content: input.message },
      ],
      max_tokens: 520,
      temperature: 0.1,
    });
    const answer = responseText(result).trim();
    if (!answer)
      throw new Error("The chat provider returned an empty response.");
    return {
      answer,
      sourceIds: citedSourceIds(answer),
    };
  }
}
