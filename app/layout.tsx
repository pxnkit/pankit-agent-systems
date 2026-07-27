import type { Metadata } from "next";
import { GlobalNavigation } from "@/components/navigation/global-navigation";
import "@fontsource-variable/inter";
import "./globals.css";

const siteUrl =
  process.env.NEXT_PUBLIC_SITE_URL ??
  "https://pankit-agent-systems.sites.openai.com";

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
      <body>
        <a className="skip-link" href="#main-content">
          Skip to content
        </a>
        <GlobalNavigation />
        {children}
      </body>
    </html>
  );
}
