import Link from "next/link";

export const metadata = {
  title: "Writing",
  description:
    "Research notes on agent memory, retrieval, test-time learning, verification, and reliable AI systems.",
};

export default function WritingPage() {
  return (
    <main id="main-content" className="writing-page editorial-shell">
      <header className="page-hero writing-hero">
        <p className="eyebrow">Research writing and notes</p>
        <h1>Thinking in public—when the evidence is ready.</h1>
        <p>
          Notes will connect implementation decisions, evaluation design, and
          explicit limitations across the project catalogue.
        </p>
        <a className="text-link" href="/rss.xml">
          RSS feed <span aria-hidden="true">↗</span>
        </a>
      </header>

      <section
        className="empty-state writing-empty"
        aria-labelledby="writing-empty-title"
      >
        <div className="empty-state-mark" aria-hidden="true">
          <span />
          <span />
          <span />
        </div>
        <p className="eyebrow">No published articles yet</p>
        <h2 id="writing-empty-title">Research notes are being prepared.</h2>
        <p>
          Project documentation is available in the meantime. Draft notes are
          intentionally not exposed as published writing.
        </p>
        <div className="hero-actions">
          <Link className="button button-primary" href="/projects">
            Explore project documentation
          </Link>
          <Link className="button button-secondary" href="/">
            Ask the portfolio guide
          </Link>
        </div>
      </section>
    </main>
  );
}
