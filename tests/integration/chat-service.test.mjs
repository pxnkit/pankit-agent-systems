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

const [projects, rankedProjects, knowledgeEnvelope, sourceManifest] =
  await Promise.all([
    readLiteralExport(resolve(projectRoot, "data/projects.ts"), "projects"),
    readLiteralExport(
      resolve(projectRoot, "data/ranked-projects.ts"),
      "rankedProjects",
    ),
    readOptionalJson(resolve(projectRoot, "generated/knowledge-chunks.json"), {
      chunks: [],
    }),
    readOptionalJson(resolve(projectRoot, "generated/source-manifest.json"), {
      sources: [],
    }),
  ]);

function service(provider = new DeterministicMockProvider()) {
  return createChatService({
    projects,
    rankedProjects,
    knowledgeEnvelope,
    sourceManifest,
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
    message: "Which indexed systems use shared transactional state?",
    history: [],
  });
  assert.equal(result.mode, "retrieval-only");
  assert.equal(result.fallbackUsed, true);
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
    message: "Which indexed systems use shared transactional state?",
    history: [],
  });
  assert.equal(result.mode, "retrieval-only");
  assert.doesNotMatch(result.answer, /invented|example\.invalid/);
  assert.ok(result.sources.length > 0);
});

test("unrelated questions abstain deterministically without a generic retry loop", async () => {
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
  assert.match(first.answer, /indexed portfolio sources do not establish/i);
});

test("canonical identity and portfolio overview remain concise and sourced", async () => {
  const identity = await service().answer({
    message: "Who is Pankit?",
    history: [],
  });
  assert.equal(identity.mode, "canonical");
  assert.match(identity.answer, /Pankit Brahmkhatri/);
  assert.match(identity.answer, /Master'?s CS student at TU Dresden/i);
  assert.match(identity.answer, /agent memory/i);
  assert.deepEqual(identity.sourceIds, ["curated:profile"]);

  const overview = await service().answer({
    message: "What does Pankit work on?",
    history: [],
  });
  assert.match(overview.answer, /information retrieval/i);
  assert.match(overview.answer, /test-time learning/i);
  assert.ok(overview.sourceIds.includes("curated:profile"));
});

test("canonical connection and theme answers cover the complete research map", async () => {
  const connection = await service().answer({
    message: "How do the projects connect into a research agenda?",
    history: [],
  });
  for (const phrase of [
    "memory is treated as a decision system",
    "recognition, recall, source, and action",
    "concurrency",
    "temporal validity",
    "consolidation and forgetting",
    "correction",
    "causal influence",
    "scope",
    "provenance",
    "parameter promotion",
  ]) {
    assert.match(connection.answer.toLowerCase(), new RegExp(phrase));
  }
  assert.deepEqual(connection.sourceIds, [
    "curated:research-overview",
    "curated:project-map",
  ]);

  const themes = await service().answer({
    message: "List the portfolio themes.",
    history: [],
  });
  assert.match(themes.answer, /agent memory and adaptation/i);
  assert.match(themes.answer, /information retrieval and evidence/i);
  assert.match(themes.answer, /reliable tool agents/i);
  assert.deepEqual(themes.sourceIds, ["curated:research-themes"]);
});

test("canonical catalog, navigation, GitHub, and pending answers use curated sources", async () => {
  const count = await service().answer({
    message: "How many projects are indexed?",
    history: [],
  });
  assert.match(count.answer, /34 indexed project records/i);
  assert.match(count.answer, /29 verified public projects/i);
  assert.match(count.answer, /5 pending title-only records/i);

  const site = await service().answer({
    message: "What is this site about?",
    history: [],
  });
  assert.ok(site.sourceIds.includes("curated:site-scope"));

  const github = await service().answer({
    message: "What is Pankit’s GitHub?",
    history: [],
  });
  assert.match(github.answer, /github\.com\/pxnkit/i);
  assert.deepEqual(github.sourceIds, ["curated:site-scope"]);

  const pending = await service().answer({
    message: "Which shortlist projects are pending verification?",
    history: [],
  });
  assert.match(pending.answer, /pending|title-only/i);
  assert.ok(
    pending.sourceIds.some((id) =>
      ["manual:project-ranking", "manual:ranked-projects"].includes(id),
    ),
  );
});

test("punctuation-safe comparison includes every named project", async () => {
  const result = await service().answer({
    message: "Compare RKA-Lab with MemIntervene.",
    history: [],
  });
  assert.equal(result.intent, "compare");
  assert.ok(result.sources.some((source) => source.projectSlug === "rka-lab"));
  assert.ok(
    result.sources.some((source) => source.projectSlug === "memintervene"),
  );
  assert.match(result.answer, /RKA-Lab/i);
  assert.match(result.answer, /MemIntervene/i);
});

test("Cloudflare quota errors fall back with a nonsecret reason", async () => {
  const error = Object.assign(new Error("daily quota exhausted"), {
    status: 429,
  });
  const result = await service({
    id: "cloudflare",
    aiMode: "cloudflare",
    configured: true,
    async generate() {
      throw error;
    },
  }).answer({
    message: "Which indexed systems use shared transactional state?",
    history: [],
  });
  assert.equal(result.mode, "retrieval-only");
  assert.equal(result.fallbackUsed, true);
  assert.equal(result.fallbackReason, "provider-quota-or-capacity");
  assert.ok(result.sources.length > 0);
});

test("unknown grounded questions prepare a real provider stream", () => {
  let streamCalls = 0;
  const chat = service({
    id: "cloudflare",
    aiMode: "cloudflare",
    configured: true,
    async generate() {
      throw new Error("The buffered generation path should not run.");
    },
    async stream() {
      streamCalls += 1;
      return {
        stream: new ReadableStream({
          start(controller) {
            controller.close();
          },
        }),
      };
    },
  });
  const plan = chat.prepareStreamingAnswer({
    message: "Which indexed systems use shared transactional state?",
    history: [],
  });

  assert.ok(plan);
  assert.equal(plan.aiMode, "cloudflare");
  assert.equal(plan.providerId, "cloudflare");
  assert.ok(plan.sources.length > 0);
  assert.match(plan.providerInput.systemPrompt, /indexed evidence/i);
  assert.equal(streamCalls, 0);
});

test("canonical identity stays deterministic even when streaming is available", () => {
  const chat = service({
    id: "cloudflare",
    aiMode: "cloudflare",
    configured: true,
    async generate() {
      throw new Error("Canonical answers should not call the provider.");
    },
    async stream() {
      throw new Error("Canonical answers should not start a stream.");
    },
  });

  assert.equal(
    chat.prepareStreamingAnswer({ message: "Who is Pankit?", history: [] }),
    null,
  );
});
