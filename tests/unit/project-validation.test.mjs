import assert from "node:assert/strict";
import test from "node:test";
import {
  assertValidPortfolioData,
  validateProject,
  validateProjectCollection,
  validateRankedProjects,
} from "../../lib/project-validation.mjs";

function validProject(overrides = {}) {
  return {
    slug: "memory-lab",
    title: "Memory Lab",
    shortDescription: "A source-grounded agent memory evaluation project.",
    primaryPillar: "Agent memory",
    tags: ["memory", "evaluation"],
    aliases: ["MemoryLab"],
    repositoryUrl: "https://github.com/pxnkit/memory-lab",
    featured: true,
    sourceStatus: "verified",
    languages: ["Python"],
    technologies: ["FastAPI"],
    cardVariant: "light",
    sourceIds: ["local:memory-lab:readme"],
    limitations: ["The included fixture is intentionally small."],
    relatedProjects: [],
    ...overrides,
  };
}

test("accepts a complete authoritative project record", () => {
  const result = validateProject(validProject());
  assert.equal(result.ok, true);
  assert.equal(result.value.slug, "memory-lab");
  assert.deepEqual(result.value.tags, ["memory", "evaluation"]);
});

test("rejects unsafe links and excluded source content", () => {
  const result = validateProject(
    validProject({
      repositoryUrl: "javascript:alert(1)",
      longDescription: "A materials science and nanotechnology research role.",
    }),
  );
  assert.equal(result.ok, false);
  assert.ok(result.issues.some((issue) => issue.code === "url"));
  assert.ok(result.issues.some((issue) => issue.code === "excluded_content"));
});

test("collection validation rejects duplicate slugs", () => {
  const result = validateProjectCollection([
    validProject(),
    validProject({ title: "Duplicate" }),
  ]);
  assert.equal(result.ok, false);
  assert.equal(result.projects.length, 1);
  assert.ok(result.issues.some((issue) => issue.code === "duplicate"));
});

test("ranked project validation checks unique references", () => {
  const result = validateRankedProjects(
    [
      { rank: 1, projectNumber: 24, title: "Memory Lab", slug: "memory-lab" },
      { rank: 1, projectNumber: 24, title: "Unknown", slug: "unknown" },
    ],
    ["memory-lab"],
  );
  assert.equal(result.ok, false);
  assert.ok(result.issues.some((issue) => issue.code === "reference"));
  assert.ok(
    result.issues.filter((issue) => issue.code === "duplicate").length >= 2,
  );
});

test("assertion returns normalized valid collections", () => {
  const result = assertValidPortfolioData(
    [validProject()],
    [{ rank: 1, projectNumber: 7, title: "Memory Lab", slug: "memory-lab" }],
  );
  assert.equal(result.projects.length, 1);
  assert.equal(result.rankedProjects.length, 1);
});
