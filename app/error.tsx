"use client";

import Link from "next/link";

export default function ErrorPage({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main id="main-content" className="not-found-page editorial-shell">
      <p className="eyebrow">Something interrupted this view</p>
      <h1>The static portfolio is still available.</h1>
      <p>
        This page could not be completed. Try it once more, or continue through
        the project catalogue.
      </p>
      <div className="hero-actions">
        <button className="button button-primary" type="button" onClick={reset}>
          Try again
        </button>
        <Link className="button button-secondary" href="/projects">
          Browse projects
        </Link>
      </div>
    </main>
  );
}
