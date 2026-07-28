import {
  createChatService,
  providerFallbackReason,
} from "../../../lib/chat/chat-service.mjs";
import {
  answerDeltas,
  encodeSseEvent,
  sseStream,
} from "../../../lib/chat/ndjson.mjs";
import { selectChatProvider } from "../../../lib/chat/provider.mjs";
import { workersAiTextDeltas } from "../../../lib/chat/workers-ai-provider.mjs";
import { containsExcludedSourceContent } from "../../../lib/content-policy.mjs";
import { getPortfolioRuntimeData } from "../../../lib/portfolio-data";
import { QUERY_INTENTS, classifyQueryIntent } from "../../../lib/retrieval.mjs";
import {
  getChatRuntimeConfig,
  getPortfolioRuntimeBindings,
} from "../../../lib/runtime-env";
import {
  getClientIp,
  hashIpAddress,
  hashRateLimitIdentifier,
} from "../../../lib/security/ip-hash.mjs";
import { checkSameOrigin } from "../../../lib/security/origin.mjs";
import {
  checkRateLimit,
  rateLimitHeaders,
} from "../../../lib/security/rate-limit.mjs";
import { parseChatRequest } from "../../../lib/security/input-validation.mjs";
import { verifyTurnstile } from "../../../lib/security/turnstile.mjs";
import { validateProviderOutput } from "../../../lib/source-validation.mjs";

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

function fallbackMessage(reason: string | null) {
  if (reason === "provider-quota-or-capacity") {
    return "Generated answers are temporarily unavailable. Here are the most relevant verified portfolio sources.";
  }
  if (reason === "provider-timeout") {
    return "Generated synthesis timed out. Here are the most relevant verified portfolio sources.";
  }
  return "Generated synthesis is temporarily unavailable. Here are the most relevant verified portfolio sources.";
}

type StreamSource = {
  id: string;
  title?: string;
  excerpt?: string;
  internalUrl?: string;
  projectSlug?: string;
  type?: string;
  url?: string;
};

