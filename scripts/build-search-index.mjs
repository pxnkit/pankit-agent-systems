import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import {
  assertProjectPath,
  parseArguments,
  projectRoot,
} from "./_safe-project-data.mjs";
import { buildCorpus } from "./build-corpus.mjs";

/**
 * The search index is one projection of the canonical corpus build. Keeping
 * this command as a compatibility entry point prevents index-only generation
 * from drifting away from the validated source manifest and knowledge chunks.
 *
 * @param {{
 *   projectsPath?: string,
 *   rankedProjectsPath?: string,
 *   allowlistPath?: string,
 *   exclusionsPath?: string,
 *   contentDirectory?: string,
 *   outputPath?: string,
 *   write?: boolean
 * }} [options]
 */
export async function buildSearchIndex(options = {}) {
  const outputPath = assertProjectPath(
    options.outputPath ?? resolve(projectRoot, "generated/search-index.json"),
  );
  const result = await buildCorpus({
    projectsPath: options.projectsPath,
    rankedProjectsPath: options.rankedProjectsPath,
    allowlistPath: options.allowlistPath,
    exclusionsPath: options.exclusionsPath,
    contentDirectory: options.contentDirectory,
    write: false,
  });
  const index = result.searchIndex;

  if (options.write !== false) {
    await mkdir(dirname(outputPath), { recursive: true });
    await writeFile(outputPath, `${JSON.stringify(index, null, 2)}\n`, "utf8");
  }
  return index;
}

async function main() {
  const args = parseArguments(process.argv.slice(2));
  const output =
    typeof args.get("output") === "string"
      ? resolve(projectRoot, args.get("output"))
      : undefined;
  const index = await buildSearchIndex({
    outputPath: output,
    write: !args.has("check"),
  });
  console.log(
    `Search index valid (${index.documentCount} documents)` +
      (args.has("check") ? "; no files written." : "."),
  );
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  await main();
}
