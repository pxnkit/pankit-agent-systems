export type ContentExclusion = {
  id: string;
  description: string;
  scope: "profile" | "repository-content" | "all-content";
  action: "omit";
  signals: string[];
};

/**
 * Content safety policy for corpus builders and manual edits. These rules are
 * semantic: matching content is omitted even when it appears in a trusted
 * source.
 */
export const contentExclusions: ContentExclusion[] = [
  {
    id: "current-employment",
    description:
      "Omit current jobs, employers, active work roles, and employment timelines.",
    scope: "all-content",
    action: "omit",
    signals: ["current job", "current employer", "employment", "work role"],
  },
  {
    id: "current-organizations",
    description:
      "Omit current organizational affiliations, memberships, teams, and institutional details.",
    scope: "all-content",
    action: "omit",
    signals: [
      "current affiliation",
      "organization membership",
      "institutional affiliation",
      "workplace",
    ],
  },
  {
    id: "excluded-project-content",
    description:
      "Omit repository text, metadata, and assets for every explicitly excluded project.",
    scope: "repository-content",
    action: "omit",
    signals: ["project-exclusions"],
  },
];
