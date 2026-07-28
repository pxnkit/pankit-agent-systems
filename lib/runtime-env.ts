import { getCloudflareContext } from "@opennextjs/cloudflare";

export interface PortfolioAiBinding {
  run(
    model: string,
    inputs: Record<string, unknown>,
    options?: Record<string, unknown>,
  ): Promise<unknown>;
}

export interface PortfolioRateLimitKv {
  get(key: string): Promise<string | null>;
  put(
    key: string,
    value: string,
    options?: Record<string, unknown>,
  ): Promise<void>;
}

export interface PortfolioRuntimeBindings {
  AI?: PortfolioAiBinding;
  RATE_LIMIT_KV?: PortfolioRateLimitKv;
  GITHUB_USERNAME?: string;
  GITHUB_TOKEN?: string;
  AI_MODE?: string;
  AI_MODEL_PRIMARY?: string;
  AI_MODEL_ECONOMY?: string;
  AI_MODEL_CHALLENGER?: string;
  ENABLE_ECONOMY_ROUTING?: string;
  TURNSTILE_SECRET_KEY?: string;
  RATE_LIMIT_SALT?: string;
  MAX_SESSION_GENERATED_ANSWERS?: string;
  MAX_QUESTION_CHARACTERS?: string;
  NEXT_PUBLIC_SITE_URL?: string;
  NEXT_PUBLIC_TURNSTILE_SITE_KEY?: string;
}

function processBindings(): PortfolioRuntimeBindings {
  if (typeof process === "undefined") return {};
  return process.env as PortfolioRuntimeBindings;
}

const PUBLIC_TURNSTILE_SITE_KEY =
  typeof process === "undefined"
    ? ""
    : (process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY?.trim() ?? "");

export async function getPortfolioRuntimeBindings(): Promise<PortfolioRuntimeBindings> {
  try {
    return getCloudflareContext().env as PortfolioRuntimeBindings;
  } catch {
    return processBindings();
  }
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

function normalizedAiMode(value: unknown) {
  const mode = String(value ?? "")
    .trim()
    .toLowerCase();
  if (mode === "cloudflare" || mode === "mock" || mode === "retrieval-only") {
    return mode;
  }
  return process.env.NODE_ENV === "production" ? "retrieval-only" : "mock";
}

export function getChatRuntimeConfig(workerEnv: PortfolioRuntimeBindings = {}) {
  const processEnv = processBindings();
  const read = (
    key:
      | "GITHUB_USERNAME"
      | "GITHUB_TOKEN"
      | "AI_MODE"
      | "AI_MODEL_PRIMARY"
      | "AI_MODEL_ECONOMY"
      | "AI_MODEL_CHALLENGER"
      | "ENABLE_ECONOMY_ROUTING"
      | "TURNSTILE_SECRET_KEY"
      | "RATE_LIMIT_SALT"
      | "MAX_SESSION_GENERATED_ANSWERS"
      | "MAX_QUESTION_CHARACTERS"
      | "NEXT_PUBLIC_SITE_URL"
      | "NEXT_PUBLIC_TURNSTILE_SITE_KEY",
  ) => {
    const workerValue = workerEnv[key];
    if (typeof workerValue === "string") return workerValue;
    const processValue = processEnv[key];
    return typeof processValue === "string" ? processValue : undefined;
  };

  const aiMode = normalizedAiMode(read("AI_MODE"));
  const primaryModel = read("AI_MODEL_PRIMARY") || "@cf/zai-org/glm-4.7-flash";

  const turnstileSecret = read("TURNSTILE_SECRET_KEY")?.trim();
  const turnstileSiteKey =
    read("NEXT_PUBLIC_TURNSTILE_SITE_KEY")?.trim() || PUBLIC_TURNSTILE_SITE_KEY;

  return {
    ai: workerEnv.AI,
    aiMode,
    primaryModel,
    economyModel:
      read("AI_MODEL_ECONOMY") || "@cf/ibm-granite/granite-4.0-h-micro",
    challengerModel:
      read("AI_MODEL_CHALLENGER") || "@cf/qwen/qwen3-30b-a3b-fp8",
    economyRoutingEnabled:
      String(read("ENABLE_ECONOMY_ROUTING") ?? "").toLowerCase() === "true",
    rateLimitStore: workerEnv.RATE_LIMIT_KV,
    // Backward-compatible aliases are kept while older request handlers are
    // rolled forward to the named provider modes.
    model: primaryModel,
    mockMode: aiMode === "mock" ? "true" : "false",
    rateLimitMax: 12,
    rateLimitWindowMs: 60_000,
    maximumSessionAnswers: integerSetting(
      read("MAX_SESSION_GENERATED_ANSWERS"),
      8,
      1,
      100,
    ),
    maximumQuestionCharacters: integerSetting(
      read("MAX_QUESTION_CHARACTERS"),
      700,
      100,
      2_000,
    ),
    turnstileSecret,
    turnstileSiteKeyConfigured: Boolean(turnstileSiteKey),
    turnstilePairingOk: Boolean(turnstileSiteKey) === Boolean(turnstileSecret),
    ipHashSalt:
      read("RATE_LIMIT_SALT") ||
      read("TURNSTILE_SECRET_KEY") ||
      "portfolio-local-rate-limit-v2",
    siteUrl: read("NEXT_PUBLIC_SITE_URL"),
  };
}
