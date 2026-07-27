import Link from "next/link";

export const metadata = {
  title: "Privacy",
  description:
    "How the portfolio research guide handles questions, browser-local history, and abuse protection.",
};

export default function PrivacyPage() {
  return (
    <main id="main-content" className="legal-page editorial-shell">
      <header className="page-hero">
        <p className="eyebrow">Privacy</p>
        <h1>A small, explicit data footprint.</h1>
        <p>
          This is a public research portfolio. The chat interface is an
          additional way to navigate its indexed sources.
        </p>
      </header>

      <div className="legal-content">
        <section>
          <h2>Portfolio content</h2>
          <p>
            Project pages, source metadata, and published writing are public.
            External links lead to their own services and policies.
          </p>
        </section>
        <section>
          <h2>Chat questions</h2>
          <p>
            Questions are sent to the configured portfolio answer provider. This
            application does not intentionally persist chat content on the
            server. When generated answers are unavailable, retrieval-only
            results keep the project sources usable.
          </p>
        </section>
        <section>
          <h2>Browser-local history</h2>
          <p>
            Conversation history is stored only in this browser. Use “Clear
            conversation” in the chat to remove it. If browser storage is
            blocked or corrupted, the chat starts with a clean local state.
          </p>
        </section>
        <section>
          <h2>Abuse controls</h2>
          <p>
            Approximate request limits may use one-way hashed network
            information with a rotating date component. Raw network addresses
            are not intended to be stored by this application.
          </p>
        </section>
        <section>
          <h2>Analytics and cookies</h2>
          <p>
            Advertising trackers and analytics are disabled by default. The site
            does not require user accounts and sets no nonessential application
            cookies.
          </p>
        </section>
        <p className="legal-note">
          This explanation describes the application’s intended behavior; it is
          not a legal compliance statement.
        </p>
        <Link className="button button-secondary" href="/">
          Return to chat
        </Link>
      </div>
    </main>
  );
}
