const TURNSTILE_VERIFY_ENDPOINT =
  "https://challenges.cloudflare.com/turnstile/v0/siteverify";

/**
 * @param {{
 *   secret?: string,
 *   token?: string,
 *   remoteIp?: string,
 *   expectedAction?: string,
 *   expectedHostname?: string,
 *   fetcher?: typeof fetch,
 *   timeoutMs?: number
 * }} options
 */
export async function verifyTurnstile(options) {
  if (!options.secret) {
    return { ok: true, skipped: true, reason: "not-configured" };
  }
  if (!options.token) {
    return { ok: false, skipped: false, reason: "missing-token" };
  }

  const body = new URLSearchParams({
    secret: options.secret,
    response: options.token,
  });
  if (options.remoteIp && options.remoteIp !== "unknown") {
    body.set("remoteip", options.remoteIp);
  }

  const controller = new AbortController();
  const timeout = setTimeout(
    () => controller.abort(),
    Math.max(250, Math.min(10_000, options.timeoutMs ?? 3_500)),
  );
  try {
    const response = await (options.fetcher ?? fetch)(
      TURNSTILE_VERIFY_ENDPOINT,
      {
        method: "POST",
        headers: { "content-type": "application/x-www-form-urlencoded" },
        body,
        signal: controller.signal,
      },
    );
    if (!response.ok) {
      return { ok: false, skipped: false, reason: "verification-unavailable" };
    }
    const result = await response.json();
    if (!result || typeof result !== "object" || result.success !== true) {
      return { ok: false, skipped: false, reason: "challenge-failed" };
    }
    if (options.expectedAction && result.action !== options.expectedAction) {
      return { ok: false, skipped: false, reason: "action-mismatch" };
    }
    if (
      options.expectedHostname &&
      result.hostname !== options.expectedHostname
    ) {
      return { ok: false, skipped: false, reason: "hostname-mismatch" };
    }
    return { ok: true, skipped: false, reason: null };
  } catch {
    return { ok: false, skipped: false, reason: "verification-unavailable" };
  } finally {
    clearTimeout(timeout);
  }
}
