import assert from "node:assert/strict";
import test from "node:test";
import {
  CORPUS_INVARIANTS,
  parseContentSeed,
} from "../../scripts/build-corpus.mjs";

test("content seed parser emits stable source-linked chunks", () => {
  const seed = parseContentSeed(
    `---
{"sourceId":"curated:test","kind":"theme","title":"Test seed","url":"/portfolio","tags":["test"]}
---

# Test seed

## First idea

Evidence should remain attributable.

## Second idea

An agent should abstain when evidence is insufficient.
`,
    "content/test.mdx",
  );

  assert.equal(seed.metadata.sourceId, "curated:test");
  assert.deepEqual(
    seed.chunks.map(({ id }) => id),
    ["content:test:first-idea", "content:test:second-idea"],
  );
  assert.ok(seed.chunks.every(({ sourceId }) => sourceId === "curated:test"));
});

test("content seed parser rejects executable embeds", () => {
  assert.throws(
    () =>
      parseContentSeed(
        `---
{"sourceId":"curated:test","kind":"theme","title":"Test seed","url":"/portfolio","tags":["test"]}
---

## Unsafe

<script>alert("no")</script>
`,
        "content/test.mdx",
      ),
    /executable embeds are not allowed/,
  );
});

test("release minima are hard-coded safety invariants", () => {
  assert.equal(CORPUS_INVARIANTS.minimumChunkCount, 60);
  assert.equal(CORPUS_INVARIANTS.minimumVerifiedPublicProjects, 15);
  assert.equal(CORPUS_INVARIANTS.minimumProfileChunks, 2);
  assert.equal(CORPUS_INVARIANTS.minimumThemeChunks, 4);
  assert.equal(CORPUS_INVARIANTS.mandatoryRetrievalAssertionCount, 8);
});
