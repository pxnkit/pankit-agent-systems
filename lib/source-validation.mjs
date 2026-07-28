import { sanitizeMarkdownLinks, sanitizeLink } from "./link-policy.mjs";

/**
 * @param {Iterable<{chunk: Record<string, unknown>, score?: number}>} retrieved
 * @param {{maxSources?: number, baseOrigin?: string}} [options]
 */
export function sourcesFromRetrieval(retrieved, options = {}) {
  const maxSources = Math.max(1, Math.min(6, options.maxSources ?? 6));
  const sources = [];
  const sourceById = new Map();
  for (const result of retrieved) {
    const chunk = result?.chunk;
    if (!chunk || typeof chunk.sourceId !== "string") {
      continue;
    }
    const excerptPart =
      `${String(chunk.title ?? "Portfolio source")}: ` +
      String(chunk.text ?? "")
        .replace(/\s+/g, " ")
        .trim();
    const existing = sourceById.get(chunk.sourceId);
    if (existing) {
      if (!existing.excerpt.includes(excerptPart)) {
        existing.excerpt = `${existing.excerpt}\n${excerptPart}`.slice(
          0,
          2_400,
        );
      }
      continue;
    }
    if (sources.length >= maxSources) continue;
    const url = sanitizeLink(chunk.url, { baseOrigin: options.baseOrigin });
    const projectSlug =
      typeof chunk.projectSlug === "string" ? chunk.projectSlug : undefined;
    const kind = String(chunk.kind ?? "portfolio-source").slice(0, 80);
    const internalUrl = projectSlug
      ? `/projects/${encodeURIComponent(projectSlug)}`
      : kind.includes("project-map") || kind.includes("ranking")
        ? "/projects"
        : kind.includes("site-scope")
          ? "/"
          : "/portfolio";
    sources.push({
      id: chunk.sourceId,
      title: String(chunk.title ?? "Portfolio source").slice(0, 160),
      excerpt: excerptPart.slice(0, 2_400),
      type: kind,
      internalUrl,
      ...(projectSlug ? { projectSlug } : {}),
      ...(url && !url.startsWith("/") ? { url } : {}),
    });
    sourceById.set(chunk.sourceId, sources.at(-1));
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

/** @param {string} answer */
function factualGroundingBlocks(answer) {
  const blocks = [];
  let paragraph = [];
  const flushParagraph = () => {
    const value = paragraph.join(" ").trim();
    paragraph = [];
    if (value) blocks.push(value);
  };

  for (const rawLine of answer.split(/\n/)) {
    const line = rawLine.trim();
    if (!line) {
      flushParagraph();
      continue;
    }
    if (/^[-*]\s+/.test(line)) {
      flushParagraph();
      blocks.push(line);
      continue;
    }
    paragraph.push(line);
  }
  flushParagraph();

  return blocks.filter(
    (block) =>
      !/^#{1,6}\s+/.test(block) && !/^[A-Za-z][A-Za-z\s-]{0,80}:$/.test(block),
  );
}

/**
 * Provider output never gets to introduce a source or link. Invalid citations
 * are removed and callers can fall back when no valid grounding remains.
 * Every factual paragraph or bullet must carry its own allowlisted citation;
 * one trailing citation cannot self-certify an unrelated paragraph.
 *
 * @param {unknown} output
 * @param {Iterable<{id: string, url?: string}>} allowedSources
 * @param {{baseOrigin?: string, allowSourceLessAbstention?: boolean}} [options]
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

  if (sources.length === 0) {
    if (
      options.allowSourceLessAbstention === true &&
      value.abstained === true
    ) {
      return { ok: true, answer, sourceIds: [], reason: null };
    }
    return {
      ok: false,
      answer,
      sourceIds: [],
      reason: "source-less-factual-output",
    };
  }
  if (sources.length > 0 && sourceIds.length === 0) {
    return { ok: false, answer, sourceIds: [], reason: "ungrounded" };
  }
  const uncitedBlocks = factualGroundingBlocks(answer).filter(
    (block) => validateSourceIds(citedSourceIds(block), sources).length === 0,
  );
  if (uncitedBlocks.length > 0) {
    return {
      ok: false,
      answer,
      sourceIds: [],
      reason: "uncited-factual-block",
    };
  }
  return { ok: true, answer, sourceIds, reason: null };
}
