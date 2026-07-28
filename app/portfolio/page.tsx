import Link from "next/link";
import { ProjectRail } from "@/components/portfolio/project-rail";
import { RankedProjectPanel } from "@/components/portfolio/ranked-project-panel";
import { projects } from "@/data/projects";
import { rankedProjects } from "@/data/ranked-projects";

export const metadata = {
  title: "Portfolio",
  description:
    "Research systems for agent memory, evidence retrieval, verification, and reliable action.",
};

const featured = projects.filter((project) => project.featured).slice(0, 8);
const memoryProjects = projects
  .filter((project) => project.primaryPillar === "Agent Memory and Adaptation")
  .slice(0, 8);
const retrievalProjects = projects
  .filter((project) => project.primaryPillar === "Retrieval and Evidence")
  .slice(0, 8);
const verificationProjects = projects
  .filter((project) => project.primaryPillar === "Verification and Reliability")
  .slice(0, 8);

export default function PortfolioPage() {
  return (
    <main id="main-content" className="portfolio-page">
      <section className="portfolio-hero editorial-shell">
        <div className="hero-copy">
          <p className="eyebrow">Agent memory · Search · Reliable AI</p>
          <h1>Search. Remember. Verify. Act.</h1>
          <p className="hero-support">
            I build and evaluate AI agent systems that retrieve evidence, retain
            useful memory, revise stale or conflicting beliefs, and decide when
            to act or abstain.
          </p>
          <div className="hero-actions">
            <Link className="button button-primary" href="/">
              Ask about my work
            </Link>
            <Link className="button button-secondary" href="/projects">
              Explore projects
            </Link>
            <a
              className="text-link"
              href="https://github.com/pxnkit"
              target="_blank"
              rel="noopener noreferrer"
            >
              View GitHub <span aria-hidden="true">↗</span>
            </a>
          </div>
        </div>

        <div
          className="system-diagram"
          aria-label="Search leads to memory, verification, and action"
        >
          {[
            ["Search", "Search-Guided+Reasoning"],
            ["Memory", "Agent+Memory"],
            ["Verification", "Verification"],
            ["Action", "Tool-Agent+Evaluation"],
          ].map(([label, pillar], index) => (
            <Link
              className="system-step"
              href={`/projects?pillar=${pillar}`}
              key={label}
            >
              <span className="step-number">0{index + 1}</span>
              <strong>{label}</strong>
              {index < 3 ? (
                <span className="step-arrow" aria-hidden="true">
                  →
                </span>
              ) : null}
            </Link>
          ))}
          <p>
            Evidence can also return the system to search or make it abstain.
          </p>
        </div>
      </section>

      <section
        className="research-themes editorial-shell"
        aria-labelledby="themes-heading"
      >
        <p className="eyebrow">Research questions</p>
        <h2 id="themes-heading" className="sr-only">
          Research themes
        </h2>
        <div className="theme-statements">
          <Link href="/projects?pillar=Search-Guided+Reasoning">
            <span>01</span>
            When should an agent search?
          </Link>
          <Link href="/projects?pillar=Agent+Memory">
            <span>02</span>
            What should it remember?
          </Link>
          <Link href="/projects?pillar=Verification">
            <span>03</span>
            How should it verify?
          </Link>
          <Link href="/projects?pillar=Tool-Agent+Evaluation">
            <span>04</span>
            When should it act—or abstain?
          </Link>
        </div>
      </section>

      <section
        className="portfolio-section editorial-shell ranked-section"
        id="shortlist"
      >
        <SectionHeading
          primary="Curated shortlist."
          muted="Six research directions, ranked without invented detail."
        />
        <p className="section-intro">
          The project number and shortlist rank are separate. Only public,
          source-backed details are presented as fact.
        </p>
        <RankedProjectPanel
          rankedProjects={rankedProjects}
          projects={projects}
        />
      </section>

      <section className="portfolio-section rail-section">
        <div className="editorial-shell">
          <SectionHeading
            primary="Selected systems."
            muted="Built to test memory, retrieval, and reliable action."
          />
        </div>
        <ProjectRail
          title="Selected systems"
          label="selected research systems"
          projects={featured}
        />
      </section>

      <section className="portfolio-section rail-section">
        <div className="editorial-shell">
          <SectionHeading
            primary="Memory under pressure."
            muted="What survives correction, scope, contradiction, and time."
          />
        </div>
        <ProjectRail
          title="Agent memory and adaptation"
          label="agent memory projects"
          projects={memoryProjects}
        />
      </section>

      <section className="portfolio-section rail-section">
        <div className="editorial-shell">
          <SectionHeading
            primary="Search with evidence."
            muted="Route, corroborate, verify, and stop."
          />
        </div>
        <ProjectRail
          title="Retrieval and evidence"
          label="retrieval and evidence projects"
          projects={retrievalProjects}
        />
      </section>

      <section className="portfolio-section rail-section">
        <div className="editorial-shell">
          <SectionHeading
            primary="Built to be inspected."
            muted="Tests, traces, reproducibility, and explicit limitations."
          />
        </div>
        <ProjectRail
          title="Verification and reliability"
          label="verification and reliability projects"
          projects={verificationProjects}
        />
      </section>

      <section className="catalogue-callout editorial-shell">
        <div>
          <p className="eyebrow">Complete research catalogue</p>
          <h2>Twenty-nine public systems. One searchable index.</h2>
          <p>
            Filter by research pillar, search by exact project name or concept,
            and inspect source-backed status and limitations.
          </p>
        </div>
        <Link className="button button-primary" href="/projects">
          Browse every project
        </Link>
      </section>

      <section className="writing-callout editorial-shell">
        <SectionHeading
          primary="Research notes."
          muted="Ideas, experiments, and lessons from building agent systems."
        />
        <div className="writing-empty-card">
          <div>
            <p className="eyebrow">Writing</p>
            <h3>Notes are being prepared.</h3>
            <p>
              Project documentation is available in the meantime. Drafts remain
              private until they are ready to publish.
            </p>
          </div>
          <Link className="button button-secondary" href="/writing">
            Visit writing
          </Link>
        </div>
      </section>

      <footer className="profile-footer editorial-shell">
        <div>
          <p className="eyebrow">Pankit Brahmkhatri</p>
          <h2>Reliable systems begin with honest evidence.</h2>
        </div>
        <p>
          Master’s student in Computer Science focused on agent memory,
          information retrieval, test-time learning, search-guided reasoning,
          and reliable tool-using systems.
        </p>
        <div className="footer-links">
          <Link href="/">Ask the portfolio</Link>
          <Link href="/projects">Projects</Link>
          <Link href="/writing">Writing</Link>
          <Link href="/privacy">Privacy</Link>
          <a
            href="https://github.com/pxnkit"
            target="_blank"
            rel="noopener noreferrer"
          >
            GitHub ↗
          </a>
        </div>
      </footer>
    </main>
  );
}

function SectionHeading({
  primary,
  muted,
}: {
  primary: string;
  muted: string;
}) {
  return (
    <h2 className="section-heading">
      <span>{primary}</span> <em>{muted}</em>
    </h2>
  );
}
