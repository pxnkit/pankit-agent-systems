/** @param {unknown} event */
export function encodeNdjsonEvent(event) {
  return `${JSON.stringify(event)}\n`;
}

/** @param {Record<string, unknown>} event */
export function encodeSseEvent(event) {
  const type =
    typeof event.type === "string" && /^[a-z][a-z0-9-]*$/i.test(event.type)
      ? event.type
      : "message";
  return `event: ${type}\ndata: ${JSON.stringify(event)}\n\n`;
}

/** @param {string} answer @param {number} [maximumCharacters] */
export function answerDeltas(answer, maximumCharacters = 120) {
  const maximum = Math.max(24, Math.min(500, maximumCharacters));
  const words = answer.match(/\S+\s*/g) ?? [];
  const deltas = [];
  let current = "";
  for (const word of words) {
    if (current && current.length + word.length > maximum) {
      deltas.push(current);
      current = "";
    }
    current += word;
  }
  if (current) deltas.push(current);
  return deltas.length > 0 ? deltas : [answer];
}

/**
 * @param {Array<Record<string, unknown>>} events
 */
export function ndjsonStream(events) {
  const encoder = new TextEncoder();
  return new ReadableStream({
    start(controller) {
      for (const event of events) {
        controller.enqueue(encoder.encode(encodeNdjsonEvent(event)));
      }
      controller.close();
    },
  });
}

/**
 * Enqueue one validated event for each stream pull. This keeps the wire format
 * standards-compliant while allowing the client to render incrementally.
 *
 * @param {Array<Record<string, unknown>>} events
 */
export function sseStream(events) {
  const encoder = new TextEncoder();
  let index = 0;
  return new ReadableStream({
    pull(controller) {
      if (index >= events.length) {
        controller.close();
        return;
      }
      controller.enqueue(encoder.encode(encodeSseEvent(events[index])));
      index += 1;
    },
  });
}
