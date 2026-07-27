/**
 * The manually curated ranking is authoritative. Repository discovery must not
 * reorder or rename these entries.
 */
export type RankedProject = {
  rank: number;
  projectNumber: number;
  title: string;
  slug: string;
};

export const rankedProjects: RankedProject[] = [
  { rank: 1, projectNumber: 24, title: "ChaffMem", slug: "chaffmem" },
  { rank: 2, projectNumber: 21, title: "MemEquiv", slug: "memequiv" },
  {
    rank: 3,
    projectNumber: 41,
    title: "SynthesisAutopsy",
    slug: "synthesisautopsy",
  },
  { rank: 4, projectNumber: 46, title: "RowWitness", slug: "rowwitness" },
  { rank: 5, projectNumber: 45, title: "ProbeDiff", slug: "probediff" },
  { rank: 6, projectNumber: 35, title: "VeriForget", slug: "veriforget" },
];
