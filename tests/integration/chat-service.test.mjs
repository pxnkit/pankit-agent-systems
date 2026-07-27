import assert from "node:assert/strict";
import { resolve } from "node:path";
import test from "node:test";
import { createChatService } from "../../lib/chat/chat-service.mjs";
import { DeterministicMockProvider } from "../../lib/chat/deterministic-mock-provider.mjs";
import { INDEXED_SCOPE_RESPONSE } from "../../lib/content-policy.mjs";
import {
  projectRoot,
  readLiteralExport,
  readOptionalJson,
} from "../../scripts/_safe-project-data.mjs";

const [projects, rankedProjects, knowledgeEnvelope] = await Promise.all([
  readLiteralExport(resolve(projectRoot, "data/projects.ts"), "projects"),
  readLiteralExport(
    resolve(projectRoot, "data/ranked-projects.ts"),
    "rankedProjects",
  ),
  readOptionalJson(resolve(projectRoot, "generated/knowledge-chunks.json"), {
    chunks: [],
  }),
]);

function service(provider = new DeterministicMockProvider()) {
  return createChatService({
    projects,
    rankedProjects,
    knowledgeEnvelope,
    provider,
  });
}

test("real catalog answers exact project names with validated sources", async () => {
  const result = await service().answer({
    message: "What does RKA-Lab evaluate?",
    history: [],
  });
  assert.ok(result.sources.length > 0);
  assert.ok(result.sourceIds.length > 0);
  assert.match(result.answer, /\[source:local:rka-lab:readme\]/);
  assert.ok(
    result.sourceIds.every((id) =>
      result.sources.some((source) => source.id === id),
    ),
  );
});

test("real ranked project numbers resolve without inventing details", async () => {
  const result = await service().answer({
    message: "What is project #24?",
    history: [],
  });
  assert.ok(result.sources.some((source) => source.projectSlug === "chaffmem"));
  assert.match(
    result.answer,
    /verified public details are pending|title.*rank/i,
  );
});

test("scope-blocked queries never call a provider", async () => {
  let calls = 0;
  const result = await service({
    id: "must-not-run",
    async generate() {
      calls += 1;
      throw new Error("Provider should not run.");
    },
  }).answer({
    message: "Who is Pankit’s current employer?",
    history: [],
  });
  assert.equal(calls, 0);
  assert.equal(result.answer, INDEXED_SCOPE_RESPONSE);
  assert.deepEqual(result.sources, []);
});

test("provider failures fall back to retrieval-only output", async () => {
  const result = await service({
    id: "failing-provider",
    async generate() {
      throw new Error("offline");
    },
  }).answer({
    message: "Explain TxnMem",
    history: [],
  });
  assert.equal(result.mode, "retrieval-only");
  assert.ok(result.sources.length > 0);
  assert.match(result.answer, /\[source:/);
});

test("invented provider citations are rejected and replaced", async () => {
  const result = await service({
    id: "ungrounded-provider",
    async generate() {
      return {
        answer:
          "A fabricated claim [source:invented]. [Model link](https://example.invalid/model)",
        sourceIds: ["invented"],
      };
    },
  }).answer({
    message: "Explain TxnMem",
    history: [],
  });
  assert.equal(result.mode, "retrieval-only");
  assert.doesNotMatch(result.answer, /invented|example\.invalid/);
  assert.ok(result.sources.length > 0);
});

test("unrelated questions abstain deterministically", async () => {
  const chat = service();
  const first = await chat.answer({
    message: "What marine archaeology expeditions are documented?",
    history: [],
  });
  const second = await chat.answer({
    message: "What marine archaeology expeditions are documented?",
    history: [],
  });
  assert.deepEqual(first, second);
  assert.deepEqual(first.sources, []);
  assert.match(first.answer, /couldn.?t find enough evidence/i);
});
