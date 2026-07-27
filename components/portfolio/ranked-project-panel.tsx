"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import type { RankedProject } from "@/data/ranked-projects";
import type { Project } from "@/data/projects";
import { ProjectArtwork } from "@/components/projects/project-artwork";

export function RankedProjectPanel({
  rankedProjects,
  projects,
}: {
  rankedProjects: RankedProject[];
  projects: Project[];
}) {
  const [selectedSlug, setSelectedSlug] = useState(
    rankedProjects[0]?.slug ?? "",
  );
  const selectedRanked =
    rankedProjects.find((item) => item.slug === selectedSlug) ??
    rankedProjects[0];
  const selectedProject = useMemo(
    () => projects.find((project) => project.slug === selectedRanked?.slug),
    [projects, selectedRanked?.slug],
  );

  if (!selectedRanked) return null;

  return (
    <div className="ranked-panel">
      <div className="ranked-table-wrap">
        <table className="ranked-table">
          <caption className="sr-only">
            Curated research project shortlist
          </caption>
          <thead>
            <tr>
              <th scope="col">Rank</th>
              <th scope="col">Project</th>
            </tr>
          </thead>
          <tbody>
            {rankedProjects.map((project) => (
              <tr
                key={project.slug}
                className={project.slug === selectedSlug ? "is-selected" : ""}
                onMouseEnter={() => setSelectedSlug(project.slug)}
              >
                <td>{project.rank}</td>
                <td>
                  <Link
                    href={`/projects/${project.slug}`}
                    onFocus={() => setSelectedSlug(project.slug)}
                  >
                    <span>{project.projectNumber}.</span> {project.title}
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <aside className="ranked-preview" aria-live="polite">
        <div className="ranked-preview-copy">
          <p className="eyebrow">
            Rank {selectedRanked.rank} · Project {selectedRanked.projectNumber}
          </p>
          <h3>{selectedRanked.title}</h3>
          <p>
            {selectedProject?.shortDescription ??
              "Verified public details are not currently available in the indexed sources."}
          </p>
          <span className="preview-status">
            {selectedProject?.sourceStatus === "verified"
              ? "Verified public source"
              : "Verified details pending"}
          </span>
        </div>
        <ProjectArtwork
          slug={selectedRanked.slug}
          title={selectedRanked.title}
        />
        <Link
          className="button button-light"
          href={`/projects/${selectedRanked.slug}`}
        >
          Open project
        </Link>
      </aside>
    </div>
  );
}
