import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ProjectArtwork } from "@/components/projects/project-artwork";
import { ProjectCard } from "@/components/portfolio/project-card";
import { getProjectBySlug, projects } from "@/data/projects";
import { rankedProjects } from "@/data/ranked-projects";

export function generateStaticParams() {
  return projects.map((project) => ({ slug: project.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const project = getProjectBySlug(slug);
  if (!project) return { title: "Project not found" };
  return {
    title: project.title,
    description:
      project.shortDescription ??
      `${project.title} appears in Pankit Brahmkhatri’s curated research shortlist.`,
    alternates: { canonical: `/projects/${project.slug}` },
    openGraph: {
      type: "website",
      title: project.title,
      description: project.shortDescription,
      images: ["/og.png"],
    },
  };
}

export default async function ProjectPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const project = getProjectBySlug(slug);
  if (!project) notFound();

  const ranked = rankedProjects.find((item) => item.slug === project.slug);
  const related = project.relatedProjects
    .map((relatedSlug) => getProjectBySlug(relatedSlug))
    .filter((item): item is NonNullable<typeof item> => Boolean(item))
    .slice(0, 3);

  if (project.sourceStatus !== "verified") {
    return (
      <main id="main-content" className="project-detail-page editorial-shell">
        <header className="pending-project-hero">
          <div>
            <p className="eyebrow">Curated research shortlist</p>
            <h1>{project.title}</h1>
            {ranked ? (
              <p className="rank-line">
                Rank {ranked.rank} · Project {ranked.projectNumber}
              </p>
            ) : null}
            <span className="pending-label">Verified details pending</span>
            <p className="pending-copy">
              This project appears in the curated shortlist, but verified public
              details are not currently available in the indexed sources. No
              architecture, results, or repository link is inferred.
            </p>
            <div className="hero-actions">
              <Link
                className="button button-primary"
                href="/portfolio#shortlist"
              >
                Back to shortlist
              </Link>
              <Link className="button button-secondary" href="/projects">
                Browse verified projects
              </Link>
            </div>
          </div>
          <ProjectArtwork slug={project.slug} title={project.title} />
        </header>
      </main>
    );
  }

  const query = encodeURIComponent(
    `Explain ${project.title}, including its current evidence and limitations.`,
  );

  return (
    <main id="main-content" className="project-detail-page">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify([
            {
              "@context": "https://schema.org",
              "@type": "SoftwareSourceCode",
              name: project.title,
              description: project.shortDescription,
              codeRepository: project.repositoryUrl,
              programmingLanguage: project.languages,
              author: {
                "@type": "Person",
                name: "Pankit Brahmkhatri",
              },
            },
            {
              "@context": "https://schema.org",
              "@type": "BreadcrumbList",
              itemListElement: [
                {
                  "@type": "ListItem",
                  position: 1,
                  name: "Projects",
                  item: "/projects",
                },
                {
                  "@type": "ListItem",
                  position: 2,
                  name: project.title,
                  item: `/projects/${project.slug}`,
                },
              ],
            },
          ]).replace(/</g, "\\u003c"),
        }}
      />
      <header className={`project-hero card-${project.cardVariant ?? "light"}`}>
        <div className="editorial-shell project-hero-inner">
          <div className="project-hero-copy">
            <p className="eyebrow">{project.primaryPillar}</p>
            <h1>{project.title}</h1>
            <p>{project.shortDescription}</p>
            <div className="status-row">
              {project.implementationStatus ? (
                <span>{project.implementationStatus}</span>
              ) : null}
              {project.evaluationStatus ? (
                <span>{project.evaluationStatus}</span>
              ) : null}
              {project.claimStatus ? <span>{project.claimStatus}</span> : null}
            </div>
            <div className="hero-actions">
              <Link
                className="button button-primary"
                href={`/?project=${project.slug}&q=${query}`}
              >
                Ask about this project
              </Link>
              {project.repositoryUrl ? (
                <a
                  className="button button-secondary"
                  href={project.repositoryUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  View GitHub ↗
                </a>
              ) : null}
            </div>
          </div>
          <ProjectArtwork slug={project.slug} title={project.title} />
        </div>
      </header>

      <div className="project-reading editorial-shell">
        {project.longDescription ? (
          <section className="project-section">
            <p className="section-kicker">Documented focus</p>
            <h2>The problem and why it matters</h2>
            <p>{project.longDescription}</p>
          </section>
        ) : null}

        {(project.implementationStatus || project.technologies.length) && (
          <section className="project-section split-section">
            <div>
              <p className="section-kicker">Implementation</p>
              <h2>What is documented</h2>
              <p>
                {project.implementationStatus ??
                  "Implementation details are available in the public repository documentation."}
              </p>
            </div>
            {project.technologies.length ? (
              <ul className="tag-list" aria-label="Technologies">
                {project.technologies.map((technology) => (
                  <li key={technology}>{technology}</li>
                ))}
              </ul>
            ) : null}
          </section>
        )}

        {project.evaluationStatus ? (
          <section className="project-section">
            <p className="section-kicker">Evaluation</p>
            <h2>Current evidence</h2>
            <p>{project.evaluationStatus}</p>
            <p className="evidence-note">
              Repository-authored evidence is presented as such; it is not
              treated as independent validation.
            </p>
          </section>
        ) : null}

        <section className="project-section limitations-section">
          <p className="section-kicker">Claims and limitations</p>
          <h2>Boundaries stay visible.</h2>
          {project.limitations.length ? (
            <ul>
              {project.limitations.map((limitation) => (
                <li key={limitation}>{limitation}</li>
              ))}
            </ul>
          ) : (
            <p>
              No separate limitation statement was indexed. The portfolio does
              not infer production readiness, publication status, or external
              validation from repository availability.
            </p>
          )}
        </section>

        {project.tags.length ? (
          <section className="project-section">
            <p className="section-kicker">Research index</p>
            <h2>Topics</h2>
            <ul className="tag-list">
              {project.tags.map((tag) => (
                <li key={tag}>{tag}</li>
              ))}
            </ul>
          </section>
        ) : null}

        {related.length ? (
          <section className="related-projects">
            <p className="section-kicker">Related systems</p>
            <h2>Continue through the evidence.</h2>
            <div className="related-grid">
              {related.map((item) => (
                <ProjectCard key={item.slug} project={item} compact />
              ))}
            </div>
          </section>
        ) : null}

        <section className="project-ask-card">
          <div>
            <p className="eyebrow">Grounded portfolio guide</p>
            <h2>Ask a precise follow-up.</h2>
            <p>
              The guide retrieves trusted local source IDs and will say when the
              indexed evidence is insufficient.
            </p>
          </div>
          <Link
            className="button button-light"
            href={`/?project=${project.slug}&q=${query}`}
          >
            Ask about {project.title}
          </Link>
        </section>
      </div>
    </main>
  );
}
