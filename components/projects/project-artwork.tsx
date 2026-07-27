export function ProjectArtwork({
  slug,
  title,
}: {
  slug: string;
  title: string;
}) {
  return (
    <div
      className="project-artwork"
      data-project={slug}
      role="img"
      aria-label={`Abstract artwork for ${title}`}
    >
      <div className="art-orbit orbit-one" />
      <div className="art-orbit orbit-two" />
      <div className="art-track track-one" />
      <div className="art-track track-two" />
      <div className="art-node node-one" />
      <div className="art-node node-two" />
      <div className="art-node node-three" />
      <div className="art-node node-four" />
      <div className="art-label">{title.slice(0, 2).toUpperCase()}</div>
    </div>
  );
}
