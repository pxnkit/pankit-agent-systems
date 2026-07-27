/**
 * Normalized aliases map to catalog slugs. Ranked title-only entries are kept
 * here so search can resolve them without treating them as public projects.
 */
export const projectAliases: Record<string, string> = {
  "rka-lab": "rka-lab",
  rkalab: "rka-lab",
  "txn-mem": "txnmem",
  "chronicle-guard": "chronicle-guard",
  chronicleguard: "chronicle-guard",
  "intent-ledger": "intentledger",
  "fresh-index": "freshindex",
  "recall-resolve": "recallresolve",
  "hippo-gate": "hippogate",
  "hypothesis-ops": "hypothesisops",
  "method-chain": "methodchain",
  "change-pilot": "changepilot",
  "mem-equiv": "memequiv",
  "curri-graph": "currigraph",
  "communicate-to-remember": "communicate-to-remember",
  "scope-guard": "scopeguard",
  "worldmodel-lstar": "worldmodel-lstar",
  "world-model-lstar": "worldmodel-lstar",
  "world-model-l": "worldmodel-lstar",
  "worldmodel-l*": "worldmodel-lstar",
  "lineage-rag": "lineagerag",
  "robust-ask": "robustask",
  falsify: "skillfalsify",
  "skill-falsify": "skillfalsify",
  "regime-bank": "regimebank",
  "mem-intervene": "memintervene",
  "certi-compress": "certicompress",
  "tempo-trust": "tempo-trust",
  "tempo-rgs": "temporags",
  temporags: "temporags",
  "param-ledger": "paramledger",
  "verify-split": "verifysplit",
  "evid-route": "evidroute",
  "trace-mem": "trace-mem",
  "barrier-now": "barriernow",
  "who-fixes-this": "whofixesthis",
  "chaff-mem": "chaffmem",
  chaffmem: "chaffmem",
  "synthesis-autopsy": "synthesisautopsy",
  synthesisautopsy: "synthesisautopsy",
  "row-witness": "rowwitness",
  rowwitness: "rowwitness",
  "probe-diff": "probediff",
  probediff: "probediff",
  "veri-forget": "veriforget",
  veriforget: "veriforget",
};

export function normalizeProjectSlug(value: string): string {
  const normalized = value
    .trim()
    .toLowerCase()
    .replace(/['’]/g, "")
    .replace(/[^a-z0-9*]+/g, "-")
    .replace(/^-|-$/g, "");

  return projectAliases[normalized] ?? normalized;
}
