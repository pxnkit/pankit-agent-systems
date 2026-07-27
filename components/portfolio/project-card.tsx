import Link from "next/link";
import type { Project } from "@/data/projects";
import { ProjectArtwork } from "@/components/projects/project-artwork";

export function ProjectCard({
  project,
  compact = false,
}: {
  project: Project;
  compact?: boolean;
}) {
  const variant = project.cardVariant ?? "light";

  return (
    <article
      className={`project-card card-${variant}${compact ? " is-compact" : ""}`}
    >
      <div className="card-copy">
        <div className="card-meta">
          <span>{project.primaryPillar}</span>
          <span
            className={`status-dot ${
              project.sourceStatus === "verified" ? "verified" : "pending"
            }`}
          >
            {project.sourceStatus === "verified"
              ? (project.implementationStatus ?? "Verified source")
              : "Details pending"}
          </span>
        </div>
        <h3>
          <Link href={`/projects/${project.slug}`}>{project.title}</Link>
        </h3>
        <p>
          {project.shortDescription ??
            "This project appears in the curated shortlist; verified public details are not yet indexed."}
        </p>
      </div>

      <ProjectArtwork slug={project.slug} title={project.title} />

      <div className="card-footer">
        <Link className="card-link" href={`/projects/${project.slug}`}>
          View project <span aria-hidden="true">↗</span>
        </Link>
        {project.repositoryUrl ? (
          <a
            className="github-link"
            href={project.repositoryUrl}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={`${project.title} repository on GitHub`}
          >
            GitHub
          </a>
        ) : null}
      </div>
    </article>
  );
}
