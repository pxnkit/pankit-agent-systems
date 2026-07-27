import { normalizeProjectSlug, projectAliases } from "./project-aliases";

export type ProjectSourceStatus = "verified" | "pending";
export type ProjectCardVariant = "light" | "dark" | "soft" | "accent";
export type ProjectPrimaryPillar =
  | "Agent Memory and Adaptation"
  | "Retrieval and Evidence"
  | "Verification and Reliability"
  | "Search-Guided Reasoning"
  | "Tool-Using Agent Evaluation"
  | "Applied Agent Systems"
  | "Curated shortlist";

export type Project = {
  slug: string;
  title: string;
  shortDescription?: string;
  longDescription?: string;
  primaryPillar: ProjectPrimaryPillar;
  tags: string[];
  aliases: string[];
  repositoryUrl?: string;
  featured: boolean;
  sourceStatus: ProjectSourceStatus;
  implementationStatus?: string;
  evaluationStatus?: string;
  claimStatus?: string;
  updatedAt?: string;
  languages: string[];
  technologies: string[];
  cardVariant: ProjectCardVariant;
  sourceIds: string[];
  limitations: string[];
  relatedProjects: string[];
};

type ProjectSeed = Omit<
  Project,
  | "repositoryUrl"
  | "sourceStatus"
  | "implementationStatus"
  | "claimStatus"
  | "limitations"
> &
  Partial<
    Pick<
      Project,
      | "repositoryUrl"
      | "sourceStatus"
      | "implementationStatus"
      | "claimStatus"
      | "limitations"
    >
  >;

const defaultLimitation =
  "Research prototype; repository evidence does not establish broad real-world performance.";

function defineProject(seed: ProjectSeed): Project {
  return {
    repositoryUrl: `https://github.com/pxnkit/${seed.slug}`,
    sourceStatus: "verified",
    implementationStatus: "research-prototype",
    claimStatus: "research-claim-open",
    limitations: [defaultLimitation],
    ...seed,
  };
}

/**
 * Manually curated project records are the source of truth. Generated GitHub
 * metadata may refresh links and discovery status, but must never overwrite
 * these descriptions, categories, exclusions, or featured selections.
 */
