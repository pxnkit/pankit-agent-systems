import { readdir } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import {
  INDEXED_SCOPE_RESPONSE,
  containsExcludedSourceContent,
} from "../lib/content-policy.mjs";
import { validateProjectCollection } from "../lib/project-validation.mjs";
import {
  assertProjectPath,
  projectRoot,
  readLiteralExport,
  readOptionalJson,
  relativeProjectPath,
} from "./_safe-project-data.mjs";

/** @param {unknown} value @param {string} path @param {Array<{path: string, value: string}>} findings */
function inspectValue(value, path, findings) {
  if (typeof value === "string") {
    if (
      value !== INDEXED_SCOPE_RESPONSE &&
      containsExcludedSourceContent(value)
    ) {
      findings.push({ path, value: value.replace(/\s+/g, " ").slice(0, 160) });
    }
    return;
  }
  if (Array.isArray(value)) {
    value.forEach((entry, index) =>
      inspectValue(entry, `${path}[${index}]`, findings),
    );
    return;
  }
  if (value && typeof value === "object") {
    for (const [key, entry] of Object.entries(value)) {
      if (key === "notes") continue;
      inspectValue(entry, `${path}.${key}`, findings);
    }
  }
}

/** @param {string} directory */
async function generatedJsonFiles(directory) {
  try {
    const entries = await readdir(directory, { withFileTypes: true });
    return entries
      .filter((entry) => entry.isFile() && entry.name.endsWith(".json"))
      .map((entry) => resolve(directory, entry.name))
      .sort();
  } catch (error) {
    if (error && typeof error === "object" && error.code === "ENOENT")
      return [];
    throw error;
  }
}

/**
 * Checks data values, not source code comments, and never imports a repository
 * module. Missing generated artifacts are treated as an empty optional layer.
 *
 * @param {{projectsPath?: string, generatedDirectory?: string}} [options]
 */
export async function verifyContentExclusions(options = {}) {
  const projectsPath = assertProjectPath(
    options.projectsPath ?? resolve(projectRoot, "data/projects.ts"),
  );
  const generatedDirectory = assertProjectPath(
    options.generatedDirectory ?? resolve(projectRoot, "generated"),
  );
  const projects = await readLiteralExport(projectsPath, "projects");
  const validation = validateProjectCollection(projects);
  const findings = validation.issues
    .filter((issue) => issue.code === "excluded_content")
    .map((issue) => ({ path: issue.path, value: issue.message }));

  inspectValue(projects, relativeProjectPath(projectsPath), findings);
  for (const file of await generatedJsonFiles(generatedDirectory)) {
    const value = await readOptionalJson(file, null);
    inspectValue(value, relativeProjectPath(file), findings);
  }

  const unique = [
    ...new Map(
      findings.map((finding) => [
        `${finding.path}\u0000${finding.value}`,
        finding,
      ]),
    ).values(),
  ];
  return { ok: unique.length === 0, findings: unique };
}

async function main() {
  const result = await verifyContentExclusions();
  if (!result.ok) {
    console.error("Excluded employment or materials content was found:");
    result.findings.forEach((finding) =>
      console.error(`- ${finding.path}: ${finding.value}`),
    );
    process.exitCode = 1;
    return;
  }
  console.log("Content exclusion check passed.");
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  await main();
}
