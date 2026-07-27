import assert from "node:assert/strict";
import test from "node:test";
import { buildSearchIndex } from "../../scripts/build-search-index.mjs";
import { evaluateChat } from "../../scripts/eval-chat.mjs";
import { syncGithub } from "../../scripts/sync-github.mjs";
import { verifyContentExclusions } from "../../scripts/verify-content-exclusions.mjs";
import { verifyLinks } from "../../scripts/verify-links.mjs";

test("catalog builds a deterministic in-memory search index", async () => {
  const first = await buildSearchIndex({ write: false });
  const second = await buildSearchIndex({ write: false });
  assert.deepEqual(first, second);
  assert.ok(first.documentCount >= 29);
  assert.equal(first.documents.length, first.documentCount);
});

test("generated public content passes exclusion and structural link checks", async () => {
  const [exclusions, links] = await Promise.all([
    verifyContentExclusions(),
    verifyLinks(),
  ]);
  assert.equal(exclusions.ok, true);
  assert.equal(links.ok, true);
  assert.ok(links.checked > 0);
});

test("offline GitHub sync preserves the canonical snapshot schema", async () => {
  const snapshot = await syncGithub({ offline: true, write: false });
  assert.equal(snapshot.schemaVersion, 1);
  assert.equal(snapshot.projectCount, snapshot.projects.length);
  assert.equal(snapshot.syncMode, "snapshot");
  assert.ok(snapshot.projects.length >= 29);
  assert.ok(
    snapshot.projects.every((project) =>
      project.url.startsWith("https://github.com/"),
    ),
  );
});

test("deterministic chat snapshot fallback passes", async () => {
  const result = await evaluateChat();
  assert.equal(result.ok, true);
  assert.ok(result.caseCount >= 5);
  assert.ok(result.results.every((entry) => entry.deterministic));
});
