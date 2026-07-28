/** @param {unknown} value */
function normalizeOrigin(value) {
  if (typeof value !== "string" || !value.trim()) return null;
  try {
    const parsed = new URL(value);
    if (
      parsed.origin === "null" ||
      !["http:", "https:"].includes(parsed.protocol)
    ) {
      return null;
    }
    return parsed.origin;
  } catch {
    return null;
  }
}

/**
 * @param {Request} request
 * @param {{allowedOrigins?: Iterable<string>}} [options]
 */
export function checkSameOrigin(request, options = {}) {
  const requestOrigin = new URL(request.url).origin;
  const allowed = new Set([requestOrigin]);
  for (const value of options.allowedOrigins ?? []) {
    const origin = normalizeOrigin(value);
    if (origin) allowed.add(origin);
  }

  const fetchSite = request.headers.get("sec-fetch-site")?.toLowerCase();
  if (fetchSite === "cross-site") {
    return { ok: false, reason: "cross-site" };
  }
  // Sec-Fetch-Site is a browser-controlled forbidden header. It remains the
  // most reliable signal when a local reverse proxy normalizes Request.url
  // from 127.0.0.1 to localhost (or vice versa).
  if (fetchSite === "same-origin") {
    return { ok: true, reason: null };
  }

  const rawOrigin = request.headers.get("origin");
  if (rawOrigin !== null) {
    const origin = normalizeOrigin(rawOrigin);
    return allowed.has(origin)
      ? { ok: true, reason: null }
      : { ok: false, reason: "origin-mismatch" };
  }

  const referer = request.headers.get("referer");
  if (referer) {
    const origin = normalizeOrigin(referer);
    return allowed.has(origin)
      ? { ok: true, reason: null }
      : { ok: false, reason: "referer-mismatch" };
  }

  // Non-browser clients do not always send browser provenance headers. JSON
  // content type still forces a browser preflight, while explicit cross-site
  // browser requests were rejected above.
  return { ok: true, reason: null };
}

/** @param {Request} request @param {Parameters<typeof checkSameOrigin>[1]} [options] */
export function isSameOriginRequest(request, options = {}) {
  return checkSameOrigin(request, options).ok;
}
