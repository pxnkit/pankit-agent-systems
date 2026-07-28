import {
  QUERY_INTENTS,
  isComparisonQuery,
  isLimitationQuery,
} from "../retrieval.mjs";

/** @param {string} value @param {number} maximum */
function compact(value, maximum) {
  const clean = value.replace(/\s+/g, " ").trim();
  if (clean.length <= maximum) return clean;
  const shortened = clean.slice(0, maximum - 1);
  const boundary = shortened.lastIndexOf(" ");
  return `${shortened.slice(0, Math.max(boundary, maximum * 0.7))}…`;
}

/** @param {{excerpt: string}} source @param {number} maximum */
function sourceText(source, maximum) {
  const text = source.excerpt
    .split("\n")
    .map((part) => part.replace(/^[^:\n]{1,160}:\s+/, ""))
    .join(" ");
  return compact(text, maximum);
}

/** @param {{id: string, excerpt: string}} source @param {number} maximum */
function citedExcerpt(source, maximum) {
  return `${sourceText(source, maximum)} [source:${source.id}]`;
}

/** @param {Array<{id: string}>} sources @param {string} id */
function sourceById(sources, id) {
  return sources.find((source) => source.id === id);
}

/** @param {{excerpt: string}} source @param {RegExp} pattern */
function matchingSentence(source, pattern) {
  return sourceText(source, 2_400)
    .split(/(?<=[.!?])\s+/)
    .find((sentence) => pattern.test(sentence));
}

/** @param {string} intent */
function sourceLessAnswer(intent) {
  switch (intent) {
    case QUERY_INTENTS.IDENTITY:
      return "The public profile record is temporarily unavailable in the portfolio index. The verified project catalogue is still available.";
    case QUERY_INTENTS.PORTFOLIO_OVERVIEW:
    case QUERY_INTENTS.RESEARCH_CONNECTION:
    case QUERY_INTENTS.THEME:
      return "The portfolio’s curated research overview is temporarily unavailable. Try a named project while the global index is refreshed.";
    case QUERY_INTENTS.SITE:
    case QUERY_INTENTS.SCOPE:
    case QUERY_INTENTS.GITHUB:
      return "The site-scope record is temporarily unavailable. Browse the public portfolio and verified project catalogue directly.";
    case QUERY_INTENTS.PENDING_SHORTLIST:
      return "The curated shortlist record is temporarily unavailable. Pending entries remain clearly marked in the project catalogue.";
    default:
      return "The indexed portfolio sources do not establish that topic. Try a research theme, a named project, a project comparison, or the public source set.";
  }
}

/**
 * This provider performs no network request. Its output is deliberately
 * extractive and therefore remains useful in local development and outages.
 */
export class RetrievalOnlyProvider {
  constructor() {
    this.id = "retrieval-only";
    this.aiMode = "retrieval-only";
    this.configured = true;
  }

