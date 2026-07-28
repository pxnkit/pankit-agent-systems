import { citedSourceIds } from "../source-validation.mjs";

export const CLOUDFLARE_MODELS = Object.freeze({
  primary: "@cf/zai-org/glm-4.7-flash",
  economy: "@cf/ibm-granite/granite-4.0-h-micro",
  challenger: "@cf/qwen/qwen3-30b-a3b-fp8",
});

/** @param {unknown} result */
function responseText(result) {
  if (typeof result === "string") return result;
  if (!result || typeof result !== "object" || Array.isArray(result)) return "";
  if (typeof result.response === "string") return result.response;
  if (typeof result.output_text === "string") return result.output_text;
  if (
    result.result &&
    typeof result.result === "object" &&
    typeof result.result.response === "string"
  ) {
    return result.result.response;
  }
  if (
    Array.isArray(result.choices) &&
    result.choices[0] &&
    typeof result.choices[0] === "object" &&
    result.choices[0].message &&
    typeof result.choices[0].message === "object" &&
    typeof result.choices[0].message.content === "string"
  ) {
    return result.choices[0].message.content;
  }
  return "";
}

/** @param {unknown} payload */
export function streamedResponseText(payload) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return "";
  }
  if (typeof payload.response === "string") return payload.response;
  if (typeof payload.output_text === "string") return payload.output_text;
  if (
    Array.isArray(payload.choices) &&
    payload.choices[0] &&
    typeof payload.choices[0] === "object"
  ) {
    const choice = payload.choices[0];
    if (
      choice.delta &&
      typeof choice.delta === "object" &&
      typeof choice.delta.content === "string"
    ) {
      return choice.delta.content;
    }
    if (typeof choice.text === "string") return choice.text;
  }
  if (
    payload.delta &&
    typeof payload.delta === "object" &&
    typeof payload.delta.content === "string"
  ) {
    return payload.delta.content;
  }
  return "";
}

/** @param {string} frame */
function parseSseFrame(frame) {
  const data = frame
    .split(/\r?\n/)
    .filter((line) => line.startsWith("data:"))
    .map((line) => line.slice(5).trim())
    .join("\n");
  if (!data || data === "[DONE]") return null;
  try {
    return JSON.parse(data);
  } catch {
    throw new Error("Workers AI returned an invalid stream event.");
  }
}

/**
 * Convert the Workers AI SSE wire stream into actual model text deltas.
 *
 * @param {ReadableStream<Uint8Array>} stream
 * @param {{signal?: AbortSignal}} [options]
 */
export async function* workersAiTextDeltas(stream, options = {}) {
  if (!stream || typeof stream.getReader !== "function") {
    throw new Error("Workers AI did not return a readable stream.");
  }
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  let pending = "";
  let aggregate = "";
  const abort = () => {
    void reader.cancel("Client disconnected.");
  };
  options.signal?.addEventListener("abort", abort, { once: true });

  const emitPayload = (payload) => {
    const text = streamedResponseText(payload);
    if (!text) return "";
    if (aggregate && text.startsWith(aggregate)) {
      const delta = text.slice(aggregate.length);
      aggregate = text;
      return delta;
    }
    aggregate += text;
    return text;
  };

  try {
    while (true) {
      if (options.signal?.aborted) {
        throw new DOMException("The request was aborted.", "AbortError");
      }
      const { value, done } = await reader.read();
      if (done) break;
      pending += decoder.decode(value, { stream: true });
      const frames = pending.split(/\r?\n\r?\n/);
      pending = frames.pop() ?? "";
      for (const frame of frames) {
        const payload = parseSseFrame(frame);
        if (!payload) continue;
        const delta = emitPayload(payload);
        if (delta) yield delta;
      }
    }

    pending += decoder.decode();
    if (pending.trim()) {
      const payload = parseSseFrame(pending);
      if (payload) {
        const delta = emitPayload(payload);
        if (delta) yield delta;
      }
    }
  } finally {
    options.signal?.removeEventListener("abort", abort);
    reader.releaseLock();
  }
}

export class WorkersAiProvider {
  /**
   * @param {{run(model: string, inputs: Record<string, unknown>, options?: Record<string, unknown>): Promise<unknown>}} binding
   * @param {{enableEconomyRouting?: boolean} | string} [options]
   */
  constructor(binding, options = {}) {
    this.id = "cloudflare";
    this.aiMode = "cloudflare";
    this.configured = Boolean(binding && typeof binding.run === "function");
    this.binding = binding;
    this.primaryModel = CLOUDFLARE_MODELS.primary;
    this.economyModel = CLOUDFLARE_MODELS.economy;
    this.enableEconomyRouting =
      typeof options === "object" && options !== null
        ? options.enableEconomyRouting === true
        : false;
  }

  /**
   * @param {{
   *   message: string,
   *   history: Array<{role: "user" | "assistant", content: string}>,
   *   systemPrompt: string
   * }} input
   */
  async generate(input) {
    if (!this.configured) {
      throw new Error("Cloudflare Workers AI is not configured.");
    }
    const request = {
      messages: [
        { role: "system", content: input.systemPrompt },
        ...input.history.slice(-6),
        { role: "user", content: input.message },
      ],
      max_tokens: 520,
      temperature: 0.1,
    };

    let result;
    let route = "primary";
    try {
      result = await this.binding.run(this.primaryModel, request);
    } catch (primaryError) {
      if (!this.enableEconomyRouting) throw primaryError;
      route = "economy";
      result = await this.binding.run(this.economyModel, request);
    }

    const answer = responseText(result).trim();
    if (!answer) {
      throw new Error("The chat provider returned an empty response.");
    }
    return {
      answer,
      sourceIds: citedSourceIds(answer),
      route,
    };
  }

  /**
   * Start a real Workers AI token stream. The caller must validate grounding
   * before releasing any buffered factual segment to the browser.
   *
   * @param {{
   *   message: string,
   *   history: Array<{role: "user" | "assistant", content: string}>,
   *   systemPrompt: string
   * }} input
   */
  async stream(input) {
    if (!this.configured) {
      throw new Error("Cloudflare Workers AI is not configured.");
    }
    const request = {
      messages: [
        { role: "system", content: input.systemPrompt },
        ...input.history.slice(-6),
        { role: "user", content: input.message },
      ],
      max_tokens: 520,
      temperature: 0.1,
      stream: true,
    };

    let result;
    let route = "primary";
    try {
      result = await this.binding.run(this.primaryModel, request);
    } catch (primaryError) {
      if (!this.enableEconomyRouting) throw primaryError;
      route = "economy";
      result = await this.binding.run(this.economyModel, request);
    }
    if (!result || typeof result.getReader !== "function") {
      throw new Error("Workers AI did not return a readable stream.");
    }
    return { stream: result, route };
  }
}
