interface PortfolioAiBinding {
  run(
    model: string,
    inputs: Record<string, unknown>,
    options?: Record<string, unknown>,
  ): Promise<unknown>;
}

interface PortfolioRateLimitKv {
  get(key: string): Promise<string | null>;
  put(
    key: string,
    value: string,
    options?: {
      expiration?: number;
      expirationTtl?: number;
      metadata?: unknown;
    },
  ): Promise<void>;
}

interface CloudflareEnv {
  AI?: PortfolioAiBinding;
  ASSETS: Fetcher;
  RATE_LIMIT_KV?: PortfolioRateLimitKv;
  GITHUB_USERNAME: string;
  GITHUB_TOKEN?: string;
  AI_MODE: "cloudflare" | "mock" | "retrieval-only";
  AI_MODEL_PRIMARY: string;
  AI_MODEL_ECONOMY: string;
  AI_MODEL_CHALLENGER: string;
  ENABLE_ECONOMY_ROUTING: string;
  TURNSTILE_SECRET_KEY?: string;
  RATE_LIMIT_SALT?: string;
  MAX_SESSION_GENERATED_ANSWERS: string;
  MAX_QUESTION_CHARACTERS: string;
  NEXT_PUBLIC_SITE_URL?: string;
}

declare namespace NodeJS {
  interface ProcessEnv {
    readonly NEXT_PUBLIC_SITE_URL?: string;
    readonly GITHUB_USERNAME?: string;
    readonly GITHUB_TOKEN?: string;
    readonly AI_MODE?: "cloudflare" | "mock" | "retrieval-only";
    readonly AI_MODEL_PRIMARY?: string;
    readonly AI_MODEL_ECONOMY?: string;
    readonly AI_MODEL_CHALLENGER?: string;
    readonly ENABLE_ECONOMY_ROUTING?: string;
    readonly NEXT_PUBLIC_TURNSTILE_SITE_KEY?: string;
    readonly TURNSTILE_SECRET_KEY?: string;
    readonly RATE_LIMIT_SALT?: string;
    readonly MAX_SESSION_GENERATED_ANSWERS?: string;
    readonly MAX_QUESTION_CHARACTERS?: string;
    readonly CONTACT_EMAIL?: string;
    readonly NEXT_PUBLIC_LINKEDIN_URL?: string;
    readonly NEXT_PUBLIC_CV_URL?: string;
    readonly NEXT_PUBLIC_NEWSLETTER_URL?: string;
  }
}
