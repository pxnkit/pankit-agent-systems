/** @param {unknown} value */
function normalizeIp(value) {
  if (typeof value !== "string") return null;
  const candidate = value.trim().replace(/^\[|\]$/g, "");
  if (
    !candidate ||
    candidate.length > 64 ||
    !/^[0-9a-f:.]+$/i.test(candidate)
  ) {
    return null;
  }
  return candidate.toLowerCase();
}

/** @param {Headers | Record<string, string | undefined>} headers */
function headerValue(headers, name) {
  if (headers instanceof Headers) return headers.get(name);
  const match = Object.entries(headers).find(
    ([key]) => key.toLowerCase() === name.toLowerCase(),
  );
  return match?.[1] ?? null;
}

/** @param {Headers | Record<string, string | undefined>} headers */
export function getClientIp(headers) {
  const cloudflare = normalizeIp(headerValue(headers, "cf-connecting-ip"));
  if (cloudflare) return cloudflare;
  const forwarded = headerValue(headers, "x-forwarded-for");
  if (forwarded) {
    const first = normalizeIp(forwarded.split(",", 1)[0]);
    if (first) return first;
  }
  const realIp = normalizeIp(headerValue(headers, "x-real-ip"));
  return realIp ?? "unknown";
}

/** @param {string} value @param {string} salt @param {string} namespace */
export async function hashRateLimitIdentifier(value, salt, namespace) {
  const encoder = new TextEncoder();
  const keyMaterial = salt || "portfolio-local-rate-limit-v1";
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(keyMaterial),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const digest = await crypto.subtle.sign(
    "HMAC",
    key,
    encoder.encode(`portfolio-chat:${namespace}:${value}`),
  );
  return [...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

/**
 * HMAC prevents a stored digest from becoming a reversible lookup table for
 * the small IPv4 address space. Only the digest is used as a rate-limit key.
 *
 * @param {string} ip
 * @param {string} salt
 */
export async function hashIpAddress(ip, salt) {
  return hashRateLimitIdentifier(normalizeIp(ip) ?? "unknown", salt, "network");
}