export const projects: Project[] = [
  defineProject({
    slug: "rka-lab",
    title: "RKA-Lab",
    shortDescription:
      "Evaluation library for tracing remembered evidence from recognition through recall, source recollection, and action.",
    longDescription:
      "RKA-Lab evaluates four matched rungs against the same evidence and compares them with irrelevant-memory and gold-memory masks, separating fluent answers from evidence-linked memory that changes behavior.",
    primaryPillar: "Verification and Reliability",
    tags: ["agent memory", "causal evaluation", "benchmarking"],
    aliases: ["RKA Lab", "RKABench"],
    featured: true,
    evaluationStatus: "10-item deterministic verification fixture",
    languages: ["Python", "TypeScript"],
    technologies: ["FastAPI", "React", "Docker"],
    cardVariant: "accent",
    sourceIds: ["local:rka-lab:readme", "github:pxnkit/rka-lab"],
    limitations: [
      "The included 10-item snapshot verifies the software path; it is not the planned full benchmark or a publication result.",
    ],
    relatedProjects: ["memequiv", "memintervene", "verifysplit"],
  }),
  defineProject({
    slug: "txnmem",
    title: "TxnMem",
    shortDescription:
      "Transactional shared memory with explicit update semantics and replayable histories for concurrent agent teams.",
    longDescription:
      "TxnMem models facts, constraints, resources, commitments, evidence, and commutative values as typed operations, then checks accepted histories against a deterministic serial interpreter.",
    primaryPillar: "Agent Memory and Adaptation",
    tags: ["shared memory", "transactions", "concurrency"],
    aliases: ["Txn Mem", "MemoryRace"],
    featured: true,
    evaluationStatus: "MemoryRace benchmark and deterministic checks",
    languages: ["Python", "TypeScript"],
    technologies: ["FastAPI", "PostgreSQL", "React"],
    cardVariant: "dark",
    sourceIds: ["local:txnmem:readme", "github:pxnkit/txnmem"],
    limitations: [
      "The repository identifies itself as a research prototype and does not claim production readiness.",
    ],
    relatedProjects: ["certicompress", "intentledger", "scopeguard"],
  }),
  defineProject({
    slug: "chronicle-guard",
    title: "ChronicleGuard",
    shortDescription:
      "Source-aware multimodal recall evaluation that keeps episodic evidence separate from mutable beliefs.",
    primaryPillar: "Verification and Reliability",
    tags: ["multimodal recall", "provenance", "belief updates"],
    aliases: ["Chronicle Guard"],
    featured: false,
    evaluationStatus: "synthetic paired evaluation",
    languages: ["Python", "TypeScript"],
    technologies: ["FastAPI", "React"],
    cardVariant: "soft",
    sourceIds: [
      "local:chronicle-guard:readme",
      "github:pxnkit/chronicle-guard",
    ],
    limitations: [
      "The default evaluation uses original synthetic scenes; external vision-language models are optional.",
    ],
    relatedProjects: ["rka-lab", "memequiv", "trace-mem"],
  }),
  defineProject({
    slug: "intentledger",
    title: "IntentLedger",
    shortDescription:
      "Cancellation-safe prospective memory built on an append-only lifecycle ledger.",
    primaryPillar: "Agent Memory and Adaptation",
    tags: ["prospective memory", "event ledger", "idempotency"],
    aliases: ["Intent Ledger"],
    featured: false,
    evaluationStatus: "synthetic lifecycle benchmark",
    languages: ["Python", "TypeScript"],
    technologies: ["FastAPI", "React"],
    cardVariant: "light",
    sourceIds: ["local:intentledger:readme", "github:pxnkit/intentledger"],
    limitations: [
      "The included lifecycle benchmark is synthetic and does not validate deployment in an autonomous production agent.",
    ],
    relatedProjects: ["txnmem", "scopeguard", "paramledger"],
  }),
  defineProject({
    slug: "freshindex",
    title: "FreshIndex",
    shortDescription:
      "Capacity-aware scheduling for proactive verification of mutable agent memories.",
    longDescription:
      "FreshIndex assigns each memory an age-aware audit priority, explains that score, dispatches only approved verifiers, and records decisions in a tamper-evident event log.",
    primaryPillar: "Agent Memory and Adaptation",
    tags: ["verification scheduling", "freshness", "restless bandits"],
    aliases: ["Fresh Index"],
    featured: true,
    evaluationStatus: "deterministic simulation and exact small-state checks",
    languages: ["Python", "TypeScript"],
    technologies: ["FastAPI", "React"],
    cardVariant: "accent",
    sourceIds: ["local:freshindex:readme", "github:pxnkit/freshindex"],
    limitations: [
      "Included simulations support engineering checks; policy effectiveness on live memory streams remains an open evaluation question.",
    ],
    relatedProjects: ["tempo-trust", "paramledger", "regimebank"],
  }),
  defineProject({
    slug: "recallresolve",
    title: "RecallResolve",
    shortDescription:
      "Evidence-first resolution of exact consumer-product recall variants with active multimodal evidence acquisition.",
    primaryPillar: "Retrieval and Evidence",
    tags: ["entity resolution", "multimodal retrieval", "product recalls"],
    aliases: ["Recall Resolve", "RecallAct Bench"],
    featured: false,
    languages: [],
    technologies: [],
    cardVariant: "soft",
    sourceIds: [
      "local:recallresolve:implementation-brief",
      "github:pxnkit/recallresolve",
    ],
    limitations: [
      "The local source is an implementation brief; implementation and evaluation details are not asserted in this catalog.",
    ],
    relatedProjects: ["barriernow", "whofixesthis", "evidroute"],
  }),
  defineProject({
    slug: "hippogate",
    title: "HippoGate",
    shortDescription:
      "Belief-state control for deciding whether to forget, probe, retain, or consolidate a candidate memory.",
    longDescription:
      "HippoGate treats cross-context applicability as a hidden state and makes each consolidation decision traceable to its posterior, cost model, recurrence estimate, horizon, and probe likelihoods.",
    primaryPillar: "Agent Memory and Adaptation",
    tags: ["memory consolidation", "POMDP", "decision theory"],
    aliases: ["Hippo Gate"],
    featured: true,
    evaluationStatus: "synthetic and procedural environments",
    languages: ["Python", "TypeScript"],
    technologies: ["FastAPI", "React"],
    cardVariant: "dark",
    sourceIds: ["local:hippogate:readme", "github:pxnkit/hippogate"],
    limitations: [
      "The decision model depends on configured costs and likelihoods and is not a general safety guarantee.",
    ],
    relatedProjects: ["certicompress", "regimebank", "freshindex"],
  }),
  defineProject({
    slug: "hypothesisops",
    title: "HypothesisOps",
    shortDescription:
      "Safe sequential search over competing causal explanations for simulated cloud incidents.",
    primaryPillar: "Search-Guided Reasoning",
    tags: ["incident diagnosis", "causal search", "safe interventions"],
    aliases: ["Hypothesis Ops"],
    featured: false,
    evaluationStatus: "deterministic paired incident simulator",
    languages: ["Python", "TypeScript"],
    technologies: ["FastAPI", "React"],
    cardVariant: "light",
    sourceIds: ["local:hypothesisops:readme", "github:pxnkit/hypothesisops"],
    limitations: [
      "The system operates in a deterministic simulator and does not connect to production services.",
    ],
    relatedProjects: ["worldmodel-lstar", "changepilot", "skillfalsify"],
  }),
  defineProject({
    slug: "methodchain",
    title: "MethodChain",
    shortDescription:
      "Evidence-governed reconstruction of experimental procedures spread across citations and supporting files.",
    primaryPillar: "Retrieval and Evidence",
    tags: ["provenance", "scientific methods", "citation chains"],
    aliases: ["Method Chain"],
    featured: false,
    evaluationStatus: "offline synthetic document bundle",
    languages: ["Python", "TypeScript"],
    technologies: ["FastAPI", "React"],
    cardVariant: "soft",
    sourceIds: ["local:methodchain:readme", "github:pxnkit/methodchain"],
    limitations: [
      "The output is not validated for laboratory execution and does not provide safety approval.",
    ],
    relatedProjects: ["lineagerag", "evidroute", "tempo-trust"],
  }),
  defineProject({
    slug: "changepilot",
    title: "ChangePilot",
    shortDescription:
      "Version-aware Python API migration analysis with conservative edits and closed-world verification.",
    primaryPillar: "Applied Agent Systems",
    tags: ["static analysis", "API migration", "codemods"],
    aliases: ["Change Pilot"],
    featured: false,
    evaluationStatus: "focused repository fixtures",
    languages: ["Python", "TypeScript"],
    technologies: ["Python AST", "React"],
    cardVariant: "light",
    sourceIds: ["local:changepilot:readme", "github:pxnkit/changepilot"],
    limitations: [
      "The prototype is not a replacement for a project test suite or a general-purpose refactoring platform.",
    ],
    relatedProjects: ["hypothesisops", "worldmodel-lstar", "scopeguard"],
  }),
  defineProject({
    slug: "memequiv",
    title: "MemEquiv",
    shortDescription:
      "Executable metamorphic contracts for persistent agent memory.",
    longDescription:
      "MemEquiv checks whether histories related by a declared transformation preserve the right facts, uncertainty, scope, provenance, and future behavior across memory adapters.",
    primaryPillar: "Verification and Reliability",
    tags: ["agent memory", "metamorphic testing", "counterexamples"],
    aliases: ["Mem Equiv", "Metamorphic Contracts for Personalized Memory"],
    featured: true,
    evaluationStatus: "15 executable contracts and paired benchmark generation",
    claimStatus: "verified public source; tested relations only",
    languages: ["Python", "TypeScript"],
    technologies: ["FastAPI", "React", "SQLite"],
    cardVariant: "accent",
    sourceIds: ["local:memequiv:readme", "github:pxnkit/memequiv"],
    limitations: [
      "Passing the included contracts is evidence about tested relations, not proof of safety or correctness in every deployment.",
    ],
    relatedProjects: ["rka-lab", "verifysplit", "memintervene"],
  }),
  defineProject({
    slug: "currigraph",
    title: "CurriGraph",
    shortDescription:
      "Directed transfer graphs for online curriculum selection in tool agents.",
    primaryPillar: "Agent Memory and Adaptation",
    tags: ["curriculum learning", "transfer graphs", "tool agents"],
    aliases: ["Curri Graph"],
    featured: false,
    evaluationStatus: "deterministic synthetic environment",
    languages: ["Python", "TypeScript"],
    technologies: ["React"],
    cardVariant: "soft",
    sourceIds: ["local:currigraph:readme", "github:pxnkit/currigraph"],
    limitations: [
      "Synthetic diagnostics do not establish general performance on real agents.",
    ],
    relatedProjects: ["regimebank", "communicate-to-remember", "robustask"],
  }),
  defineProject({
    slug: "communicate-to-remember",
    title: "Communicate to Remember",
    shortDescription:
      "Contextual-bandit routing that jointly chooses communication and memory actions for multi-agent systems.",
    primaryPillar: "Agent Memory and Adaptation",
    tags: ["multi-agent systems", "contextual bandits", "memory routing"],
    aliases: ["Communicate-to-Remember"],
    featured: false,
    evaluationStatus: "deterministic simulation",
    languages: ["TypeScript"],
    technologies: ["Next.js", "React", "Cloudflare Workers"],
    cardVariant: "light",
    sourceIds: [
      "local:communicate-to-remember:readme",
      "github:pxnkit/communicate-to-remember",
    ],
    limitations: [
      "The included evaluation is a controlled simulation and does not establish effectiveness in deployed agent teams.",
    ],
    relatedProjects: ["txnmem", "currigraph", "scopeguard"],
  }),
  defineProject({
    slug: "scopeguard",
    title: "ScopeGuard",
    shortDescription:
      "Argument-level memory non-interference checks for tool-using agents.",
    primaryPillar: "Tool-Using Agent Evaluation",
    tags: ["memory safety", "tool use", "non-interference"],
    aliases: ["Scope Guard"],
    featured: false,
    evaluationStatus: "deterministic policy and repair checks",
    languages: ["Python", "TypeScript"],
    technologies: ["FastAPI", "React"],
    cardVariant: "dark",
    sourceIds: ["local:scopeguard:readme", "github:pxnkit/scopeguard"],
    limitations: [
      "Authorization depends on explicit scope, source, authority, purpose, and evidence declarations.",
    ],
    relatedProjects: ["txnmem", "intentledger", "memequiv"],
  }),
  defineProject({
    slug: "worldmodel-lstar",
    title: "WorldModel-L*",
    shortDescription:
      "Active symbolic world-model induction for learning hidden tool behavior before committing to a plan.",
    primaryPillar: "Search-Guided Reasoning",
    tags: ["active learning", "tool agents", "symbolic uncertainty"],
    aliases: ["WorldModel L*", "World Model L*"],
    featured: false,
    evaluationStatus: "local deterministic environments",
    languages: ["Python", "TypeScript"],
    technologies: ["React"],
    cardVariant: "soft",
    sourceIds: [
      "local:worldmodel-lstar:readme",
      "github:pxnkit/worldmodel-lstar",
    ],
    limitations: [
      "The bounded version space represents configured hypotheses, not every possible hidden tool behavior.",
    ],
    relatedProjects: ["hypothesisops", "skillfalsify", "changepilot"],
  }),
  defineProject({
    slug: "lineagerag",
    title: "LineageRAG",
    shortDescription:
      "Copy-aware evidence corroboration that groups dependent documents before verification.",
    longDescription:
      "LineageRAG infers likely document derivation links, collapses dependent documents into origin families, and combines evidence at the family level instead of counting copied URLs as independent support.",
    primaryPillar: "Retrieval and Evidence",
    tags: ["RAG", "provenance", "fact verification"],
    aliases: ["Lineage RAG"],
    featured: true,
    evaluationStatus: "controlled evidence cascades",
    languages: ["Python", "TypeScript"],
    technologies: ["scikit-learn", "React"],
    cardVariant: "dark",
    sourceIds: ["local:lineagerag:readme", "github:pxnkit/lineagerag"],
    limitations: [
      "Copy-family inference is probabilistic; corroboration quality depends on lineage and stance estimates.",
    ],
    relatedProjects: ["tempo-trust", "methodchain", "evidroute"],
  }),
  defineProject({
    slug: "robustask",
    title: "RobustAsk",
    shortDescription:
      "Reliability-aware clarification when user answers may be noisy, changing, or systematically confused.",
    primaryPillar: "Applied Agent Systems",
    tags: ["clarification", "uncertainty", "decision theory"],
    aliases: ["Robust Ask"],
    featured: false,
    evaluationStatus: "synthetic benchmark and smoke study",
    languages: ["Python", "TypeScript"],
    technologies: ["FastAPI", "React"],
    cardVariant: "light",
    sourceIds: ["local:robustask:readme", "github:pxnkit/robustask"],
    limitations: [
      "Smoke-scale and synthetic results do not establish general performance with real users.",
    ],
    relatedProjects: ["currigraph", "evidroute", "communicate-to-remember"],
  }),
  defineProject({
    slug: "skillfalsify",
    title: "FALSIFY",
    shortDescription:
      "Active minimal-counterexample discovery for selective procedural memory.",
    primaryPillar: "Search-Guided Reasoning",
    tags: ["counterexamples", "procedural memory", "tool safety"],
    aliases: ["SkillFalsify", "Skill Falsify"],
    featured: false,
    evaluationStatus: "small synthetic benchmark",
    languages: ["Python", "TypeScript"],
    technologies: ["FastAPI", "React"],
    cardVariant: "accent",
    sourceIds: ["local:skillfalsify:readme", "github:pxnkit/skillfalsify"],
    limitations: [
      "The repository does not claim that active search beats a strong judge on unseen operator families.",
    ],
    relatedProjects: ["memequiv", "worldmodel-lstar", "verifysplit"],
  }),
  defineProject({
    slug: "regimebank",
    title: "RegimeBank",
    shortDescription:
      "Separate memory banks for recurring operating regimes in non-stationary environments.",
    primaryPillar: "Agent Memory and Adaptation",
    tags: ["continual learning", "change points", "recurring regimes"],
    aliases: ["Regime Bank"],
    featured: false,
    evaluationStatus: "recurring contextual-bandit benchmark",
    languages: ["Python"],
    technologies: ["Bayesian change-point detection"],
    cardVariant: "soft",
    sourceIds: ["local:regimebank:readme", "github:pxnkit/regimebank"],
    limitations: [
      "The included benchmark is controlled and does not cover every form of non-stationarity.",
    ],
    relatedProjects: ["freshindex", "hippogate", "currigraph"],
  }),
  defineProject({
    slug: "memintervene",
    title: "MemIntervene",
    shortDescription:
      "Replay-defined causal evaluation of how stored memories change later agent actions.",
    primaryPillar: "Verification and Reliability",
    tags: ["causal evaluation", "replay", "agent memory"],
    aliases: ["Mem Intervene"],
    featured: false,
    evaluationStatus: "deterministic smoke-scale benchmark",
    languages: ["Python", "TypeScript"],
    technologies: ["FastAPI", "React"],
    cardVariant: "light",
    sourceIds: ["local:memintervene:readme", "github:pxnkit/memintervene"],
    limitations: [
      "Current results are smoke-scale engineering results, not evidence for broad causal claims.",
    ],
    relatedProjects: ["rka-lab", "memequiv", "trace-mem"],
  }),
  defineProject({
    slug: "certicompress",
    title: "CertiCompress",
    shortDescription:
      "Proof-carrying consolidation for action-coupled agent memory.",
    primaryPillar: "Agent Memory and Adaptation",
    tags: ["memory consolidation", "provenance", "behavior replay"],
    aliases: ["Certi Compress"],
    featured: false,
    evaluationStatus: "deterministic fixtures and replay checks",
    languages: ["Python", "TypeScript"],
    technologies: ["FastAPI", "React"],
    cardVariant: "dark",
    sourceIds: ["local:certicompress:readme", "github:pxnkit/certicompress"],
    limitations: [
      "Certificates cover configured semantic checks and replay probes rather than every downstream behavior.",
    ],
    relatedProjects: ["hippogate", "paramledger", "txnmem"],
  }),
  defineProject({
    slug: "tempo-trust",
    title: "TEMPO-Trust",
    shortDescription:
      "Claim-conditioned online source reliability under drift, copying, and delayed feedback.",
    primaryPillar: "Retrieval and Evidence",
    tags: ["source reliability", "concept drift", "evidence aggregation"],
    aliases: ["Tempo Trust", "TEMPO Trust"],
    featured: false,
    evaluationStatus: "deterministic streaming benchmark",
    languages: ["Python", "TypeScript"],
    technologies: ["FastAPI", "React"],
    cardVariant: "soft",
    sourceIds: ["local:tempo-trust:readme", "github:pxnkit/tempo-trust"],
    limitations: [
      "Trust estimates remain conditional on available audits, copy detection, and configured regimes.",
    ],
    relatedProjects: ["lineagerag", "freshindex", "evidroute"],
  }),
  defineProject({
    slug: "temporags",
    title: "TempoRGS",
    shortDescription:
      "Reader-aware parallel anytime reranker-guided graph search under latency budgets.",
    longDescription:
      "TempoRGS studies how several complementary document-graph frontier regions can be reranked in parallel while an anytime controller returns the best valid ranking before a deadline.",
    primaryPillar: "Retrieval and Evidence",
    tags: ["graph search", "reranking", "RAG"],
    aliases: ["Tempo RGS", "Tempo-RGS"],
    featured: true,
    evaluationStatus: "deterministic MiniTempoRGS smoke fixture",
    languages: ["Python", "TypeScript"],
    technologies: ["FastAPI", "React", "BM25"],
    cardVariant: "accent",
    sourceIds: ["local:temporags:readme", "github:pxnkit/temporags"],
    limitations: [
      "Included measurements are engineering smoke results, not public-benchmark or publication results.",
    ],
    relatedProjects: ["evidroute", "lineagerag", "tempo-trust"],
  }),
  defineProject({
    slug: "paramledger",
    title: "ParamLedger",
    shortDescription:
      "Evidence-governed promotion and rollback for parametric memory updates.",
    primaryPillar: "Agent Memory and Adaptation",
    tags: ["parametric memory", "model governance", "rollback"],
    aliases: ["Param Ledger"],
    featured: false,
    evaluationStatus: "deterministic offline vertical slice",
    languages: ["Python", "TypeScript"],
    technologies: ["SQLite", "FastAPI", "React"],
    cardVariant: "dark",
    sourceIds: ["local:paramledger:readme", "github:pxnkit/paramledger"],
    limitations: [
      "The deterministic reference path does not establish safe promotion for arbitrary model updates.",
    ],
    relatedProjects: ["certicompress", "freshindex", "intentledger"],
  }),
  defineProject({
    slug: "verifysplit",
    title: "VerifySplit",
    shortDescription:
      "Independent-evidence controls for shared failure in generator-verifier systems.",
    longDescription:
      "VerifySplit studies failures where a generator and verifier agree because they inherit the same model, trajectory, or evidence error, using explicit provenance and independent evidence paths.",
    primaryPillar: "Verification and Reliability",
    tags: ["generator-verifier", "independent evidence", "trajectory search"],
    aliases: ["Verify Split"],
    featured: true,
    evaluationStatus: "synthetic deterministic smoke fixture",
    languages: ["Python", "TypeScript"],
    technologies: ["FastAPI", "React", "SQLite"],
    cardVariant: "accent",
    sourceIds: ["local:verifysplit:readme", "github:pxnkit/verifysplit"],
    limitations: [
      "The included smoke results verify the artifact path and do not establish the full research thesis.",
    ],
    relatedProjects: ["memequiv", "rka-lab", "skillfalsify"],
  }),
  defineProject({
    slug: "evidroute",
    title: "EvidRoute",
    shortDescription:
      "Risk-constrained sequential routing across heterogeneous evidence sources.",
    primaryPillar: "Retrieval and Evidence",
    tags: ["source routing", "selective prediction", "RAG"],
    aliases: ["Evid Route"],
    featured: false,
    evaluationStatus: "deterministic offline reference configuration",
    languages: ["Python", "TypeScript"],
    technologies: ["FastAPI", "React"],
    cardVariant: "light",
    sourceIds: ["local:evidroute:readme", "github:pxnkit/evidroute"],
    limitations: [
      "Risk and stopping behavior are evaluated within configured source and shift models.",
    ],
    relatedProjects: ["temporags", "tempo-trust", "lineagerag"],
  }),
  defineProject({
    slug: "trace-mem",
    title: "TraceMem",
    shortDescription:
      "Causal reliability maps for persistent agents using fault injection, counterfactual replay, and pre-commit verification.",
    primaryPillar: "Verification and Reliability",
    tags: ["causal tracing", "fault injection", "agent memory"],
    aliases: ["Trace Mem", "Trace-Mem"],
    featured: false,
    languages: ["Python"],
    technologies: [],
    cardVariant: "soft",
    sourceIds: ["github:pxnkit/trace-mem"],
    limitations: [
      "Only repository-level public metadata is represented; detailed implementation and evaluation claims are intentionally omitted.",
    ],
    relatedProjects: ["memintervene", "memequiv", "chronicle-guard"],
  }),
  defineProject({
    slug: "barriernow",
    title: "BarrierNow",
    shortDescription:
      "Fresh-evidence route previews under temporary, uncertain, and time-sensitive mobility barriers.",
    primaryPillar: "Retrieval and Evidence",
    tags: ["accessibility", "active evidence", "risk-aware routing"],
    aliases: ["Barrier Now"],
    featured: false,
    evaluationStatus: "synthetic offline fixtures",
    languages: ["Python", "TypeScript"],
    technologies: ["FastAPI", "React"],
    cardVariant: "dark",
    sourceIds: ["local:barriernow:readme", "github:pxnkit/barriernow"],
    limitations: [
      "BarrierNow is not safety certification or emergency navigation and does not establish that a route is safe for a person.",
    ],
    relatedProjects: ["recallresolve", "whofixesthis", "evidroute"],
  }),
  defineProject({
    slug: "whofixesthis",
    title: "WhoFixesThis",
    shortDescription:
      "Temporal responsibility search for evidence-based civic service routing.",
    primaryPillar: "Retrieval and Evidence",
    tags: ["civic technology", "temporal graphs", "service routing"],
    aliases: ["Who Fixes This"],
    featured: false,
    evaluationStatus: "fictional jurisdictions and frozen fixtures",
    languages: ["Python", "TypeScript"],
    technologies: ["FastAPI", "React", "MapLibre"],
    cardVariant: "light",
    sourceIds: ["local:whofixesthis:readme", "github:pxnkit/whofixesthis"],
    limitations: [
      "The demo is not government guidance and never submits a report.",
    ],
    relatedProjects: ["barriernow", "recallresolve", "evidroute"],
  }),
  defineProject({
    slug: "chaffmem",
    title: "ChaffMem",
    shortDescription:
      "Curated rank 1, project 24; verified public details are pending.",
    primaryPillar: "Curated shortlist",
    tags: ["curated shortlist"],
    aliases: ["Chaff Mem"],
    repositoryUrl: undefined,
    featured: false,
    sourceStatus: "pending",
    implementationStatus: undefined,
    claimStatus: "title-only; verified details pending",
    languages: [],
    technologies: [],
    cardVariant: "dark",
    sourceIds: ["ranked:project-24"],
    limitations: [
      "Only the title, rank, and project number are included; no architecture, results, implementation, or repository is inferred.",
    ],
    relatedProjects: [],
  }),
  defineProject({
    slug: "synthesisautopsy",
    title: "SynthesisAutopsy",
    shortDescription:
      "Curated rank 3, project 41; verified public details are pending.",
    primaryPillar: "Curated shortlist",
    tags: ["curated shortlist"],
    aliases: ["Synthesis Autopsy"],
    repositoryUrl: undefined,
    featured: false,
    sourceStatus: "pending",
    implementationStatus: undefined,
    claimStatus: "title-only; verified details pending",
    languages: [],
    technologies: [],
    cardVariant: "soft",
    sourceIds: ["ranked:project-41"],
    limitations: [
      "Only the title, rank, and project number are included; no architecture, results, implementation, or repository is inferred.",
    ],
    relatedProjects: [],
  }),
  defineProject({
    slug: "rowwitness",
    title: "RowWitness",
    shortDescription:
      "Curated rank 4, project 46; verified public details are pending.",
    primaryPillar: "Curated shortlist",
    tags: ["curated shortlist"],
    aliases: ["Row Witness"],
    repositoryUrl: undefined,
    featured: false,
    sourceStatus: "pending",
    implementationStatus: undefined,
    claimStatus: "title-only; verified details pending",
    languages: [],
    technologies: [],
    cardVariant: "light",
    sourceIds: ["ranked:project-46"],
    limitations: [
      "Only the title, rank, and project number are included; no architecture, results, implementation, or repository is inferred.",
    ],
    relatedProjects: [],
  }),
  defineProject({
    slug: "probediff",
    title: "ProbeDiff",
    shortDescription:
      "Curated rank 5, project 45; verified public details are pending.",
    primaryPillar: "Curated shortlist",
    tags: ["curated shortlist"],
    aliases: ["Probe Diff"],
    repositoryUrl: undefined,
    featured: false,
    sourceStatus: "pending",
    implementationStatus: undefined,
    claimStatus: "title-only; verified details pending",
    languages: [],
    technologies: [],
    cardVariant: "accent",
    sourceIds: ["ranked:project-45"],
    limitations: [
      "Only the title, rank, and project number are included; no architecture, results, implementation, or repository is inferred.",
    ],
    relatedProjects: [],
  }),
  defineProject({
    slug: "veriforget",
    title: "VeriForget",
    shortDescription:
      "Curated rank 6, project 35; verified public details are pending.",
    primaryPillar: "Curated shortlist",
    tags: ["curated shortlist"],
    aliases: ["Veri Forget"],
    repositoryUrl: undefined,
    featured: false,
    sourceStatus: "pending",
    implementationStatus: undefined,
    claimStatus: "title-only; verified details pending",
    languages: [],
    technologies: [],
    cardVariant: "dark",
    sourceIds: ["ranked:project-35"],
    limitations: [
      "Only the title, rank, and project number are included; no architecture, results, implementation, or repository is inferred.",
    ],
    relatedProjects: [],
  }),
];

export const featuredProjects: Project[] = projects.filter(
  ({ featured }) => featured,
);

const projectsBySlug = new Map(
  projects.map((project) => [project.slug, project]),
);

export function getProjectBySlug(slug: string): Project | undefined {
  const normalized = normalizeProjectSlug(slug);
  const canonical = projectAliases[normalized] ?? normalized;
  return projectsBySlug.get(canonical);
}
