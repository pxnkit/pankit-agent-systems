import { sanitizeMarkdownLinks, sanitizeLink } from "./link-policy.mjs";

/**
 * @param {Iterable<{chunk: Record<string, unknown>, score?: number}>} retrieved
 * @param {{maxSources?: number, baseOrigin?: string}} [options]
 */
export function sourcesFromRetrieval(retrieved, options = {}) {
  const maxSources = Math.max(1, Math.min(8, options.maxSources ?? 5));
  const sources = [];
  const seen = new Set();
  for (const result of retrieved) {
    const chunk = result?.chunk;
    if (
      !chunk ||
      typeof chunk.sourceId !== "string" ||
      seen.has(chunk.sourceId)
    ) {
      continue;
    }
    const url = sanitizeLink(chunk.url, { baseOrigin: options.baseOrigin });
    sources.push({
      id: chunk.sourceId,
      title: String(chunk.title ?? "Portfolio source").slice(0, 160),
      excerpt: String(chunk.text ?? "")
        .replace(/\s+/g, " ")
        .trim()
        .slice(0, 360),
      ...(typeof chunk.projectSlug === "string"
        ? { projectSlug: chunk.projectSlug }
        : {}),
      ...(url ? { url } : {}),
    });
    seen.add(chunk.sourceId);
    if (sources.length >= maxSources) break;
  }
  return sources;
}

/** @param {string} answer */
export function citedSourceIds(answer) {
  const ids = [];
  const seen = new Set();
  for (const match of answer.matchAll(
    /\[source:([A-Za-z0-9][A-Za-z0-9._:/-]{0,159})\]/g,
  )) {
    if (seen.has(match[1])) continue;
    seen.add(match[1]);
    ids.push(match[1]);
  }
  return ids;
}

/**
 * @param {unknown} ids
 * @param {Iterable<{id: string}>} allowedSources
 */
export function validateSourceIds(ids, allowedSources) {
  const allowed = new Set([...allowedSources].map((source) => source.id));
  if (!Array.isArray(ids)) return [];
  return [
    ...new Set(ids.filter((id) => typeof id === "string" && allowed.has(id))),
  ];
}

/**
 * Provider output never gets to introduce a source or link. Invalid citations
 * are removed and callers can fall back when no valid grounding remains.
 *
 * @param {unknown} output
 * @param {Iterable<{id: string, url?: string}>} allowedSources
 * @param {{baseOrigin?: string}} [options]
 */
export function validateProviderOutput(output, allowedSources, options = {}) {
  const sources = [...allowedSources];
  if (!output || typeof output !== "object" || Array.isArray(output)) {
    return { ok: false, answer: "", sourceIds: [], reason: "invalid-output" };
  }
  const value = /** @type {Record<string, unknown>} */ (output);
  if (typeof value.answer !== "string") {
    return { ok: false, answer: "", sourceIds: [], reason: "missing-answer" };
  }
  let answer = value.answer
    .replace(/\u0000/g, "")
    .trim()
    .slice(0, 8000);
  if (!answer) {
    return { ok: false, answer: "", sourceIds: [], reason: "empty-answer" };
  }

  const citedIds = validateSourceIds(citedSourceIds(answer), sources);
  // Inline citations are the auditable contract. A provider cannot validate a
  // claim merely by attaching an out-of-band sourceIds array.
  const sourceIds = citedIds;
  const allowedIdSet = new Set(sources.map((source) => source.id));
  answer = answer.replace(/\[source:([^\]\n]{1,200})\]/g, (citation, id) =>
    allowedIdSet.has(id) ? citation : "",
  );

  const allowedUrls = sources
    .map((source) =>
      sanitizeLink(source.url, { baseOrigin: options.baseOrigin }),
    )
    .filter(Boolean);
  answer = sanitizeMarkdownLinks(answer, {
    allowedUrls,
    baseOrigin: options.baseOrigin,
  });

  if (sources.length > 0 && sourceIds.length === 0) {
    return { ok: false, answer, sourceIds: [], reason: "ungrounded" };
  }
  return { ok: true, answer, sourceIds, reason: null };
}
