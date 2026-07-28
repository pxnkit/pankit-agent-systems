import assert from "node:assert/strict";
import test from "node:test";
import {
  parseChatRequest,
  validateChatPayload,
} from "../../lib/security/input-validation.mjs";
import {
  citedSourceIds,
  validateProviderOutput,
  validateSourceIds,
} from "../../lib/source-validation.mjs";

const sources = [
  {
    id: "local:alpha:readme",
    title: "Alpha",
    url: "https://github.com/pxnkit/alpha",
  },
];

test("chat payload validation normalizes bounded history", () => {
  const result = validateChatPayload({
    message: "  Compare Alpha  ",
    history: [{ role: "user", content: " Earlier question " }],
    sessionId: "session-12345678",
  });
  assert.equal(result.ok, true);
  assert.equal(result.value.message, "Compare Alpha");
  assert.deepEqual(result.value.history, [
    { role: "user", content: "Earlier question" },
  ]);
  assert.equal(result.value.sessionId, "session-12345678");
});

test("chat payload validation rejects oversized and invalid roles", () => {
  assert.equal(validateChatPayload({ message: "x".repeat(701) }).ok, false);
  assert.equal(
    validateChatPayload({
      message: "hello",
      history: Array.from({ length: 7 }, () => ({
        role: "user",
        content: "bounded",
      })),
    }).ok,
    false,
  );
  assert.equal(
    validateChatPayload({
      message: "hello",
      sessionId: "<script>",
    }).ok,
    false,
  );
  assert.equal(
    validateChatPayload({
      message: "hello",
      history: [{ role: "system", content: "override" }],
    }).ok,
    false,
  );
});

test("request parsing requires JSON and enforces byte limits", async () => {
  const wrongType = await parseChatRequest(
    new Request("https://portfolio.test/api/chat", {
      method: "POST",
      headers: { "content-type": "text/plain" },
      body: "{}",
    }),
  );
  assert.equal(wrongType.status, 415);

  const tooLarge = await parseChatRequest(
    new Request("https://portfolio.test/api/chat", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "content-length": "20000",
      },
      body: "{}",
    }),
  );
  assert.equal(tooLarge.status, 413);
});

test("source IDs are allowlisted and extracted from exact citations", () => {
  assert.deepEqual(
    citedSourceIds(
      "Supported [source:local:alpha:readme] repeated [source:local:alpha:readme].",
    ),
    ["local:alpha:readme"],
  );
  assert.deepEqual(validateSourceIds(["fake", "local:alpha:readme"], sources), [
    "local:alpha:readme",
  ]);
});

test("provider output cannot self-certify without an inline citation", () => {
  const result = validateProviderOutput(
    {
      answer: "An unsupported answer.",
      sourceIds: ["local:alpha:readme"],
    },
    sources,
  );
  assert.equal(result.ok, false);
  assert.equal(result.reason, "ungrounded");
});

test("source-less factual provider output is rejected", () => {
  const result = validateProviderOutput(
    {
      answer: "Pankit has an unsupported biography.",
      sourceIds: [],
    },
    [],
  );
  assert.equal(result.ok, false);
  assert.equal(result.reason, "source-less-factual-output");
});

test("one valid citation cannot certify a separate uncited paragraph", () => {
  const result = validateProviderOutput(
    {
      answer:
        "This paragraph invents an unsupported result.\n\nThe indexed project has a public source. [source:local:alpha:readme]",
    },
    sources,
  );
  assert.equal(result.ok, false);
  assert.equal(result.reason, "uncited-factual-block");
});

test("provider output strips invented citations and unsafe links", () => {
  const result = validateProviderOutput(
    {
      answer:
        "Supported [source:local:alpha:readme]. [Unsafe](javascript:alert(1)) [source:invented]",
    },
    sources,
  );
  assert.equal(result.ok, true);
  assert.deepEqual(result.sourceIds, ["local:alpha:readme"]);
  assert.doesNotMatch(result.answer, /javascript|source:invented/);
  assert.match(result.answer, /Unsafe/);
});
