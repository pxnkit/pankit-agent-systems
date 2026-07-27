"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ThemeControl } from "./theme-control";

export function GlobalNavigation() {
  const pathname = usePathname();
  const chatActive = pathname === "/";
  const portfolioActive = !chatActive;

  return (
    <header className="site-header">
      <nav className="global-nav" aria-label="Primary">
        <Link
          className="wordmark"
          href="/portfolio"
          aria-label="Pankit Brahmkhatri, portfolio"
        >
          pxnkit
        </Link>

        <div className="mode-switch" aria-label="Site mode">
          <Link
            href="/"
            className={chatActive ? "mode-link is-active" : "mode-link"}
            aria-current={chatActive ? "page" : undefined}
          >
            Chat
          </Link>
          <Link
            href="/portfolio"
            className={portfolioActive ? "mode-link is-active" : "mode-link"}
            aria-current={portfolioActive ? "page" : undefined}
          >
            Portfolio
          </Link>
        </div>

        <div className="nav-actions">
          <Link className="nav-text-link" href="/writing">
            Writing
          </Link>
          <a
            className="nav-text-link"
            href="https://github.com/pxnkit"
            target="_blank"
            rel="noopener noreferrer"
          >
            GitHub
          </a>
          <ThemeControl />
        </div>
      </nav>
    </header>
  );
}
