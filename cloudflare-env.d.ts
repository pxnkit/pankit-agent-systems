/**
 * Application-owned Cloudflare binding surface.
 *
 * Run `npx wrangler types cloudflare-env.d.ts --include-runtime false` after
 * changing wrangler.jsonc if you prefer Wrangler to regenerate this interface.
 */
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

declare namespace Cloudflare {
  interface Env {
    AI?: PortfolioAiBinding;
    RATE_LIMIT_KV?: PortfolioRateLimitKv;
    AI_MODEL: string;
    CHAT_MOCK_MODE: string;
    RATE_LIMIT_MAX_REQUESTS: string;
    RATE_LIMIT_WINDOW_SECONDS: string;
    TURNSTILE_SECRET_KEY?: string;
    IP_HASH_SALT?: string;
  }
}

declare module "cloudflare:workers" {
  export const env: Cloudflare.Env;
}

declare namespace NodeJS {
  interface ProcessEnv {
    readonly AI_MODEL?: string;
    readonly CHAT_MOCK_MODE?: string;
    readonly RATE_LIMIT_MAX_REQUESTS?: string;
    readonly RATE_LIMIT_WINDOW_SECONDS?: string;
    readonly TURNSTILE_SECRET_KEY?: string;
    readonly IP_HASH_SALT?: string;
    readonly NEXT_PUBLIC_TURNSTILE_SITE_KEY?: string;
    readonly NEXT_PUBLIC_SITE_URL?: string;
  }
}
