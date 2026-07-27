import { isComparisonQuery, isLimitationQuery } from "../retrieval.mjs";

/** @param {string} value @param {number} maximum */
function compact(value, maximum) {
  const clean = value.replace(/\s+/g, " ").trim();
  if (clean.length <= maximum) return clean;
  const shortened = clean.slice(0, maximum - 1);
  const boundary = shortened.lastIndexOf(" ");
  return `${shortened.slice(0, Math.max(boundary, maximum * 0.7))}…`;
}

/**
 * This provider performs no network request. Its output is deliberately
 * extractive and therefore remains useful in local development and outages.
 */
export class RetrievalOnlyProvider {
  constructor() {
    this.id = "retrieval-only";
  }

  /**
   * @param {{message: string, sources: Array<{id: string, title: string, excerpt: string, projectSlug?: string}>}} input
   */
  async generate(input) {
    if (input.sources.length === 0) {
      return {
        answer:
          "I couldn’t find enough evidence in the indexed portfolio sources to answer that.",
        sourceIds: [],
      };
    }

    const sources = input.sources.slice(
      0,
      isComparisonQuery(input.message) ? 4 : 3,
    );
    const sourceIds = sources.map((source) => source.id);
    if (isComparisonQuery(input.message) && sources.length > 1) {
      return {
        answer: [
          "Here is a source-grounded comparison from the indexed portfolio:",
          ...sources.map(
            (source) =>
              `- **${source.title}**: ${compact(source.excerpt, 260)} [source:${source.id}]`,
          ),
          "The indexed sources support these project-level differences; they do not establish a broader ranking.",
        ].join("\n"),
        sourceIds,
      };
    }

    const lead = isLimitationQuery(input.message)
      ? "The indexed portfolio records these limitations:"
      : "The most relevant indexed portfolio evidence is:";
    return {
      answer: [
        lead,
        ...sources.map(
          (source) =>
            `- **${source.title}**: ${compact(source.excerpt, 320)} [source:${source.id}]`,
        ),
      ].join("\n"),
      sourceIds,
    };
  }
}
