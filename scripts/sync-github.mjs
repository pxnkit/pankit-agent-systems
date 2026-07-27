import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import {
  assertProjectPath,
  parseArguments,
  projectRoot,
  readLiteralExport,
  readOptionalJson,
} from "./_safe-project-data.mjs";

const EMPTY_SNAPSHOT = Object.freeze({
  schemaVersion: 1,
  capturedAt: "1970-01-01",
  source: "https://github.com/pxnkit?tab=repositories",
  projectCount: 0,
  overridePolicy:
    "Manual project records and exclusions take precedence over this discovery snapshot.",
  projects: [],
});

/** @param {unknown} value */
function repositoryCoordinate(value) {
  if (typeof value !== "string") return null;
  try {
    const url = new URL(value);
    if (
      url.protocol !== "https:" ||
      url.hostname.toLowerCase() !== "github.com" ||
      url.username ||
      url.password
    ) {
      return null;
    }
    const [owner, repository] = url.pathname
      .replace(/\.git$/i, "")
      .split("/")
      .filter(Boolean);
    if (
      !owner ||
      !repository ||
      !/^[A-Za-z0-9_.-]+$/.test(`${owner}${repository}`)
    ) {
      return null;
    }
    return { owner, repository };
  } catch {
    return null;
  }
}

/** @param {Record<string, unknown>} response */
function normalizeGithubResponse(response) {
  const license =
    response.license &&
    typeof response.license === "object" &&
    typeof response.license.spdx_id === "string"
      ? response.license.spdx_id
      : null;
  return {
    fullName: typeof response.full_name === "string" ? response.full_name : "",
    description:
      typeof response.description === "string" ? response.description : null,
    homepage: typeof response.homepage === "string" ? response.homepage : null,
    htmlUrl: typeof response.html_url === "string" ? response.html_url : null,
    defaultBranch:
      typeof response.default_branch === "string"
        ? response.default_branch
        : null,
    language: typeof response.language === "string" ? response.language : null,
    topics: Array.isArray(response.topics)
      ? response.topics.filter((topic) => typeof topic === "string").sort()
      : [],
    archived: response.archived === true,
    fork: response.fork === true,
    stars: Number.isInteger(response.stargazers_count)
      ? response.stargazers_count
      : 0,
    license,
    pushedAt:
      typeof response.pushed_at === "string" ? response.pushed_at : null,
  };
}

/**
 * Fetches metadata JSON only. It never clones, checks out, imports, builds, or
 * runs code from any repository.
 *
 * @param {{owner: string, repository: string}} coordinate
 * @param {{token?: string, fetcher?: typeof fetch}} options
 */
export async function fetchRepositoryMetadata(coordinate, options = {}) {
  const headers = {
    accept: "application/vnd.github+json",
    "user-agent": "pankit-portfolio-metadata-sync",
    "x-github-api-version": "2022-11-28",
  };
  if (options.token) headers.authorization = `Bearer ${options.token}`;
  const endpoint = new URL(
    `/repos/${encodeURIComponent(coordinate.owner)}/${encodeURIComponent(coordinate.repository)}`,
    "https://api.github.com",
  );
  const response = await (options.fetcher ?? fetch)(endpoint, { headers });
  if (!response.ok) {
    throw new Error(
      `GitHub metadata request failed for ${coordinate.owner}/${coordinate.repository} (${response.status}).`,
    );
  }
  return normalizeGithubResponse(await response.json());
}

/**
 * @param {unknown} snapshot
 * @param {Array<Record<string, unknown>>} manualProjects
 * @param {"live" | "snapshot"} syncMode
 */
