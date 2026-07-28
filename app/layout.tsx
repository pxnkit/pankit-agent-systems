import type { Metadata } from "next";
import { GlobalNavigation } from "@/components/navigation/global-navigation";
import { GeistMono } from "geist/font/mono";
import { GeistSans } from "geist/font/sans";
import "@fontsource/newsreader/500.css";
import "@fontsource/newsreader/600.css";
import "./globals.css";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default:
      "Pankit Brahmkhatri — Agent Memory, Search, and Reliable AI Systems",
    template: "%s — Pankit Brahmkhatri",
  },
  description:
    "Research projects and writing on agent memory, information retrieval, verification, test-time learning, and reliable tool-using AI systems.",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
  openGraph: {
    type: "website",
    title: "Pankit Brahmkhatri — Agent Memory, Search, and Reliable AI Systems",
    description:
      "Research projects and writing on agent memory, retrieval, verification, test-time learning, and reliable tool-using systems.",
    images: ["/og.png"],
  },
  twitter: {
    card: "summary_large_image",
    title: "Search. Remember. Verify. Act.",
    description:
      "Pankit Brahmkhatri’s research portfolio for reliable AI agent systems.",
    images: ["/og.png"],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html:
              "try{const t=localStorage.getItem('pxnkit-theme');if(t==='dark'||(t!=='light'&&matchMedia('(prefers-color-scheme: dark)').matches))document.documentElement.dataset.theme='dark'}catch{}",
          }}
        />
      </head>
      <body className={`${GeistSans.variable} ${GeistMono.variable}`}>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "Person",
              name: "Pankit Brahmkhatri",
              url: siteUrl,
              sameAs: ["https://github.com/pxnkit"],
              jobTitle: "Master’s student in Computer Science",
              affiliation: {
                "@type": "CollegeOrUniversity",
                name: "TU Dresden",
              },
              knowsAbout: [
                "agent memory",
                "information retrieval",
                "test-time learning",
                "search-guided reasoning",
                "reliable tool-using AI agents",
              ],
            }).replace(/</g, "\\u003c"),
          }}
        />
        <a className="skip-link" href="#main-content">
          Skip to content
        </a>
        <GlobalNavigation />
        {children}
      </body>
    </html>
  );
}
