import { containsExcludedSourceContent } from "./content-policy.mjs";
import { sanitizeLink } from "./link-policy.mjs";

const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const SOURCE_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:/-]{0,159}$/;
const CARD_VARIANTS = new Set(["light", "dark", "soft", "accent"]);
const SOURCE_STATUSES = new Set(["verified", "pending"]);

/** @param {unknown} value */
function isRecord(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

/** @param {unknown} value */
function stringArray(value) {
  return (
    Array.isArray(value) && value.every((item) => typeof item === "string")
  );
}

/** @param {unknown} value */
function cleanStringArray(value) {
  if (!stringArray(value)) return [];
  return [...new Set(value.map((item) => item.trim()).filter(Boolean))];
}

/**
 * @typedef {{path: string, code: string, message: string}} ValidationIssue
 * @typedef {{ok: true, value: Record<string, unknown>, issues: ValidationIssue[]} | {ok: false, value?: undefined, issues: ValidationIssue[]}} ProjectValidationResult
 */

/**
 * Validate without executing or coercing repository-owned code.
 *
 * @param {unknown} input
 * @param {number} [index]
 * @returns {ProjectValidationResult}
 */
export function validateProject(input, index = 0) {
  const root = `projects[${index}]`;
  /** @type {ValidationIssue[]} */
  const issues = [];
  if (!isRecord(input)) {
    return {
      ok: false,
      issues: [
        { path: root, code: "type", message: "Project must be an object." },
      ],
    };
  }

  const project = /** @type {Record<string, unknown>} */ (input);
  const requiredStrings = [
    "slug",
    "title",
    "primaryPillar",
    "sourceStatus",
    "cardVariant",
  ];
  for (const field of requiredStrings) {
    if (typeof project[field] !== "string" || !project[field].trim()) {
      issues.push({
        path: `${root}.${field}`,
        code: "required",
        message: `${field} must be a non-empty string.`,
      });
    }
  }

  if (typeof project.slug === "string" && !SLUG_PATTERN.test(project.slug)) {
    issues.push({
      path: `${root}.slug`,
      code: "format",
      message: "slug must use lowercase kebab-case.",
    });
  }
  if (
    typeof project.sourceStatus === "string" &&
    !SOURCE_STATUSES.has(project.sourceStatus)
  ) {
    issues.push({
      path: `${root}.sourceStatus`,
      code: "enum",
      message: "sourceStatus must be verified or pending.",
    });
  }
  if (
    typeof project.cardVariant === "string" &&
    !CARD_VARIANTS.has(project.cardVariant)
  ) {
    issues.push({
      path: `${root}.cardVariant`,
      code: "enum",
      message: "cardVariant is not recognized.",
    });
  }
  if (typeof project.featured !== "boolean") {
    issues.push({
      path: `${root}.featured`,
      code: "type",
      message: "featured must be boolean.",
    });
  }

  const arrayFields = [
    "tags",
    "aliases",
    "languages",
    "technologies",
    "sourceIds",
    "limitations",
    "relatedProjects",
  ];
  for (const field of arrayFields) {
    if (!stringArray(project[field])) {
      issues.push({
        path: `${root}.${field}`,
        code: "type",
        message: `${field} must be an array of strings.`,
      });
    }
  }

  if (
    typeof project.shortDescription !== "string" &&
    typeof project.longDescription !== "string"
  ) {
    issues.push({
      path: `${root}.shortDescription`,
      code: "required",
      message: "At least one project description is required.",
    });
  }

  const sourceIds = cleanStringArray(project.sourceIds);
  if (sourceIds.length === 0) {
    issues.push({
      path: `${root}.sourceIds`,
      code: "required",
      message: "At least one source ID is required.",
    });
  }
  sourceIds.forEach((sourceId, sourceIndex) => {
    if (!SOURCE_ID_PATTERN.test(sourceId)) {
      issues.push({
        path: `${root}.sourceIds[${sourceIndex}]`,
        code: "format",
        message: "Source IDs may only contain stable URL-safe characters.",
      });
    }
  });

  if (project.repositoryUrl !== undefined) {
    const repositoryUrl = sanitizeLink(project.repositoryUrl);
    if (
      !repositoryUrl ||
      !new URL(repositoryUrl).hostname.endsWith("github.com")
    ) {
      issues.push({
        path: `${root}.repositoryUrl`,
        code: "url",
        message: "repositoryUrl must be an approved HTTPS GitHub URL.",
      });
    }
  }

  const publicText = [
    project.title,
    project.shortDescription,
    project.longDescription,
    ...cleanStringArray(project.tags),
    ...cleanStringArray(project.aliases),
  ]
    .filter((value) => typeof value === "string")
    .join("\n");
  if (containsExcludedSourceContent(publicText)) {
    issues.push({
      path: root,
      code: "excluded_content",
      message: "Project contains content outside the public indexed scope.",
    });
  }

  if (issues.length > 0) return { ok: false, issues };

  return {
    ok: true,
    value: {
      ...project,
      slug: String(project.slug).trim(),
      title: String(project.title).trim(),
      primaryPillar: String(project.primaryPillar).trim(),
      tags: cleanStringArray(project.tags),
      aliases: cleanStringArray(project.aliases),
      languages: cleanStringArray(project.languages),
      technologies: cleanStringArray(project.technologies),
      sourceIds,
      limitations: cleanStringArray(project.limitations),
      relatedProjects: cleanStringArray(project.relatedProjects),
      repositoryUrl:
        project.repositoryUrl === undefined
          ? undefined
          : sanitizeLink(project.repositoryUrl),
    },
    issues: [],
  };
}

/**
 * @param {unknown} input
 * @returns {{ok: boolean, projects: Record<string, unknown>[], issues: ValidationIssue[]}}
 */
export function validateProjectCollection(input) {
  if (!Array.isArray(input)) {
    return {
      ok: false,
      projects: [],
      issues: [
        {
          path: "projects",
          code: "type",
          message: "projects must be an array.",
        },
      ],
    };
  }

  /** @type {Record<string, unknown>[]} */
  const projects = [];
  /** @type {ValidationIssue[]} */
  const issues = [];
  const slugs = new Set();
  for (const [index, value] of input.entries()) {
    const result = validateProject(value, index);
    issues.push(...result.issues);
    if (!result.ok) continue;

    const slug = String(result.value.slug);
    if (slugs.has(slug)) {
      issues.push({
        path: `projects[${index}].slug`,
        code: "duplicate",
        message: `Duplicate project slug: ${slug}.`,
      });
      continue;
    }
    slugs.add(slug);
    projects.push(result.value);
  }

  return { ok: issues.length === 0, projects, issues };
}

/**
 * @param {unknown} input
 * @param {Iterable<string>} [knownSlugs]
 */
export function validateRankedProjects(input, knownSlugs = []) {
  /** @type {ValidationIssue[]} */
  const issues = [];
  if (!Array.isArray(input)) {
    return {
      ok: false,
      rankedProjects: [],
      issues: [
        {
          path: "rankedProjects",
          code: "type",
          message: "rankedProjects must be an array.",
        },
      ],
    };
  }

  const slugSet = new Set(knownSlugs);
  const ranks = new Set();
  const numbers = new Set();
  const slugs = new Set();
  /** @type {Record<string, unknown>[]} */
  const rankedProjects = [];

  input.forEach((entry, index) => {
    const path = `rankedProjects[${index}]`;
    if (!isRecord(entry)) {
      issues.push({
        path,
        code: "type",
        message: "Ranked project must be an object.",
      });
      return;
    }
    const value = /** @type {Record<string, unknown>} */ (entry);
    if (!Number.isInteger(value.rank) || Number(value.rank) < 1) {
      issues.push({
        path: `${path}.rank`,
        code: "format",
        message: "rank must be a positive integer.",
      });
    }
    if (
      !Number.isInteger(value.projectNumber) ||
      Number(value.projectNumber) < 1
    ) {
      issues.push({
        path: `${path}.projectNumber`,
        code: "format",
        message: "projectNumber must be a positive integer.",
      });
    }
    if (typeof value.slug !== "string" || !SLUG_PATTERN.test(value.slug)) {
      issues.push({
        path: `${path}.slug`,
        code: "format",
        message: "slug must use lowercase kebab-case.",
      });
    } else if (slugSet.size > 0 && !slugSet.has(value.slug)) {
      issues.push({
        path: `${path}.slug`,
        code: "reference",
        message: `Unknown project slug: ${value.slug}.`,
      });
    }
    if (typeof value.title !== "string" || !value.title.trim()) {
      issues.push({
        path: `${path}.title`,
        code: "required",
        message: "title is required.",
      });
    }

    for (const [field, key, set] of [
      ["rank", value.rank, ranks],
      ["projectNumber", value.projectNumber, numbers],
      ["slug", value.slug, slugs],
    ]) {
      if (set.has(key)) {
        issues.push({
          path: `${path}.${field}`,
          code: "duplicate",
          message: `Duplicate ${field}: ${String(key)}.`,
        });
      }
      set.add(key);
    }
    rankedProjects.push(value);
  });

  return { ok: issues.length === 0, rankedProjects, issues };
}

/** @param {unknown} projects @param {unknown} rankedProjects */
export function assertValidPortfolioData(projects, rankedProjects) {
  const projectResult = validateProjectCollection(projects);
  const rankResult = validateRankedProjects(
    rankedProjects,
    projectResult.projects.map((project) => String(project.slug)),
  );
  const issues = [...projectResult.issues, ...rankResult.issues];
  if (issues.length > 0) {
    throw new Error(
      `Invalid portfolio data:\n${issues
        .map((issue) => `- ${issue.path}: ${issue.message}`)
        .join("\n")}`,
    );
  }
  return {
    projects: projectResult.projects,
    rankedProjects: rankResult.rankedProjects,
  };
}
