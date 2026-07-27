/**
 * Public project repositories approved for ingestion and display.
 *
 * Order is stable and intentionally matches the manually curated catalog.
 */
export const projectAllowlist = [
  "rka-lab",
  "txnmem",
  "chronicle-guard",
  "intentledger",
  "freshindex",
  "recallresolve",
  "hippogate",
  "hypothesisops",
  "methodchain",
  "changepilot",
  "memequiv",
  "currigraph",
  "communicate-to-remember",
  "scopeguard",
  "worldmodel-lstar",
  "lineagerag",
  "robustask",
  "skillfalsify",
  "regimebank",
  "memintervene",
  "certicompress",
  "tempo-trust",
  "temporags",
  "paramledger",
  "verifysplit",
  "evidroute",
  "trace-mem",
  "barriernow",
  "whofixesthis",
] as const;

export type AllowlistedProjectSlug = (typeof projectAllowlist)[number];

const projectAllowlistSet = new Set<string>(projectAllowlist);

export function isAllowlistedProject(
  slug: string,
): slug is AllowlistedProjectSlug {
  return projectAllowlistSet.has(slug);
}
