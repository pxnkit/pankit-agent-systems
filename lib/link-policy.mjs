const DEFAULT_ALLOWED_HOSTS = new Set(["github.com", "www.github.com"]);

const BLOCKED_PROTOCOL = /^(?:javascript|data|vbscript|file|blob):/i;

/**
 * @param {unknown} value
 * @param {{baseOrigin?: string, allowedHosts?: Iterable<string>, allowLocalhost?: boolean}} [options]
 */
export function classifyLink(value, options = {}) {
  if (typeof value !== "string") {
    return { allowed: false, kind: "blocked", href: null };
  }

  const candidate = value.trim();
  if (
    !candidate ||
    candidate.length > 2048 ||
    BLOCKED_PROTOCOL.test(candidate) ||
    candidate.startsWith("//") ||
    candidate.includes("\\")
  ) {
    return { allowed: false, kind: "blocked", href: null };
  }

  if (candidate.startsWith("/")) {
    const normalized = candidate.replace(/\/{2,}/g, "/");
    return { allowed: true, kind: "internal", href: normalized };
  }

  let parsed;
  try {
    parsed = new URL(candidate);
  } catch {
    return { allowed: false, kind: "blocked", href: null };
  }

  if (parsed.username || parsed.password || parsed.protocol !== "https:") {
    if (
      options.allowLocalhost === true &&
      parsed.protocol === "http:" &&
      (parsed.hostname === "localhost" || parsed.hostname === "127.0.0.1")
    ) {
      return { allowed: true, kind: "external", href: parsed.href };
    }
    return { allowed: false, kind: "blocked", href: null };
  }

  const allowedHosts = new Set([
    ...DEFAULT_ALLOWED_HOSTS,
    ...(options.allowedHosts ?? []),
  ]);
  if (options.baseOrigin) {
    try {
      allowedHosts.add(new URL(options.baseOrigin).hostname.toLowerCase());
    } catch {
      // An invalid optional base origin must not widen the allowlist.
    }
  }

  const hostname = parsed.hostname.toLowerCase();
  if (!allowedHosts.has(hostname)) {
    return { allowed: false, kind: "blocked", href: null };
  }

  let kind = "external";
  if (options.baseOrigin) {
    try {
      if (parsed.origin === new URL(options.baseOrigin).origin)
        kind = "internal";
    } catch {
      // Invalid optional origins never widen policy or crash callers.
    }
  }
  parsed.hash = parsed.hash.slice(0, 256);
  return { allowed: true, kind, href: parsed.href };
}

/** @param {unknown} value @param {Parameters<typeof classifyLink>[1]} [options] */
export function isAllowedLink(value, options = {}) {
  return classifyLink(value, options).allowed;
}

/** @param {unknown} value @param {Parameters<typeof classifyLink>[1]} [options] */
export function sanitizeLink(value, options = {}) {
  return classifyLink(value, options).href;
}

/** @param {unknown} value @param {string} [baseOrigin] */
export function isExternalLink(value, baseOrigin) {
  return classifyLink(value, { baseOrigin }).kind === "external";
}

/** @param {unknown} value @param {string} [baseOrigin] */
export function linkRel(value, baseOrigin) {
  return isExternalLink(value, baseOrigin) ? "noopener noreferrer" : undefined;
}

/**
 * Retains link text while removing destinations that are not explicitly
 * allowed. This is deliberately conservative for model-produced Markdown.
 *
 * @param {string} markdown
 * @param {{allowedUrls?: Iterable<string>, baseOrigin?: string}} [options]
 */
export function sanitizeMarkdownLinks(markdown, options = {}) {
  const allowedUrls = new Set(options.allowedUrls ?? []);
  return markdown.replace(
    /\[([^\]\n]{1,300})\]\(([^)\s]{1,2048})\)/g,
    (match, label, href) => {
      const safe = sanitizeLink(href, { baseOrigin: options.baseOrigin });
      if (!safe || !allowedUrls.has(safe)) return label;
      return `[${label}](${safe})`;
    },
  );
}
