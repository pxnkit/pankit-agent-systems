import { createChatService } from "../../../lib/chat/chat-service.mjs";
import { answerDeltas, ndjsonStream } from "../../../lib/chat/ndjson.mjs";
import { selectChatProvider } from "../../../lib/chat/provider.mjs";
import { getPortfolioRuntimeData } from "../../../lib/portfolio-data";
import {
  getChatRuntimeConfig,
  getPortfolioRuntimeBindings,
} from "../../../lib/runtime-env";
import { getClientIp, hashIpAddress } from "../../../lib/security/ip-hash.mjs";
import { checkSameOrigin } from "../../../lib/security/origin.mjs";
import {
  checkRateLimit,
  rateLimitHeaders,
} from "../../../lib/security/rate-limit.mjs";
import { parseChatRequest } from "../../../lib/security/input-validation.mjs";
import { verifyTurnstile } from "../../../lib/security/turnstile.mjs";

export const runtime = "edge";

const SECURITY_HEADERS = {
  "Cache-Control": "no-store, max-age=0",
  "Referrer-Policy": "no-referrer",
  "X-Content-Type-Options": "nosniff",
};

function errorResponse(
  message: string,
  status: number,
  headers: HeadersInit = {},
) {
  return Response.json(
    { error: message },
    {
      status,
      headers: { ...SECURITY_HEADERS, ...headers },
    },
  );
}

export async function POST(request: Request) {
  const runtimeConfig = getChatRuntimeConfig(
    await getPortfolioRuntimeBindings(),
  );
  const originCheck = checkSameOrigin(request, {
    allowedOrigins: runtimeConfig.siteUrl ? [runtimeConfig.siteUrl] : [],
  });
  if (!originCheck.ok) {
    return errorResponse("Cross-origin chat requests are not allowed.", 403);
  }

  const parsed = await parseChatRequest(request);
  if (parsed.ok !== true || !("value" in parsed)) {
    return errorResponse(
      parsed.error ?? "Invalid chat request.",
      parsed.status ?? 400,
    );
  }
  const payload = parsed.value;

  const clientIp = getClientIp(request.headers);
  const ipKey = await hashIpAddress(clientIp, runtimeConfig.ipHashSalt);
  const rateLimit = await checkRateLimit({
    key: ipKey,
    limit: runtimeConfig.rateLimitMax,
    windowMs: runtimeConfig.rateLimitWindowMs,
    store: runtimeConfig.rateLimitStore,
  });
  const limitHeaders = rateLimitHeaders(rateLimit);
  if (!rateLimit.allowed) {
    return errorResponse(
      "Too many chat requests. Please try again shortly.",
      429,
      limitHeaders,
    );
  }

  const challenge = await verifyTurnstile({
    secret: runtimeConfig.turnstileSecret,
    token: payload.turnstileToken,
    remoteIp: clientIp,
    expectedAction: "portfolio-chat",
    expectedHostname: new URL(request.url).hostname,
  });
  if (!challenge.ok) {
    return errorResponse(
      "Human verification was not accepted.",
      403,
      limitHeaders,
    );
  }

  const data = getPortfolioRuntimeData();
  const provider = selectChatProvider({
    ai: runtimeConfig.ai,
    model: runtimeConfig.model,
    mockMode: runtimeConfig.mockMode,
  });
  const service = createChatService({
    projects: data.projects,
    rankedProjects: data.rankedProjects,
    knowledgeEnvelope: data.knowledgeEnvelope,
    provider,
    baseOrigin: new URL(request.url).origin,
  });
  const result = await service.answer(payload);
  const requestId = crypto.randomUUID();
  const events: Array<Record<string, unknown>> = [
    { type: "meta", requestId, mode: result.mode },
    ...answerDeltas(result.answer).map((text) => ({ type: "delta", text })),
    { type: "sources", sources: result.sources },
    { type: "done" },
  ];

  return new Response(ndjsonStream(events), {
    status: 200,
    headers: {
      ...SECURITY_HEADERS,
      ...limitHeaders,
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "X-Request-Id": requestId,
    },
  });
}

export function OPTIONS() {
  return new Response(null, {
    status: 204,
    headers: {
      ...SECURITY_HEADERS,
      Allow: "POST, OPTIONS",
    },
  });
}
