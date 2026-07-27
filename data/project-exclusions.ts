export type ProjectExclusion = {
  slug: string;
  aliases: string[];
  reason: "explicit-request";
  disposition: "exclude-from-ingestion-and-display";
};

/**
 * Explicit exclusions take precedence over repository discovery, aliases, and
 * generated metadata.
 */
export const projectExclusions: ProjectExclusion[] = [
  {
    slug: "matscisynth",
    aliases: ["MatSciSynth"],
    reason: "explicit-request",
    disposition: "exclude-from-ingestion-and-display",
  },
  {
    slug: "dosemirror",
    aliases: ["DoseMirror"],
    reason: "explicit-request",
    disposition: "exclude-from-ingestion-and-display",
  },
  {
    slug: "fidelityttt",
    aliases: ["FidelityTTT", "fidelityttt-lab"],
    reason: "explicit-request",
    disposition: "exclude-from-ingestion-and-display",
  },
  {
    slug: "novelnest",
    aliases: ["NovelNest"],
    reason: "explicit-request",
    disposition: "exclude-from-ingestion-and-display",
  },
];

export const excludedProjectSlugs = new Set(
  projectExclusions.map(({ slug }) => slug),
);
