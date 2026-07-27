import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { createChatService } from "../lib/chat/chat-service.mjs";
import { DeterministicMockProvider } from "../lib/chat/deterministic-mock-provider.mjs";
import { INDEXED_SCOPE_RESPONSE } from "../lib/content-policy.mjs";
import { validateProjectCollection } from "../lib/project-validation.mjs";
import {
  assertProjectPath,
  parseArguments,
  projectRoot,
  readLiteralExport,
  readOptionalJson,
} from "./_safe-project-data.mjs";

/**
 * @param {Array<Record<string, unknown>>} projects
 * @param {Array<Record<string, unknown>>} rankedProjects
 */
function fallbackCases(projects, rankedProjects) {
  const cases = [
    {
      id: "employment-scope",
      query: "Where does Pankit currently work and what is his job title?",
      expect: "scope",
    },
    {
      id: "materials-scope",
      query:
        "Tell me about Pankit’s nanotechnology and materials science work.",
      expect: "scope",
    },
    {
      id: "unknown-abstention",
      query:
        "What does the portfolio say about marine archaeology expeditions?",
      expect: "abstain",
    },
  ];
  const first = projects[0];
  if (first) {
    cases.push({
      id: "exact-project-name",
      query: `What does ${first.title} do?`,
      expect: "grounded",
    });
    if (Array.isArray(first.limitations) && first.limitations.length > 0) {
      cases.push({
        id: "limitation",
        query: `What are the limitations of ${first.title}?`,
        expect: "grounded",
      });
    }
  }
  const ranked = rankedProjects[0];
  if (ranked) {
    cases.push({
      id: "project-number",
      query: `Explain project #${ranked.projectNumber}.`,
      expect: "grounded",
    });
  }
  if (projects.length > 1) {
    cases.push({
      id: "comparison",
      query: `Compare ${projects[0].title} versus ${projects[1].title}.`,
      expect: "grounded",
    });
  }
  return cases;
}

/** @param {Record<string, unknown>} testCase @param {Awaited<ReturnType<ReturnType<typeof createChatService>["answer"]>>} result */
function evaluateCase(testCase, result) {
  if (testCase.expect === "scope") {
    return (
      result.answer === INDEXED_SCOPE_RESPONSE && result.sources.length === 0
    );
  }
  if (testCase.expect === "abstain") {
    return (
      result.sources.length === 0 &&
      /couldn.?t find enough evidence|do not establish/i.test(result.answer)
    );
  }
  if (testCase.expect === "grounded") {
    return (
      result.sources.length > 0 &&
      result.sourceIds.length > 0 &&
      result.sourceIds.every((id) =>
        result.sources.some((source) => source.id === id),
      )
    );
  }
  return false;
}

/**
 * @param {{
 *  projectsPath?: string,
 *  rankedProjectsPath?: string,
 *  knowledgePath?: string,
 *  casesPath?: string
 * }} [options]
 */
export async function evaluateChat(options = {}) {
  const projectsPath = assertProjectPath(
    options.projectsPath ?? resolve(projectRoot, "data/projects.ts"),
  );
  const rankedProjectsPath = assertProjectPath(
    options.rankedProjectsPath ??
      resolve(projectRoot, "data/ranked-projects.ts"),
  );
  const knowledgePath = assertProjectPath(
    options.knowledgePath ??
      resolve(projectRoot, "generated/knowledge-chunks.json"),
  );
  const casesPath = assertProjectPath(
    options.casesPath ?? resolve(projectRoot, "data/evals/chat-eval.json"),
  );
  const [rawProjects, rankedProjects, knowledge, snapshot] = await Promise.all([
    readLiteralExport(projectsPath, "projects"),
    readLiteralExport(rankedProjectsPath, "rankedProjects"),
    readOptionalJson(knowledgePath, { version: 1, chunks: [] }),
    readOptionalJson(casesPath, null),
  ]);
  const validation = validateProjectCollection(rawProjects);
  if (validation.issues.length > 0) {
    throw new Error(
      `Project validation failed before evaluation:\n${validation.issues
        .map((issue) => `- ${issue.path}: ${issue.message}`)
        .join("\n")}`,
    );
  }
  const cases =
    snapshot &&
    typeof snapshot === "object" &&
    Array.isArray(snapshot.cases) &&
    snapshot.cases.length > 0
      ? snapshot.cases
      : fallbackCases(validation.projects, rankedProjects);
  const service = createChatService({
    projects: validation.projects,
    rankedProjects,
    knowledgeEnvelope: knowledge,
    provider: new DeterministicMockProvider(),
  });

  const results = [];
  for (const testCase of cases) {
    const first = await service.answer({
      message: String(testCase.query),
      history: [],
    });
    const second = await service.answer({
      message: String(testCase.query),
      history: [],
    });
    const deterministic = JSON.stringify(first) === JSON.stringify(second);
    results.push({
      id: String(testCase.id),
      passed: deterministic && evaluateCase(testCase, first),
      deterministic,
      mode: first.mode,
      sourceCount: first.sources.length,
    });
  }

  return {
    ok: results.every((result) => result.passed),
    caseCount: results.length,
    results,
  };
}

async function main() {
  const args = parseArguments(process.argv.slice(2));
  const result = await evaluateChat({
    casesPath:
      typeof args.get("snapshot") === "string"
        ? resolve(projectRoot, args.get("snapshot"))
        : undefined,
  });
  result.results.forEach((entry) =>
    console.log(`${entry.passed ? "PASS" : "FAIL"} ${entry.id}`),
  );
  console.log(
    `${result.ok ? "Chat evaluation passed" : "Chat evaluation failed"} (${result.caseCount} cases).`,
  );
  if (!result.ok) process.exitCode = 1;
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  await main();
}
