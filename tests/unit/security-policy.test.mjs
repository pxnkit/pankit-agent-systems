import assert from "node:assert/strict";
import test from "node:test";
import {
  INDEXED_SCOPE_RESPONSE,
  classifyExcludedQuery,
  containsExcludedSourceContent,
} from "../../lib/content-policy.mjs";
import { classifyLink } from "../../lib/link-policy.mjs";
import {
  getClientIp,
  hashIpAddress,
  hashRateLimitIdentifier,
} from "../../lib/security/ip-hash.mjs";
import { checkSameOrigin } from "../../lib/security/origin.mjs";
import {
  checkRateLimit,
  resetMemoryRateLimits,
} from "../../lib/security/rate-limit.mjs";
import { verifyTurnstile } from "../../lib/security/turnstile.mjs";

const TURNSTILE_ALWAYS_PASS_TEST_SECRET = "1x0000000000000000000000000000000AA";

test("scope policy blocks employment and materials queries exactly", () => {
  assert.equal(
    classifyExcludedQuery("Where does Pankit currently work?"),
    "employment",
  );
  assert.equal(
    classifyExcludedQuery("Describe his nanotechnology research."),
    "materials",
  );
  assert.equal(
    classifyExcludedQuery("What source material supports RKA-Lab?"),
    null,
  );
  assert.equal(
    classifyExcludedQuery("Who does Pankit work for?"),
    "employment",
  );
  assert.match(
    INDEXED_SCOPE_RESPONSE,
    /^This portfolio focuses on Pankit’s work/,
  );
  assert.equal(
    containsExcludedSourceContent("A materials science research role."),
    true,
  );
});

test("link policy accepts internal and GitHub links only", () => {
  assert.equal(classifyLink("/projects/rka-lab").kind, "internal");
  assert.equal(classifyLink("https://github.com/pxnkit/rka-lab").allowed, true);
  assert.equal(classifyLink("javascript:alert(1)").allowed, false);
  assert.equal(classifyLink("https://example.invalid/phishing").allowed, false);
});

test("same-origin helper rejects browser cross-site requests", () => {
  const same = new Request("https://portfolio.test/api/chat", {
    headers: { origin: "https://portfolio.test" },
  });
  const cross = new Request("https://portfolio.test/api/chat", {
    headers: {
      origin: "https://attacker.test",
      "sec-fetch-site": "cross-site",
    },
  });
  assert.equal(checkSameOrigin(same).ok, true);
  assert.equal(checkSameOrigin(cross).ok, false);
});

test("IP extraction prefers Cloudflare and hashes deterministically", async () => {
  const headers = new Headers({
    "cf-connecting-ip": "203.0.113.9",
    "x-forwarded-for": "198.51.100.2",
  });
  assert.equal(getClientIp(headers), "203.0.113.9");
  const first = await hashIpAddress("203.0.113.9", "test-salt");
  const second = await hashIpAddress("203.0.113.9", "test-salt");
  assert.equal(first, second);
  assert.equal(first.length, 64);
  assert.doesNotMatch(first, /203\.0\.113\.9/);
  const session = await hashRateLimitIdentifier(
    "session-12345678",
    "test-salt",
    "browser-session",
  );
  assert.equal(session.length, 64);
  assert.notEqual(session, first);
});

test("fixed-window fallback returns remaining quota and retry timing", async () => {
  resetMemoryRateLimits();
  const options = { key: "test-key", limit: 2, windowMs: 1_000, now: 10_000 };
  const first = await checkRateLimit(options);
  const second = await checkRateLimit(options);
  const third = await checkRateLimit(options);
  assert.equal(first.allowed, true);
  assert.equal(first.count, 1);
  assert.equal(first.remaining, 1);
  assert.equal(second.remaining, 0);
  assert.equal(third.allowed, false);
  assert.equal(third.retryAfterSeconds, 1);
});

test("Turnstile is optional locally and fail-closed when configured", async () => {
  assert.deepEqual(await verifyTurnstile({}), {
    ok: true,
    skipped: true,
    reason: "not-configured",
  });
  assert.equal(
    (
      await verifyTurnstile({
        secret: TURNSTILE_ALWAYS_PASS_TEST_SECRET,
      })
    ).ok,
    false,
  );

  const accepted = await verifyTurnstile({
    secret: TURNSTILE_ALWAYS_PASS_TEST_SECRET,
    token: "client-token",
    expectedAction: "portfolio-chat",
    expectedHostname: "portfolio.test",
    fetcher: async () =>
      Response.json({
        success: true,
        action: "portfolio-chat",
        hostname: "portfolio.test",
      }),
  });
  assert.equal(accepted.ok, true);
});
