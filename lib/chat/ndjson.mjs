/** @param {unknown} event */
export function encodeNdjsonEvent(event) {
  return `${JSON.stringify(event)}\n`;
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
