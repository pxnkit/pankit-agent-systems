"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Project } from "@/data/projects";
import { ProjectCard } from "./project-card";

export function ProjectRail({
  title,
  projects,
  label,
}: {
  title: string;
  projects: Project[];
  label: string;
}) {
  const railRef = useRef<HTMLUListElement | null>(null);
  const [atStart, setAtStart] = useState(true);
  const [atEnd, setAtEnd] = useState(false);

  const updateBoundaries = useCallback(() => {
    const rail = railRef.current;
    if (!rail) return;
    setAtStart(rail.scrollLeft <= 4);
    setAtEnd(rail.scrollLeft + rail.clientWidth >= rail.scrollWidth - 4);
  }, []);

  useEffect(() => {
    const rail = railRef.current;
    updateBoundaries();
    if (!rail) return;
    rail.addEventListener("scroll", updateBoundaries, { passive: true });
    const observer = new ResizeObserver(updateBoundaries);
    observer.observe(rail);
    return () => {
      rail.removeEventListener("scroll", updateBoundaries);
      observer.disconnect();
    };
  }, [updateBoundaries, projects.length]);

  function scroll(direction: -1 | 1) {
    const rail = railRef.current;
    if (!rail) return;
    const card = rail.querySelector<HTMLElement>(".project-card");
    const distance = (card?.offsetWidth ?? 380) + 22;
    rail.scrollBy({ left: direction * distance, behavior: "smooth" });
  }

  if (!projects.length) return null;

  return (
    <div className="project-rail-wrap" aria-label={label}>
      <div className="rail-toolbar">
        <h3 className="sr-only">{title}</h3>
        <div className="rail-controls">
          <button
            type="button"
            className="rail-button"
            onClick={() => scroll(-1)}
            disabled={atStart}
            aria-label={`Previous ${label}`}
          >
            <span aria-hidden="true">←</span>
          </button>
          <button
            type="button"
            className="rail-button"
            onClick={() => scroll(1)}
            disabled={atEnd}
            aria-label={`Next ${label}`}
          >
            <span aria-hidden="true">→</span>
          </button>
        </div>
      </div>
      <ul className="project-rail" ref={railRef}>
        {projects.map((project) => (
          <li key={project.slug}>
            <ProjectCard project={project} />
          </li>
        ))}
      </ul>
    </div>
  );
}
