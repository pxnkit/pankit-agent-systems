import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { containsExcludedSourceContent } from "../lib/content-policy.mjs";
import {
  assertProjectPath,
  parseArguments,
  projectRoot,
  readLiteralExport,
} from "./_safe-project-data.mjs";

const OWNER = "pxnkit";
const MAX_DOCUMENTS_PER_REPOSITORY = 6;
const MAX_DOCUMENT_CHARACTERS = 18_000;

function isRecord(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function text(value) {
  return typeof value === "string" ? value.trim() : "";
}

function githubHeaders(token) {
  return {
    accept: "application/vnd.github+json",
    "user-agent": "pankit-portfolio-evidence-sync",
    "x-github-api-version": "2022-11-28",
    ...(token ? { authorization: `Bearer ${token}` } : {}),
  };
}

async function githubJson(path, token, fetcher) {
  const response = await fetcher(new URL(path, "https://api.github.com"), {
    headers: githubHeaders(token),
  });
  if (!response.ok) {
    throw new Error(`GitHub request failed for ${path} (${response.status}).`);
  }
  return response.json();
}

function documentationPath(path) {
  const normalized = text(path).replaceAll("\\", "/");
  const lower = normalized.toLowerCase();
  if (/^readme(?:\.[a-z0-9]+)?$/.test(lower)) return true;
  if (!/\.(?:md|mdx|txt)$/i.test(lower)) return false;
  return (
    /^(?:docs?|documentation)\//i.test(normalized) ||
    /(?:^|\/)(?:architecture|design|evaluation|benchmark|method|overview|guide|usage)(?:\.[^.]+)?$/i.test(
      normalized,
    )
  );
}

function documentPriority(path) {
  const lower = path.toLowerCase();
  if (/^readme(?:\.[a-z0-9]+)?$/.test(lower)) return 0;
  if (/^docs?\/.*(?:overview|architecture|design|method)/.test(lower)) return 1;
  return 2;
}

function encodeRepositoryPath(path) {
  return path.split("/").map(encodeURIComponent).join("/");
}

function sourceId(repository, path) {
  return `github:${OWNER}/${repository}:${path}`.replace(/\s+/g, "-");
}

function documentId(repository, path) {
  return `github-doc:${repository}:${path}`.replace(/[^A-Za-z0-9._:/-]/g, "-");
}

function decodeContent(payload) {
  if (!isRecord(payload) || typeof payload.content !== "string") return "";
  if (payload.encoding !== "base64") return "";
  try {
    return Buffer.from(payload.content.replace(/\s/g, ""), "base64")
      .toString("utf8")
      .replace(/\u0000/g, "")
      .slice(0, MAX_DOCUMENT_CHARACTERS)
      .trim();
  } catch {
    return "";
  }
}

/**
 * Fetch public README and documentation Markdown without cloning, checking out,
 * or executing repository code. Returned text remains untrusted evidence.
 */
export async function syncGithubEvidence(options = {}) {
  const outputPath = assertProjectPath(
    options.outputPath ??
      resolve(projectRoot, "data/github-repository-evidence.json"),
  );
  const projects = await readLiteralExport(
    assertProjectPath(resolve(projectRoot, "data/projects.ts")),
    "projects",
  );
  const exclusions = await readLiteralExport(
    assertProjectPath(resolve(projectRoot, "data/project-exclusions.ts")),
    "projectExclusions",
  );
  const projectSlugs = new Set(
    Array.isArray(projects)
      ? projects.map((project) => text(project?.slug).toLowerCase())
      : [],
  );
  const excluded = new Set(
    Array.isArray(exclusions)
      ? exclusions
          .flatMap((entry) => [
            entry?.slug,
            ...(Array.isArray(entry?.aliases) ? entry.aliases : []),
          ])
          .map((value) => text(value).toLowerCase())
      : [],
  );
  const fetcher = options.fetcher ?? fetch;
  const token = options.token ?? process.env.GITHUB_TOKEN;
  const repositories = await githubJson(
    `/users/${OWNER}/repos?per_page=100&type=owner&sort=updated`,
    token,
    fetcher,
  );
  if (!Array.isArray(repositories))
    throw new Error("GitHub repository response was not an array.");

  const documents = [];
  const skipped = [];
  for (const repository of repositories) {
    const name = text(repository?.name);
    const slug = name.toLowerCase();
    const branch = text(repository?.default_branch) || "main";
    if (
      !name ||
      repository?.private === true ||
      repository?.fork === true ||
      repository?.archived === true ||
      name === "pankit-agent-systems"
    )
      continue;
    if (
      excluded.has(slug) ||
      containsExcludedSourceContent(`${name}\n${text(repository?.description)}`)
    ) {
      skipped.push({ repository: name, reason: "content-policy" });
      continue;
    }
    try {
      const tree = await githubJson(
        `/repos/${OWNER}/${encodeURIComponent(name)}/git/trees/${encodeURIComponent(branch)}?recursive=1`,
        token,
        fetcher,
      );
      const paths = Array.isArray(tree?.tree)
        ? tree.tree
            .filter(
              (entry) =>
                entry?.type === "blob" && documentationPath(entry?.path),
            )
            .map((entry) => text(entry.path))
            .filter(Boolean)
            .sort(
              (left, right) =>
                documentPriority(left) - documentPriority(right) ||
                left.localeCompare(right),
            )
            .slice(0, MAX_DOCUMENTS_PER_REPOSITORY)
        : [];
      for (const path of paths) {
        const payload = await githubJson(
          `/repos/${OWNER}/${encodeURIComponent(name)}/contents/${encodeRepositoryPath(path)}?ref=${encodeURIComponent(branch)}`,
          token,
          fetcher,
        );
        const content = decodeContent(payload);
        if (!content || containsExcludedSourceContent(content)) {
          skipped.push({
            repository: name,
            path,
            reason: "empty-or-content-policy",
          });
          continue;
        }
        documents.push({
          id: documentId(name, path),
          sourceId: sourceId(name, path),
          repository: name,
          projectSlug: projectSlugs.has(slug) ? slug : undefined,
          path,
          title: `${name} — ${path}`,
          url: `https://github.com/${OWNER}/${encodeURIComponent(name)}/blob/${encodeURIComponent(branch)}/${encodeRepositoryPath(path)}`,
          tags: [name, "github", "repository documentation"],
          content,
        });
      }
    } catch (error) {
      skipped.push({
        repository: name,
        reason: error instanceof Error ? error.message : "request-failed",
      });
    }
  }

  const result = {
    schemaVersion: 1,
    capturedAt: new Date().toISOString(),
    source: `https://github.com/${OWNER}?tab=repositories`,
    repositoryCount: repositories.filter(
      (repository) =>
        repository?.private !== true &&
        repository?.fork !== true &&
        repository?.archived !== true,
    ).length,
    documentCount: documents.length,
    documents,
    skipped,
  };
  if (options.write !== false) {
    await mkdir(dirname(outputPath), { recursive: true });
    await writeFile(outputPath, `${JSON.stringify(result, null, 2)}\n`, "utf8");
  }
  return result;
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  const args = parseArguments(process.argv.slice(2));
  const result = await syncGithubEvidence({
    write: !args.has("check"),
    token: process.env.GITHUB_TOKEN,
  });
  console.log(
    `GitHub evidence ready (${result.documentCount} documents from ${result.repositoryCount} public repositories; ${result.skipped.length} skipped).`,
  );
}
