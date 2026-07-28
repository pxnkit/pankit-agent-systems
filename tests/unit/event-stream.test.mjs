import assert from "node:assert/strict";
import test from "node:test";
import { encodeSseEvent, sseStream } from "../../lib/chat/ndjson.mjs";
import {
  streamedResponseText,
  workersAiTextDeltas,
} from "../../lib/chat/workers-ai-provider.mjs";

test("SSE events preserve the typed JSON payload", () => {
  const encoded = encodeSseEvent({
    type: "text-delta",
    text: "grounded answer",
  });
  assert.equal(
    encoded,
    'event: text-delta\ndata: {"type":"text-delta","text":"grounded answer"}\n\n',
  );
});

test("SSE stream emits one ordered completion event", async () => {
  const events = [
    { type: "metadata", requestId: "request-1" },
    { type: "text-delta", text: "Answer." },
    { type: "completion", requestId: "request-1", status: "complete" },
  ];
  const response = new Response(sseStream(events));
  const body = await response.text();
  assert.match(body, /^event: metadata/m);
  assert.match(body, /event: text-delta/);
  assert.equal(body.match(/event: completion/g)?.length, 1);
  assert.ok(
    body.indexOf("event: metadata") < body.indexOf("event: completion"),
  );
});

test("Workers AI SSE is parsed as real model deltas", async () => {
  assert.equal(
    streamedResponseText({
      choices: [{ delta: { content: "evidence" } }],
    }),
    "evidence",
  );
  const encoder = new TextEncoder();
  const upstream = new ReadableStream({
    start(controller) {
      controller.enqueue(
        encoder.encode(
          'data: {"choices":[{"delta":{"content":"Grounded "}}]}\n\n',
        ),
      );
      controller.enqueue(
        encoder.encode(
          'data: {"choices":[{"delta":{"content":"answer."}}]}\n\ndata: [DONE]\n\n',
        ),
      );
      controller.close();
    },
  });
  const deltas = [];
  for await (const delta of workersAiTextDeltas(upstream)) {
    deltas.push(delta);
  }
  assert.deepEqual(deltas, ["Grounded ", "answer."]);
});
