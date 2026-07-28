import Link from "next/link";

export type TrustedSource = {
  id: string;
  title: string;
  excerpt?: string;
  projectSlug?: string;
  section?: string;
  type?: string;
  internalUrl?: string;
  url?: string;
  status?: string;
};

export function SourceCard({ source }: { source: TrustedSource }) {
  const href =
    source.internalUrl ??
    source.url ??
    (source.projectSlug ? `/projects/${source.projectSlug}` : undefined);
  if (!href) return null;
  const external = href.startsWith("https://");

  const content = (
    <>
      <span className="source-type">{source.type ?? "Portfolio source"}</span>
      <strong>{source.title}</strong>
      {source.section ? <span>{source.section}</span> : null}
      {source.status ? <small>{source.status}</small> : null}
    </>
  );

  return external ? (
    <a
      className="source-card"
      href={href}
      target="_blank"
      rel="noopener noreferrer"
    >
      {content}
    </a>
  ) : (
    <Link className="source-card" href={href}>
      {content}
    </Link>
  );
}
