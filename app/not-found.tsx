import Link from "next/link";

export default function NotFound() {
  return (
    <main id="main-content" className="not-found-page editorial-shell">
      <p className="eyebrow">404 · Not found</p>
      <h1>This source is not in the index.</h1>
      <p>
        The route may have moved, remained a private draft, or never had a
        verified public page.
      </p>
      <div className="hero-actions">
        <Link className="button button-primary" href="/">
          Ask the portfolio guide
        </Link>
        <Link className="button button-secondary" href="/projects">
          Browse projects
        </Link>
      </div>
    </main>
  );
}
