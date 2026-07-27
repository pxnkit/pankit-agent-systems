import assert from "node:assert/strict";
import test from "node:test";
import {
  buildKnowledgeCorpus,
  dedupeChunks,
  retrieveKnowledge,
} from "../../lib/retrieval.mjs";

const projects = [
  {
    slug: "alpha-memory",
    title: "Alpha Memory",
    aliases: ["AlphaMem"],
    shortDescription: "Transactional memory for concurrent agent teams.",
    tags: ["memory", "transactions"],
    languages: ["TypeScript"],
    technologies: [],
    sourceIds: ["source:alpha"],
    limitations: ["It has only synthetic concurrency fixtures."],
    repositoryUrl: "https://github.com/pxnkit/alpha-memory",
  },
  {
    slug: "beta-search",
    title: "Beta Search",
    aliases: ["BetaSearch"],
    shortDescription: "Evidence retrieval with provenance-aware ranking.",
    tags: ["search", "provenance"],
    languages: ["Python"],
    technologies: [],
    sourceIds: ["source:beta"],
    limitations: ["It does not establish live-web recall quality."],
    repositoryUrl: "https://github.com/pxnkit/beta-search",
  },
];

const rankedProjects = [
  { rank: 1, projectNumber: 24, title: "Alpha Memory", slug: "alpha-memory" },
  { rank: 2, projectNumber: 25, title: "Beta Search", slug: "beta-search" },
];

const chunks = buildKnowledgeCorpus(projects, { chunks: [] });

test("exact project names receive a deterministic boost", () => {
  const results = retrieveKnowledge("What does AlphaMem do?", {
    chunks,
    projects,
    rankedProjects,
  });
  assert.equal(results[0].chunk.projectSlug, "alpha-memory");
  assert.ok(results[0].reasons.includes("name"));
});

test("project numbers resolve to the authoritative ranked slug", () => {
  const results = retrieveKnowledge("Explain project #25", {
    chunks,
    projects,
    rankedProjects,
  });
  assert.equal(results[0].chunk.projectSlug, "beta-search");
  assert.ok(results[0].reasons.includes("project-number"));
});

test("limitation questions prioritize limitation chunks", () => {
  const results = retrieveKnowledge("What are Alpha Memory's limitations?", {
    chunks,
    projects,
    rankedProjects,
  });
  assert.equal(results[0].chunk.kind, "limitation");
  assert.ok(results[0].reasons.includes("limitation"));
});

test("comparisons return distinct projects before duplicate chunks", () => {
  const results = retrieveKnowledge("Compare Alpha Memory versus Beta Search", {
    chunks,
    projects,
    rankedProjects,
    limit: 4,
  });
  assert.deepEqual(
    results
      .slice(0, 2)
      .map((result) => result.chunk.projectSlug)
      .sort(),
    ["alpha-memory", "beta-search"],
  );
});

test("dedupe removes repeated IDs and equivalent text", () => {
  const repeated = { ...chunks[0] };
  const equivalent = { ...chunks[0], id: "different-id" };
  assert.equal(dedupeChunks([chunks[0], repeated, equivalent]).length, 1);
});

test("unrelated multi-term queries abstain", () => {
  const results = retrieveKnowledge("marine archaeology expedition", {
    chunks,
    projects,
    rankedProjects,
  });
  assert.deepEqual(results, []);
});
