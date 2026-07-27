import { env as cloudflareEnv } from "cloudflare:workers";

export interface PortfolioRuntimeBindings {
  AI?: {
    run(
      model: string,
      inputs: Record<string, unknown>,
      options?: Record<string, unknown>,
    ): Promise<unknown>;
  };
  RATE_LIMIT_KV?: {
    get(key: string): Promise<string | null>;
    put(
      key: string,
      value: string,
      options?: Record<string, unknown>,
    ): Promise<void>;
  };
  AI_MODEL?: string;
  CHAT_MOCK_MODE?: string;
  RATE_LIMIT_MAX_REQUESTS?: string;
  RATE_LIMIT_WINDOW_SECONDS?: string;
  TURNSTILE_SECRET_KEY?: string;
  IP_HASH_SALT?: string;
  NEXT_PUBLIC_SITE_URL?: string;
}

export async function getPortfolioRuntimeBindings(): Promise<PortfolioRuntimeBindings> {
  return (cloudflareEnv ?? {}) as PortfolioRuntimeBindings;
}

function integerSetting(
  value: unknown,
  fallback: number,
  minimum: number,
  maximum: number,
) {
  const parsed = Number.parseInt(String(value ?? ""), 10);
  return Number.isFinite(parsed)
    ? Math.max(minimum, Math.min(maximum, parsed))
    : fallback;
}

/**
 * All secrets and provider bindings are read in a server-only module. The
 * returned public mode label never contains a model identifier or credential.
 */
export function getChatRuntimeConfig(workerEnv: PortfolioRuntimeBindings = {}) {
  const processEnv: Record<string, string | undefined> =
    typeof process === "undefined" ? {} : process.env;
  const turnstileSecret =
    workerEnv.TURNSTILE_SECRET_KEY || processEnv.TURNSTILE_SECRET_KEY;

  return {
    ai: workerEnv.AI,
    model: workerEnv.AI_MODEL || processEnv.AI_MODEL,
    mockMode: workerEnv.CHAT_MOCK_MODE || processEnv.CHAT_MOCK_MODE,
    rateLimitStore: workerEnv.RATE_LIMIT_KV,
    rateLimitMax: integerSetting(
      workerEnv.RATE_LIMIT_MAX_REQUESTS || processEnv.RATE_LIMIT_MAX_REQUESTS,
      12,
      1,
      1_000,
    ),
    rateLimitWindowMs:
      integerSetting(
        workerEnv.RATE_LIMIT_WINDOW_SECONDS ||
          processEnv.RATE_LIMIT_WINDOW_SECONDS,
        60,
        1,
        86_400,
      ) * 1_000,
    turnstileSecret,
    ipHashSalt:
      workerEnv.IP_HASH_SALT ||
      processEnv.IP_HASH_SALT ||
      turnstileSecret ||
      "portfolio-local-rate-limit-v1",
    siteUrl: workerEnv.NEXT_PUBLIC_SITE_URL || processEnv.NEXT_PUBLIC_SITE_URL,
  };
}
