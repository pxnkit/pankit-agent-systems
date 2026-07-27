/**
 * The one response used for topics that are intentionally absent from the
 * public index. Keeping this exact and non-judgmental avoids confirming or
 * denying private facts.
 */
export const INDEXED_SCOPE_RESPONSE =
  "This portfolio focuses on Pankit’s work in agent memory, search, verification, and reliable AI systems. Current employment details are not included in the indexed portfolio sources.";

const EMPLOYMENT_QUERY_PATTERNS = [
  /\b(?:current|present)\s+(?:work|job|role|position|employer|company|workplace|occupation)\b/i,
  /\b(?:employer|employment|job\s*title|salary|compensation|résumé|resume|curriculum\s+vitae|career\s+history)\b/i,
  /\bwhere\s+(?:does|is)\s+(?:pankit|he)\s+(?:currently\s+)?(?:work|working|employed)\b/i,
  /\b(?:who|what\s+company|which\s+company)\s+does\s+(?:pankit|he)\s+(?:currently\s+)?work\s+for\b/i,
  /\bdoes\s+(?:pankit|he)\s+(?:currently\s+)?work\s+(?:at|for)\b/i,
  /\bwhat(?:'s|\s+is)\s+(?:pankit'?s|his)\s+(?:current\s+)?(?:job|role|position|employer|company)\b/i,
  /\b(?:pankit'?s|his)\s+(?:current\s+)?(?:job|employer|employment|workplace)\b/i,
  /\b(?:pankit|he)\s+(?:works?|worked|is\s+employed)\s+(?:at|for|by)\b/i,
  /\b(?:who|which\s+company)\s+employs?\s+(?:pankit|him)\b/i,
  /\b(?:day\s+job|professional\s+role|workplace)\b/i,
];

const MATERIALS_QUERY_PATTERNS = [
  /\bmaterials?\s+(?:science|scientist|engineering|engineer|research|researcher|role|work|career)\b/i,
  /\bnano(?:technology|technologies|science|materials?|particles?|structures?|fabrication)\b/i,
  /\bnano[-\s]?(?:tech|material|particle|structure|fabrication)\b/i,
  /\bmetallurg(?:y|ist|ical)\b/i,
  /\bthin[-\s]?films?\b/i,
  /\bsemiconductor\s+materials?\b/i,
];

const EXCLUDED_SOURCE_PATTERNS = [
  ...MATERIALS_QUERY_PATTERNS,
  /\b(?:current|present)\s+(?:employer|employment|job|workplace|job\s+title)\b/i,
  /\b(?:salary|compensation|employee\s+record|employment\s+history)\b/i,
  /\b(?:pankit|he)\s+(?:works?|worked|is\s+employed)\s+(?:at|for|by)\b/i,
];

/**
 * @param {unknown} value
 * @returns {"employment" | "materials" | null}
 */
export function classifyExcludedQuery(value) {
  if (typeof value !== "string") return null;
  const query = value.normalize("NFKC").replace(/\s+/g, " ").trim();
  if (!query) return null;

  if (MATERIALS_QUERY_PATTERNS.some((pattern) => pattern.test(query))) {
    return "materials";
  }
  if (EMPLOYMENT_QUERY_PATTERNS.some((pattern) => pattern.test(query))) {
    return "employment";
  }
  return null;
}

/** @param {unknown} value */
export function isExcludedQuery(value) {
  return classifyExcludedQuery(value) !== null;
}

/**
 * This stricter check is for indexable source material, not generated answers.
 * It intentionally does not flag broad words such as "work", "role", or
 * "material" in isolation.
 *
 * @param {unknown} value
 */
export function containsExcludedSourceContent(value) {
  if (typeof value !== "string") return false;
  const text = value.normalize("NFKC");
  return EXCLUDED_SOURCE_PATTERNS.some((pattern) => pattern.test(text));
}

export const contentPolicyPatterns = Object.freeze({
  employmentQueries: [...EMPLOYMENT_QUERY_PATTERNS],
  materialsQueries: [...MATERIALS_QUERY_PATTERNS],
  excludedSources: [...EXCLUDED_SOURCE_PATTERNS],
});
