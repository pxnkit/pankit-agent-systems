import { ProjectCatalogue } from "@/components/portfolio/project-catalogue";
import { projects } from "@/data/projects";

export const metadata = {
  title: "Research projects",
  description:
    "A searchable catalogue of public research systems for memory, retrieval, verification, and reliable AI agents.",
};

export default function ProjectsPage() {
  return (
    <main id="main-content" className="projects-page editorial-shell">
      <header className="page-hero">
        <p className="eyebrow">Complete research catalogue</p>
        <h1>Systems built to be inspected.</h1>
        <p>
          Search across public project documentation. Status, evaluation, and
          limitations are kept separate so a runnable prototype is never
          mistaken for externally validated evidence.
        </p>
      </header>
      <ProjectCatalogue projects={projects} />
    </main>
  );
}