function liveAnswerStream(options: {
  providerStream: ReadableStream<Uint8Array>;
  requestSignal: AbortSignal;
  requestId: string;
  aiMode: string;
  intent: string;
  sources: StreamSource[];
  baseOrigin: string;
  fallback: (reason: string) => Promise<{
    answer: string;
    sources: StreamSource[];
  }>;
}) {
  const encoder = new TextEncoder();
  return new ReadableStream<Uint8Array>({
    async start(controller) {
      const emit = (event: Record<string, unknown>) => {
        controller.enqueue(encoder.encode(encodeSseEvent(event)));
      };
      emit({
        type: "metadata",
        requestId: options.requestId,
        aiMode: options.aiMode,
        responseMode: "cloudflare",
        intent: options.intent,
        sourceCount: options.sources.length,
      });
      emit({ type: "source-list", sources: options.sources });

      let pending = "";
      let releasedSegments = 0;
      try {
        for await (const delta of workersAiTextDeltas(options.providerStream, {
          signal: options.requestSignal,
        })) {
          pending += delta;
          while (true) {
            const citation =
              /\[source:[A-Za-z0-9][A-Za-z0-9._:/-]{0,159}\]/.exec(pending);
            if (!citation) break;
            const end = citation.index + citation[0].length;
            const segment = pending.slice(0, end);
            const validated = validateProviderOutput(
              { answer: segment },
              options.sources,
              { baseOrigin: options.baseOrigin },
            );
            if (
              !validated.ok ||
              containsExcludedSourceContent(validated.answer)
            ) {
              throw new Error(
                `The streamed answer failed grounding validation: ${validated.reason ?? "excluded-content"}.`,
              );
            }
            const separator =
              releasedSegments > 0
                ? /^\s*\n/.test(segment)
                  ? "\n\n"
                  : /^\s/.test(segment)
                    ? " "
                    : ""
                : "";
            emit({
              type: "text-delta",
              text: `${separator}${validated.answer}`,
            });
            releasedSegments += 1;
            pending = pending.slice(end);
          }
        }

        if (pending.trim()) {
          if (/^[\s.,;:!?()[\]'"-]+$/.test(pending)) {
            emit({ type: "text-delta", text: pending });
          } else {
            const validated = validateProviderOutput(
              { answer: pending },
              options.sources,
              { baseOrigin: options.baseOrigin },
            );
            if (
              !validated.ok ||
              containsExcludedSourceContent(validated.answer)
            ) {
              throw new Error(
                `The streamed answer ended without valid grounding: ${validated.reason ?? "excluded-content"}.`,
              );
            }
            emit({ type: "text-delta", text: validated.answer });
            releasedSegments += 1;
          }
        }
        if (releasedSegments === 0) {
          throw new Error("Workers AI returned no grounded answer text.");
        }
        emit({
          type: "completion",
          requestId: options.requestId,
          status: "complete",
        });
      } catch (error) {
        if (options.requestSignal.aborted) {
          return;
        }
        const reason = providerFallbackReason(error);
        const fallback = await options.fallback(reason);
        emit({
          type: "fallback",
          reason,
          message: fallbackMessage(reason),
          responseMode: "retrieval-only",
        });
        emit({ type: "source-list", sources: fallback.sources });
        for (const text of answerDeltas(fallback.answer)) {
          emit({ type: "text-delta", text });
        }
        emit({
          type: "completion",
          requestId: options.requestId,
          status: "complete",
        });
      } finally {
        controller.close();
      }
    },
  });
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

  const data = getPortfolioRuntimeData();
  const intent = classifyQueryIntent(payload.message, {
    projects: data.projects,
    rankedProjects: data.rankedProjects,
  });
  const generationRequested =
    intent === QUERY_INTENTS.UNKNOWN &&
    runtimeConfig.aiMode !== "retrieval-only";
  let generationFallback: { reason: string; message: string } | undefined;

  if (generationRequested) {
    const sessionIdentifier = `${payload.sessionId ?? "anonymous-session"}:${ipKey}`;
    const sessionKey = await hashRateLimitIdentifier(
      sessionIdentifier,
      runtimeConfig.ipHashSalt,
      "browser-session",
    );
    const sessionQuota = await checkRateLimit({
      key: `session:${sessionKey}`,
      limit: runtimeConfig.maximumSessionAnswers,
      windowMs: 86_400_000,
      store: runtimeConfig.rateLimitStore,
    });

    if (!sessionQuota.allowed) {
      generationFallback = {
        reason: "session-generation-limit",
        message:
          "This browser session has reached today’s generated-answer limit. Here are the most relevant verified portfolio sources.",
      };
    } else if (sessionQuota.count > 3 && !runtimeConfig.turnstilePairingOk) {
      generationFallback = {
        reason: "human-verification-unavailable",
        message:
          "Generated chat verification is temporarily unavailable. Here are the most relevant verified portfolio sources.",
      };
    } else if (sessionQuota.count > 3 && runtimeConfig.turnstileSecret) {
      const challenge = await verifyTurnstile({
        secret: runtimeConfig.turnstileSecret,
        token: payload.turnstileToken,
        remoteIp: clientIp,
        expectedAction: "portfolio-chat",
        expectedHostname: new URL(request.url).hostname,
      });
      if (!challenge.ok) {
        generationFallback = {
          reason: "human-verification-required",
          message:
            "Generated chat needs human verification. Here are the most relevant verified portfolio sources.",
        };
      }
    }
  }

  const provider = selectChatProvider({
    ai: runtimeConfig.ai,
    aiMode: generationFallback ? "retrieval-only" : runtimeConfig.aiMode,
    enableEconomyRouting: runtimeConfig.economyRoutingEnabled,
  });
  if (
    generationRequested &&
    !generationFallback &&
    provider.configured === false
  ) {
    generationFallback = {
      reason: "provider-not-configured",
      message:
        "Generated synthesis is temporarily unavailable. Here are the most relevant verified portfolio sources.",
    };
  }
  const service = createChatService({
    projects: data.projects,
    rankedProjects: data.rankedProjects,
    knowledgeEnvelope: data.knowledgeEnvelope,
    sourceManifest: data.sourceManifest,
    chunks: data.chunks,
    provider,
    baseOrigin: new URL(request.url).origin,
  });
  const requestId = crypto.randomUUID();
  const streamingPlan = generationFallback
    ? null
    : service.prepareStreamingAnswer(payload);
  if (
    streamingPlan &&
    "stream" in provider &&
    typeof provider.stream === "function"
  ) {
    try {
      const live = await provider.stream(streamingPlan.providerInput);
      return new Response(
        liveAnswerStream({
          providerStream: live.stream as ReadableStream<Uint8Array>,
          requestSignal: request.signal,
          requestId,
          aiMode: streamingPlan.aiMode,
          intent: streamingPlan.intent,
          sources: streamingPlan.sources,
          baseOrigin: new URL(request.url).origin,
          fallback: async (reason) =>
            service.retrievalFallback(payload, reason),
        }),
        {
          status: 200,
          headers: {
            ...SECURITY_HEADERS,
            ...limitHeaders,
            "Content-Type": "text/event-stream; charset=utf-8",
            "X-Request-Id": requestId,
            "X-Accel-Buffering": "no",
          },
        },
      );
    } catch (error) {
      const reason = providerFallbackReason(error);
      generationFallback = {
        reason,
        message: fallbackMessage(reason),
      };
    }
  }
  let events: Array<Record<string, unknown>>;
  try {
    const result = generationFallback
      ? await service.retrievalFallback(payload, generationFallback.reason)
      : await service.answer(payload);
    const fallback = generationFallback
      ? {
          reason: generationFallback.reason,
          message: generationFallback.message,
        }
      : result.fallbackUsed
        ? {
            reason: result.fallbackReason,
            message: fallbackMessage(result.fallbackReason),
          }
        : null;
    events = [
      {
        type: "metadata",
        requestId,
        aiMode: result.aiMode,
        responseMode: result.mode,
        intent: result.intent,
        sourceCount: result.sources.length,
      },
      ...(fallback
        ? [
            {
              type: "fallback",
              reason: fallback.reason,
              message: fallback.message,
              responseMode: result.mode,
            },
          ]
        : []),
      { type: "source-list", sources: result.sources },
      ...answerDeltas(result.answer).map((text) => ({
        type: "text-delta",
        text,
      })),
      { type: "completion", requestId, status: "complete" },
    ];
  } catch {
    events = [
      {
        type: "metadata",
        requestId,
        aiMode: runtimeConfig.aiMode,
        responseMode: "error",
        sourceCount: 0,
      },
      {
        type: "error",
        code: "chat-unavailable",
        message:
          "The chat answer could not be completed. The verified portfolio remains available.",
      },
    ];
  }

  return new Response(sseStream(events), {
    status: 200,
    headers: {
      ...SECURITY_HEADERS,
      ...limitHeaders,
      "Content-Type": "text/event-stream; charset=utf-8",
      "X-Request-Id": requestId,
      "X-Accel-Buffering": "no",
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