function normalizeSnapshot(snapshot, manualProjects, syncMode) {
  const snapshotProjects =
    snapshot && typeof snapshot === "object" && Array.isArray(snapshot.projects)
      ? snapshot.projects
      : [];
  const existingBySlug = new Map(
    snapshotProjects
      .filter(
        (project) =>
          project &&
          typeof project === "object" &&
          typeof project.slug === "string",
      )
      .map((project) => [project.slug, project]),
  );
  const projects = manualProjects.flatMap((project) => {
    const coordinate = repositoryCoordinate(project.repositoryUrl);
    if (!coordinate) return [];
    const slug = String(project.slug);
    const existing = existingBySlug.get(slug);
    const githubSourceId = Array.isArray(project.sourceIds)
      ? project.sourceIds.find(
          (sourceId) =>
            typeof sourceId === "string" && sourceId.startsWith("github:"),
        )
      : undefined;
    return [
      {
        slug,
        name: String(project.title),
        description:
          existing && typeof existing.description === "string"
            ? existing.description
            : String(project.shortDescription ?? project.longDescription ?? ""),
        url: String(project.repositoryUrl),
        sourceId:
          githubSourceId ??
          `github:${coordinate.owner.toLowerCase()}/${coordinate.repository.toLowerCase()}`,
      },
    ];
  });
  return {
    schemaVersion: 1,
    capturedAt:
      snapshot &&
      typeof snapshot === "object" &&
      typeof snapshot.capturedAt === "string"
        ? snapshot.capturedAt
        : EMPTY_SNAPSHOT.capturedAt,
    source:
      snapshot &&
      typeof snapshot === "object" &&
      typeof snapshot.source === "string"
        ? snapshot.source
        : EMPTY_SNAPSHOT.source,
    projectCount: projects.length,
    overridePolicy: EMPTY_SNAPSHOT.overridePolicy,
    projects,
    syncMode,
  };
}

/**
 * @param {{
 *  projectsPath?: string,
 *  snapshotPath?: string,
 *  outputPath?: string,
 *  offline?: boolean,
 *  token?: string,
 *  fetcher?: typeof fetch,
 *  write?: boolean
 * }} [options]
 */
export async function syncGithub(options = {}) {
  const projectsPath = assertProjectPath(
    options.projectsPath ?? resolve(projectRoot, "data/projects.ts"),
  );
  const snapshotPath = assertProjectPath(
    options.snapshotPath ?? resolve(projectRoot, "data/github-snapshot.json"),
  );
  const outputPath = assertProjectPath(
    options.outputPath ??
      resolve(projectRoot, "generated/github-projects.json"),
  );
  const projects = await readLiteralExport(projectsPath, "projects");
  if (!Array.isArray(projects))
    throw new Error("projects export must be an array.");
  const packagedSnapshot = await readOptionalJson(snapshotPath, null);
  let existingSnapshot = await readOptionalJson(outputPath, null);
  existingSnapshot ??= packagedSnapshot ?? EMPTY_SNAPSHOT;

  const coordinates = [
    ...new Map(
      projects
        .map((project) => repositoryCoordinate(project?.repositoryUrl))
        .filter(Boolean)
        .map((coordinate) => [
          `${coordinate.owner.toLowerCase()}/${coordinate.repository.toLowerCase()}`,
          coordinate,
        ]),
    ).values(),
  ].sort((left, right) =>
    `${left.owner}/${left.repository}`.localeCompare(
      `${right.owner}/${right.repository}`,
    ),
  );

  let result;
  if (!options.offline && coordinates.length > 0) {
    try {
      const repositories = [];
      for (const coordinate of coordinates) {
        repositories.push(
          await fetchRepositoryMetadata(coordinate, {
            token: options.token,
            fetcher: options.fetcher,
          }),
        );
      }
      // Fetching confirms the allowlisted repositories and refreshes the
      // snapshot mode. Curated names/descriptions still come from manual data.
      result = normalizeSnapshot(existingSnapshot, projects, "live");
    } catch (error) {
      console.warn(
        `Live GitHub metadata unavailable; using deterministic snapshot fallback. ${error instanceof Error ? error.message : ""}`,
      );
    }
  }

  if (!result) {
    result = normalizeSnapshot(existingSnapshot, projects, "snapshot");
  }

  if (options.write !== false) {
    const serializable = { ...result };
    delete serializable.syncMode;
    await mkdir(dirname(outputPath), { recursive: true });
    await writeFile(
      outputPath,
      `${JSON.stringify(serializable, null, 2)}\n`,
      "utf8",
    );
  }
  return result;
}

async function main() {
  const args = parseArguments(process.argv.slice(2));
  const result = await syncGithub({
    offline: args.has("offline"),
    write: !args.has("check"),
    token: process.env.GITHUB_TOKEN,
    snapshotPath:
      typeof args.get("snapshot") === "string"
        ? resolve(projectRoot, args.get("snapshot"))
        : undefined,
    outputPath:
      typeof args.get("output") === "string"
        ? resolve(projectRoot, args.get("output"))
        : undefined,
  });
  console.log(
    `GitHub metadata ready (${result.syncMode}, ${result.projects.length} repositories)` +
      (args.has("check") ? "; no files written." : "."),
  );
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  await main();
}
