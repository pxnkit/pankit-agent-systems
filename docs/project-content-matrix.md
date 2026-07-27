# Project content matrix

The portfolio has an explicit allowlist of **29 repositories**. Inclusion is a
content and retrieval decision, not a claim that every project is production
ready or scientifically validated. Project status and limitations must stay
attached to the claims extracted from each repository README.

Snapshot date: 2026-07-27.

## Allowlisted repositories

|   # | Repository                | Indexed focus                                                                    | Inclusion basis and source status                                                                 |
| --: | ------------------------- | -------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
|   1 | `rka-lab`                 | Recognition, recall, source recollection, and action evaluation for agent memory | Core memory-evaluation work; sibling README available                                             |
|   2 | `txnmem`                  | Transactional shared memory and concurrency semantics for agent teams            | Core reliable-memory infrastructure; sibling README available                                     |
|   3 | `chronicle-guard`         | Source-aware multimodal recall under misleading or updating language             | Core memory-integrity evaluation; sibling README available                                        |
|   4 | `intentledger`            | Cancellation-safe prospective memory and intention lifecycle checks              | Core long-horizon memory and execution safety; sibling README available                           |
|   5 | `freshindex`              | Budgeted proactive verification of mutable memories                              | Core freshness and verification policy; sibling README available                                  |
|   6 | `recallresolve`           | Evidence-first resolution of exact product recall variants                       | Approved implementation brief supports scope only; implementation and evaluation are not asserted |
|   7 | `hippogate`               | Decision-theoretic episodic retention, probing, consolidation, or forgetting     | Core adaptive-memory policy; sibling README available                                             |
|   8 | `hypothesisops`           | Safe sequential diagnosis using competing hypotheses and bounded probes          | Search-guided reasoning and reliable action; sibling README available                             |
|   9 | `methodchain`             | Evidence-linked reconstruction of procedures across cited documents              | Provenance-aware search and structured evidence; sibling README available                         |
|  10 | `changepilot`             | Version-aware dependency migration with a closed patch contract                  | Reliable agent execution and verification; sibling README available                               |
|  11 | `memequiv`                | Executable equivalence contracts for persistent memory behavior                  | Core memory correctness evaluation; sibling README available                                      |
|  12 | `currigraph`              | Online curriculum selection through a learned transfer graph                     | Test-time learning and experience selection; sibling README available                             |
|  13 | `communicate-to-remember` | Joint routing of information to agents and memory                                | Multi-agent memory and communication policy; sibling README available                             |
|  14 | `scopeguard`              | Tool-argument-level authorization of memory influence                            | Memory safety and reliable tool use; sibling README available                                     |
|  15 | `worldmodel-lstar`        | Active learning of hidden tool behavior before planning                          | Search-guided reasoning and pre-action verification; sibling README available                     |
|  16 | `lineagerag`              | Copy-aware evidence corroboration using document lineage                         | Retrieval, provenance, and verification; sibling README available                                 |
|  17 | `robustask`               | Clarification decisions when user answers may be unreliable                      | Decision-making under uncertainty and calibrated abstention; sibling README available             |
|  18 | `skillfalsify`            | Minimal-counterexample discovery for procedural memory                           | Selective procedure reuse and negative-transfer testing; sibling README available                 |
|  19 | `regimebank`              | Separate, reactivatable memories for recurring operating regimes                 | Lifelong adaptation under distribution shifts; sibling README available                           |
|  20 | `memintervene`            | Causal interventions on memory followed by controlled replay                     | Core causal memory evaluation; sibling README available                                           |
|  21 | `certicompress`           | Proof-carrying memory consolidation with provenance and replay                   | Safe compression and consolidation; sibling README available                                      |
|  22 | `tempo-trust`             | Claim-conditioned source reliability under drift and copying                     | Evidence trust, temporal validity, and abstention; sibling README available                       |
|  23 | `temporags`               | Parallel anytime reranker-guided graph search under deadlines                    | Budget-aware retrieval and reader-aware stopping; sibling README available                        |
|  24 | `paramledger`             | Evidence-governed promotion and rollback of parametric memory                    | Test-time adaptation with provenance and safety gates; sibling README available                   |
|  25 | `verifysplit`             | Independent-evidence verification for generator-verifier systems                 | Verification and shared-failure control; sibling README available                                 |
|  26 | `evidroute`               | Risk-constrained sequential evidence routing                                     | Adaptive retrieval, selective risk, and abstention; sibling README available                      |
|  27 | `trace-mem`               | Causal reliability maps using fault injection and counterfactual replay          | Trusted repository metadata only; detailed implementation and evaluation claims are omitted       |
|  28 | `barriernow`              | Evidence-bounded route previews under temporary mobility barriers                | Applied evidence routing and calibrated abstention; sibling README available                      |
|  29 | `whofixesthis`            | Evidence-based civic service routing with temporal responsibility                | Applied search, provenance, and abstention; sibling README available                              |

`recallresolve` and `trace-mem` have narrower evidence than the sibling-README
projects. The former has an approved implementation brief that supports its
research scope but not implementation or evaluation claims. The latter has
trusted repository-level metadata only. Their cards and chat answers must keep
those limits explicit until stronger approved sources are added.

## Manual title-only shortlist entries

Five additional ranked entries are manual editorial records, not allowlisted
repository ingestions. Only the stated rank, project number, and title are
approved until stronger public evidence is added.

| Rank | Project number | Title              | Evidence boundary          |
| ---: | -------------: | ------------------ | -------------------------- |
|    1 |             24 | `ChaffMem`         | Manual title and rank only |
|    3 |             41 | `SynthesisAutopsy` | Manual title and rank only |
|    4 |             46 | `RowWitness`       | Manual title and rank only |
|    5 |             45 | `ProbeDiff`        | Manual title and rank only |
|    6 |             35 | `VeriForget`       | Manual title and rank only |

Rank 2 is `MemEquiv`, already covered by the 29-repository allowlist above.
These five entries do not change that allowlist's size.

## Explicit exclusions

Exclusions override discovery, naming similarity, links, and content found in
other repositories. These names must not enter generated cards, search indexes,
suggested prompts, related-project lists, metadata, or chat answers.

| Name          | Local mapping               | Reason                                                                               |
| ------------- | --------------------------- | ------------------------------------------------------------------------------------ |
| `matscisynth` | `matscisynth/`              | Explicitly excluded by the project brief and outside the indexed portfolio focus     |
| `dosemirror`  | `dosemirror/`               | Explicitly excluded by the project brief and outside the indexed portfolio focus     |
| `fidelityttt` | `fidelityttt-lab/`          | Explicitly excluded by the project brief; the local folder alias is excluded too     |
| `NovelNest`   | No sibling repository found | Explicitly excluded by the project brief and unrelated to the indexed research focus |

The profile repository and any other sibling directory are simply outside the
allowlist; they are not additional members of the four-name explicit exclusion
set.

## Interpretation rules

1. An exact explicit exclusion wins over every other rule.
2. Only exact allowlist members are candidates for ingestion.
3. A sibling README supports factual extraction; source code is never executed.
4. Missing source evidence produces an omission or an explicit unavailable
   state, never a guessed description.
5. README caveats such as “prototype,” “synthetic,” “smoke,” “offline,” or “not
   validated” travel with any related capability or result claim.
6. Generated files must preserve a repository identifier and source path so a
   displayed fact can be traced back to its approved source.
