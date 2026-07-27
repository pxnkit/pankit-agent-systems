import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { classifyLink } from "../lib/link-policy.mjs";
import {
  assertProjectPath,
  parseArguments,
  projectRoot,
  readLiteralExport,
  readOptionalJson,
} from "./_safe-project-data.mjs";

/** @param {unknown} value @param {string} path @param {Array<{path: string, url: string}>} links */
function collectLinks(value, path, links) {
  if (Array.isArray(value)) {
    value.forEach((entry, index) =>
      collectLinks(entry, `${path}[${index}]`, links),
    );
    return;
  }
  if (!value || typeof value !== "object") return;
  for (const [key, entry] of Object.entries(value)) {
    const nextPath = `${path}.${key}`;
    if (
      typeof entry === "string" &&
      (key === "url" || key.endsWith("Url") || key.endsWith("URL"))
    ) {
      links.push({ path: nextPath, url: entry });
    } else {
      collectLinks(entry, nextPath, links);
    }
  }
}

/** @param {string} url @param {typeof fetch} fetcher */
async function checkRemote(url, fetcher) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5_000);
  try {
    let response = await fetcher(url, {
      method: "HEAD",
      redirect: "manual",
      signal: controller.signal,
      headers: { "user-agent": "pankit-portfolio-link-check" },
    });
    if (response.status === 405) {
      response = await fetcher(url, {
        method: "GET",
        redirect: "manual",
        signal: controller.signal,
        headers: {
          range: "bytes=0-0",
          "user-agent": "pankit-portfolio-link-check",
        },
      });
    }
    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get("location");
      if (!location) return { ok: false, reason: "redirect-without-location" };
      const destination = new URL(location, url).href;
      if (!classifyLink(destination).allowed) {
        return { ok: false, reason: "redirect-outside-link-policy" };
      }
      return { ok: true, reason: "approved-redirect" };
    }
    return response.ok
      ? { ok: true, reason: null }
      : { ok: false, reason: `http-${response.status}` };
  } catch {
    return { ok: false, reason: "request-failed" };
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Structural checking is deterministic and is the default. Network checking
 * must be opted into with --online.
 *
 * @param {{
 *   projectsPath?: string,
 *   knowledgePath?: string,
 *   online?: boolean,
 *   fetcher?: typeof fetch
 * }} [options]
 */
export async function verifyLinks(options = {}) {
  const projectsPath = assertProjectPath(
    options.projectsPath ?? resolve(projectRoot, "data/projects.ts"),
  );
  const knowledgePath = assertProjectPath(
    options.knowledgePath ??
      resolve(projectRoot, "generated/knowledge-chunks.json"),
  );
  const [projects, knowledge] = await Promise.all([
    readLiteralExport(projectsPath, "projects"),
    readOptionalJson(knowledgePath, { chunks: [] }),
  ]);
  const links = [];
  collectLinks(projects, "projects", links);
  collectLinks(knowledge, "knowledge", links);

  const results = [];
  for (const link of links) {
    const classification = classifyLink(link.url);
    if (!classification.allowed) {
      results.push({ ...link, ok: false, reason: "blocked-by-link-policy" });
      continue;
    }
    if (
      options.online &&
      classification.kind === "external" &&
      classification.href
    ) {
      results.push({
        ...link,
        ...(await checkRemote(classification.href, options.fetcher ?? fetch)),
      });
    } else {
      results.push({ ...link, ok: true, reason: null });
    }
  }

  return {
    ok: results.every((result) => result.ok),
    checked: results.length,
    results,
  };
}

async function main() {
  const args = parseArguments(process.argv.slice(2));
  const result = await verifyLinks({ online: args.has("online") });
  const failures = result.results.filter((entry) => !entry.ok);
  if (failures.length > 0) {
    console.error("Link verification failed:");
    failures.forEach((failure) =>
      console.error(`- ${failure.path}: ${failure.url} (${failure.reason})`),
    );
    process.exitCode = 1;
    return;
  }
  console.log(
    `Link verification passed (${result.checked} links${args.has("online") ? ", online" : ", structural"}).`,
  );
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  await main();
}
