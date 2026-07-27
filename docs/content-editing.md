# Content editing

Portfolio content has two layers:

- **manual authority** under `data/`, where editorial decisions live;
- **derived artifacts** under `generated/`, where normalized metadata,
  provenance, knowledge chunks, and search structures live.

Edit the authority, refresh the derived artifacts through the repository's
content tooling, inspect the diff, and run `npm run verify:content`. Do not
silently “fix” a generated answer by changing a JSON artifact without changing
its approved source.

## Manual authority

| File                         | Responsibility                                                                                 |
| ---------------------------- | ---------------------------------------------------------------------------------------------- |
| `data/projects.ts`           | Canonical descriptions, categories, status, links, featured state, and approved display fields |
| `data/ranked-projects.ts`    | Deliberate ranking and the rationale or labels shown with it                                   |
| `data/project-allowlist.ts`  | Exact 29-repository ingestion and display boundary                                             |
| `data/project-exclusions.ts` | Exact project exclusions, including local aliases                                              |
| `data/content-exclusions.ts` | Semantic content patterns and fields that must not be indexed or displayed                     |
| `data/project-aliases.ts`    | Approved name normalization; aliases never create allowlist membership                         |

Manual descriptions, categories, featured choices, and ranking always take
precedence over repository metadata. GitHub data may fill an approved metadata
field; it may not rewrite editorial authority.

## Derived artifacts

| File                              | Responsibility                                                  |
| --------------------------------- | --------------------------------------------------------------- |
| `generated/github-projects.json`  | Normalized trusted GitHub metadata for allowlisted projects     |
| `generated/source-manifest.json`  | Approved source identity, provenance, and freshness information |
| `generated/knowledge-chunks.json` | Bounded evidence units used by grounded chat                    |
| `generated/search-index.json`     | Deterministic retrieval representation                          |
| `generated/corpus-version.json`   | Corpus/version fingerprint for cache and evaluation tracking    |
| `generated/assets-manifest.json`  | Approved generated or repository-provided asset metadata        |

Generated files are committed so builds and tests do not depend on live GitHub
availability. A refresh should be deterministic for the same manual data and
source snapshot.

## Source precedence

Resolve a field in this order:

1. manual curated record or explicit exclusion;
2. approved local README or documentation from an exact allowlist member;
3. trusted GitHub repository metadata;
4. omit the field.

Never infer a missing claim from a repository name, topic similarity, source
code, package metadata, or another project's prose.

The safety order is stricter:

1. apply the allowlist gate;
2. apply exact project exclusions, including mapped local names;
3. apply semantic content exclusions;
4. normalize aliases;
5. read approved sources;
6. generate display and retrieval artifacts.

An alias cannot rescue an excluded name or cause an unknown repository to enter
the corpus.

## Standard editing workflow

1. Identify whether the change is editorial, source-derived, ranking,
   exclusion, alias, or writing content.
2. Edit the smallest manual authority file.
3. If the claim comes from a sibling repository, open its README or approved
   documentation as text. Do not run its code, tests, notebooks, containers, or
   data pipeline.
4. Preserve status and limitation language near the affected claim.
5. Refresh trusted GitHub metadata when the approved remote snapshot needs to
   change, then rebuild the local index:

   ```bash
   npm run sync:github
   npm run build:index
   ```

   `sync:github` is limited to exact allowlist members. Neither command may
   fetch or execute arbitrary repository code.

6. Inspect the generated diff. Unexpected new repositories, local paths,
   personal data, large prose changes, or dropped caveats are review blockers.
7. Run:

   ```bash
   npm run verify:content
   npm run typecheck
   npm test
   npm run verify:links
   npm run build
   npm run test:e2e
   npm run test:a11y
   npm run eval:chat
   npm run verify
   ```

8. Open the affected project route and ask at least one chat question whose
   answer depends on the changed content.
9. Commit the manual source change and its generated artifacts together.

`sync:github`, `build:index`, and `verify:content` are the stable package
contracts for refresh and verification. Editors should not depend on an
unversioned internal script path.

## Editing an existing project

For editorial copy or taxonomy, edit `data/projects.ts`. Keep the description
specific enough to distinguish the project, but avoid importing unsupported
performance or novelty claims.

When a README changes:

- refresh only the exact allowlisted project through `npm run sync:github`;
- confirm the source manifest points to the intended README revision;
- review changed chunks for instructions, secrets, personal data, or content
  that belongs outside the portfolio scope;
- retain claim-boundary language such as “prototype,” “synthetic fixture,”
  “smoke result,” or “not validated.”

## Adding a project

The current product contract fixes the allowlist at 29 projects. Adding a
project is a policy change, not routine copy editing.

Before changing membership:

1. obtain an explicit scope decision;
2. confirm it is not an exclusion or alias of an exclusion;
3. add a curated record and approved source;
4. update `data/project-allowlist.ts`;
5. update the project content matrix and corpus tests;
6. refresh generated artifacts and inspect every new chunk;
7. run the complete release gate.

Do not auto-add a newly discovered sibling folder or GitHub repository.

## Excluding a project or content class

Add project-wide exclusions to `data/project-exclusions.ts`, including all
known local and display aliases. Add field or topic exclusions to
`data/content-exclusions.ts`.

Then verify removal from:

- project data and generated GitHub metadata;
- knowledge chunks and search index;
- featured, ranked, and related-project lists;
- suggested questions, route parameters, metadata, RSS, and sitemap;
- chat fixtures and cached evaluation output.

An exclusion should result in deletion from derived artifacts, not a hidden UI
flag that leaves the item retrievable.

## Rankings and featured projects

Rankings are curated interpretation. Change `data/ranked-projects.ts`, record a
brief stable rationale, and check that every referenced slug resolves either to
an allowlisted verified project or to an explicit manual title-only record.
Title-only records may expose rank, project number, and title, but must not
acquire repository or implementation claims through discovery. GitHub stars,
update time, language, or automated scores must not silently reorder this list.

## Writing

Reusable templates live in:

- `content/writing/research-note-template.mdx`;
- `content/writing/project-retrospective-template.md`;
- `content/writing/evaluation-note-template.mdx`.

Start from the closest template, replace all placeholders, and use a stable
slug. Separate implemented behavior, measured evidence, interpretation, and
limitations. Cite the approved project source for project-specific facts.

Do not publish a template route or draft that still contains placeholder
claims.

## Missing sources

`recallresolve` and `trace-mem` are allowlisted but have no sibling README in
the current workspace snapshot. The approved implementation brief for
`recallresolve` supports its scope only; it does not establish implementation or
evaluation status. Trusted repository metadata for `trace-mem` supports only a
repository-level summary. Keep deeper factual fields unavailable until stronger
approved sources are supplied, then follow the standard refresh and review
workflow.

## Review checklist

- Exact repository is allowlisted.
- No exact or semantic exclusion is present.
- Manual fields remain authoritative.
- Each factual claim has a traceable approved source.
- Claim limitations remain adjacent and understandable.
- No local filesystem path, secret, private token, raw IP, or unapproved
  personal detail entered a generated artifact.
- Public links use HTTPS and an approved host.
- Generated diffs are deterministic and expected.
- `npm run verify:content`, `npm run eval:chat`, and the release checks pass.