  /**
   * @param {{
   *   message: string,
   *   intent?: string,
   *   sources: Array<{id: string, title: string, excerpt: string, projectSlug?: string, type?: string}>
   * }} input
   */
  async generate(input) {
    const intent = input.intent ?? QUERY_INTENTS.UNKNOWN;
    if (input.sources.length === 0) {
      return {
        answer: sourceLessAnswer(intent),
        sourceIds: [],
        abstained: true,
      };
    }

    const comparison =
      intent === QUERY_INTENTS.COMPARE || isComparisonQuery(input.message);
    const sources = input.sources.slice(0, comparison ? 6 : 4);
    const sourceIds = sources.map((source) => source.id);

    if (comparison && sources.length > 1) {
      return {
        answer: sources
          .map(
            (source) => `- **${source.title}**: ${citedExcerpt(source, 360)}`,
          )
          .join("\n"),
        sourceIds,
        abstained: false,
      };
    }

    if (intent === QUERY_INTENTS.RESEARCH_CONNECTION) {
      const overview = sourceById(sources, "curated:research-overview");
      const projectMap = sourceById(sources, "curated:project-map");
      if (overview && projectMap) {
        return {
          answer:
            "Across the portfolio, memory is treated as a decision system: an agent must recognize evidence, recall it, identify its source, check whether it is still valid, and use it to choose an action. " +
            `[source:${overview.id}]\n\n` +
            "The project map turns that view into concrete systems: RKA-Lab covers recognition, recall, source, and action; TxnMem covers concurrency; FreshIndex and RegimeBank cover temporal validity; HippoGate covers consolidation and forgetting; MemEquiv covers correction; MemIntervene covers causal influence; ScopeGuard covers scope; CertiCompress covers provenance; and ParamLedger covers parameter promotion. " +
            `[source:${projectMap.id}]`,
          sourceIds: [overview.id, projectMap.id],
          abstained: false,
        };
      }
    }

    if (intent === QUERY_INTENTS.THEME) {
      const themes = sourceById(sources, "curated:research-themes");
      if (themes) {
        return {
          answer:
            "The portfolio has five main themes: agent memory and adaptation; information retrieval and evidence; test-time learning; search-guided reasoning; and reliable tool agents. " +
            `[source:${themes.id}]`,
          sourceIds: [themes.id],
          abstained: false,
        };
      }
    }

    if (intent === QUERY_INTENTS.IDENTITY) {
      const profile = sourceById(sources, "curated:profile");
      if (profile) {
        return {
          answer: citedExcerpt(profile, 900),
          sourceIds: [profile.id],
          abstained: false,
        };
      }
    }

    if (intent === QUERY_INTENTS.PORTFOLIO_OVERVIEW) {
      const profile = sourceById(sources, "curated:profile");
      const overview = sourceById(sources, "curated:research-overview");
      const projectMap = sourceById(sources, "curated:project-map");
      if (
        /\b(?:how many|count|number of)\b/i.test(input.message) &&
        projectMap
      ) {
        const count = matchingSentence(
          projectMap,
          /\b\d+\s+indexed\b.*\bverified\b.*\bpending\b/i,
        );
        if (count) {
          return {
            answer: `${count} [source:${projectMap.id}]`,
            sourceIds: [projectMap.id],
            abstained: false,
          };
        }
      }
      const selected = [profile, overview].filter(Boolean);
      if (selected.length > 0) {
        return {
          answer: selected
            .map((source) => citedExcerpt(source, 760))
            .join("\n\n"),
          sourceIds: selected.map((source) => source.id),
          abstained: false,
        };
      }
    }

    if (intent === QUERY_INTENTS.GITHUB) {
      const siteScope = sourceById(sources, "curated:site-scope");
      if (siteScope) {
        const github = matchingSentence(siteScope, /\bgithub\.com\/pxnkit\b/i);
        if (github) {
          return {
            answer: `${github} [source:${siteScope.id}]`,
            sourceIds: [siteScope.id],
            abstained: false,
          };
        }
      }
    }

    if (
      intent === QUERY_INTENTS.IDENTITY ||
      intent === QUERY_INTENTS.EXACT ||
      intent === QUERY_INTENTS.LIMITATION ||
      intent === QUERY_INTENTS.THEME ||
      intent === QUERY_INTENTS.SITE ||
      intent === QUERY_INTENTS.SCOPE ||
      intent === QUERY_INTENTS.GITHUB ||
      intent === QUERY_INTENTS.PENDING_SHORTLIST
    ) {
      const maximum =
        intent === QUERY_INTENTS.IDENTITY
          ? 900
          : intent === QUERY_INTENTS.SITE || intent === QUERY_INTENTS.SCOPE
            ? 1_100
            : 760;
      return {
        answer: sources
          .slice(0, intent === QUERY_INTENTS.IDENTITY ? 2 : 3)
          .map((source) => citedExcerpt(source, maximum))
          .join("\n\n"),
        sourceIds: sourceIds.slice(
          0,
          intent === QUERY_INTENTS.IDENTITY ? 2 : 3,
        ),
        abstained: false,
      };
    }

    const lead = isLimitationQuery(input.message)
      ? "The indexed portfolio records these limitations:"
      : "The indexed portfolio supports this answer:";
    return {
      answer: [
        lead,
        ...sources.map(
          (source) => `- **${source.title}**: ${citedExcerpt(source, 520)}`,
        ),
      ].join("\n"),
      sourceIds,
      abstained: false,
    };
  }
}
