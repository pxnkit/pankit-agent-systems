export const CHAT_INPUT_LIMITS = Object.freeze({
  bodyBytes: 16_384,
  messageCharacters: 2_000,
  historyItems: 8,
  historyCharacters: 6_000,
  turnstileTokenCharacters: 2_048,
});

/** @param {unknown} value */
function isRecord(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

/** @param {string} value */
function normalizeText(value) {
  return value
    .normalize("NFC")
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "")
    .replace(/\r\n?/g, "\n")
    .trim();
}

/**
 * @param {unknown} payload
 */
export function validateChatPayload(payload) {
  if (!isRecord(payload)) {
    return { ok: false, error: "Request body must be a JSON object." };
  }
  const value = /** @type {Record<string, unknown>} */ (payload);
  if (typeof value.message !== "string") {
    return { ok: false, error: "message must be a string." };
  }
  const message = normalizeText(value.message);
  if (!message) return { ok: false, error: "message is required." };
  if (message.length > CHAT_INPUT_LIMITS.messageCharacters) {
    return {
      ok: false,
      error: `message must be at most ${CHAT_INPUT_LIMITS.messageCharacters} characters.`,
    };
  }

  const historyInput = value.history ?? [];
  if (
    !Array.isArray(historyInput) ||
    historyInput.length > CHAT_INPUT_LIMITS.historyItems
  ) {
    return {
      ok: false,
      error: `history must contain at most ${CHAT_INPUT_LIMITS.historyItems} messages.`,
    };
  }
  const history = [];
  let historyCharacters = 0;
  for (const [index, entry] of historyInput.entries()) {
    if (!isRecord(entry)) {
      return { ok: false, error: `history[${index}] must be an object.` };
    }
    const role = entry.role;
    const content = entry.content;
    if (
      (role !== "user" && role !== "assistant") ||
      typeof content !== "string"
    ) {
      return {
        ok: false,
        error: `history[${index}] must have a user or assistant role and string content.`,
      };
    }
    const normalized = normalizeText(content);
    if (!normalized) continue;
    historyCharacters += normalized.length;
    history.push({ role, content: normalized });
  }
  if (historyCharacters > CHAT_INPUT_LIMITS.historyCharacters) {
    return {
      ok: false,
      error: `history must be at most ${CHAT_INPUT_LIMITS.historyCharacters} characters.`,
    };
  }

  let turnstileToken;
  if (value.turnstileToken !== undefined) {
    if (
      typeof value.turnstileToken !== "string" ||
      value.turnstileToken.length > CHAT_INPUT_LIMITS.turnstileTokenCharacters
    ) {
      return { ok: false, error: "turnstileToken is invalid." };
    }
    turnstileToken = value.turnstileToken.trim();
  }

  return {
    ok: true,
    value: {
      message,
      history,
      ...(turnstileToken ? { turnstileToken } : {}),
    },
  };
}

/**
 * Read a request body with a hard byte cap even when Content-Length is absent.
 *
 * @param {Request} request
 * @param {number} [maximumBytes]
 */
export async function readLimitedText(
  request,
  maximumBytes = CHAT_INPUT_LIMITS.bodyBytes,
) {
  const declaredLength = Number(request.headers.get("content-length") ?? 0);
  if (Number.isFinite(declaredLength) && declaredLength > maximumBytes) {
    throw new RangeError("Request body is too large.");
  }
  if (!request.body) return "";

  const reader = request.body.getReader();
  const chunks = [];
  let bytes = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    bytes += value.byteLength;
    if (bytes > maximumBytes) {
      await reader.cancel("Request body is too large.");
      throw new RangeError("Request body is too large.");
    }
    chunks.push(value);
  }

  const joined = new Uint8Array(bytes);
  let offset = 0;
  for (const chunk of chunks) {
    joined.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return new TextDecoder("utf-8", { fatal: true }).decode(joined);
}

/** @param {Request} request */
export async function parseChatRequest(request) {
  const contentType = request.headers
    .get("content-type")
    ?.split(";", 1)[0]
    .trim();
  if (contentType !== "application/json") {
    return {
      ok: false,
      status: 415,
      error: "Content-Type must be application/json.",
    };
  }
  try {
    const text = await readLimitedText(request);
    const result = validateChatPayload(JSON.parse(text));
    return result.ok ? { ...result, status: 200 } : { ...result, status: 400 };
  } catch (error) {
    return {
      ok: false,
      status: error instanceof RangeError ? 413 : 400,
      error:
        error instanceof RangeError
          ? "Request body is too large."
          : "Request body must contain valid JSON.",
    };
  }
}
