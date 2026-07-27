"use client";

import { useMemo, useState } from "react";
import type { Project } from "@/data/projects";
import { ProjectCard } from "./project-card";

const FILTERS = [
  "All",
  "Agent Memory",
  "Retrieval and Evidence",
  "Verification",
  "Search-Guided Reasoning",
  "Tool-Agent Evaluation",
  "Applied Systems",
] as const;

type Filter = (typeof FILTERS)[number];
type Sort = "Curated" | "Recently updated" | "Alphabetical";

function filterMatches(project: Project, filter: Filter) {
  if (filter === "All") return true;
  const map: Record<Exclude<Filter, "All">, string> = {
    "Agent Memory": "Agent Memory and Adaptation",
    "Retrieval and Evidence": "Retrieval and Evidence",
    Verification: "Verification and Reliability",
    "Search-Guided Reasoning": "Search-Guided Reasoning",
    "Tool-Agent Evaluation": "Tool-Using Agent Evaluation",
    "Applied Systems": "Applied Agent Systems",
  };
  return (
    project.primaryPillar === map[filter] ||
    project.tags.some((tag) => tag.toLowerCase().includes(filter.toLowerCase()))
  );
}

function searchMatches(project: Project, query: string) {
  if (!query) return true;
  const haystack = [
    project.title,
    project.shortDescription,
    project.longDescription,
    project.primaryPillar,
    ...project.aliases,
    ...project.tags,
    ...project.technologies,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  return haystack.includes(query.toLowerCase());
}

export function ProjectCatalogue({ projects }: { projects: Project[] }) {
  const [filter, setFilter] = useState<Filter>("All");
  const [sort, setSort] = useState<Sort>("Curated");
  const [query, setQuery] = useState("");

  const visible = useMemo(() => {
    const result = projects.filter(
      (project) =>
        filterMatches(project, filter) && searchMatches(project, query.trim()),
    );
    if (sort === "Alphabetical") {
      return result.toSorted((a, b) => a.title.localeCompare(b.title));
    }
    if (sort === "Recently updated") {
      return result.toSorted((a, b) =>
        (b.updatedAt ?? "").localeCompare(a.updatedAt ?? ""),
      );
    }
    return result;
  }, [filter, projects, query, sort]);

  return (
    <section className="catalogue" aria-label="Research project catalogue">
      <div className="catalogue-tools">
        <label className="catalogue-search">
          <span>Search projects</span>
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Try “memory correction” or “MemEquiv”"
          />
        </label>
        <label className="sort-control">
          <span>Sort</span>
          <select
            value={sort}
            onChange={(event) => setSort(event.target.value as Sort)}
          >
            <option>Curated</option>
            <option>Recently updated</option>
            <option>Alphabetical</option>
          </select>
        </label>
      </div>

      <div className="filter-pills" aria-label="Filter projects">
        {FILTERS.map((item) => (
          <button
            type="button"
            key={item}
            className={
              filter === item ? "filter-pill is-active" : "filter-pill"
            }
            aria-pressed={filter === item}
            onClick={() => setFilter(item)}
          >
            {item}
          </button>
        ))}
      </div>

      <div className="catalogue-summary" aria-live="polite">
        <strong>{visible.length}</strong>{" "}
        {visible.length === 1 ? "project" : "projects"}
      </div>

      {visible.length ? (
        <div className="catalogue-grid">
          {visible.map((project) => (
            <ProjectCard key={project.slug} project={project} compact />
          ))}
        </div>
      ) : (
        <div className="empty-state">
          <p className="eyebrow">No matching projects</p>
          <h2>Try a broader research term.</h2>
          <p>
            Search by project title, alias, research pillar, technology, or
            documented concept.
          </p>
          <button
            type="button"
            className="button button-secondary"
            onClick={() => {
              setQuery("");
              setFilter("All");
            }}
          >
            Clear filters
          </button>
        </div>
      )}
    </section>
  );
}
