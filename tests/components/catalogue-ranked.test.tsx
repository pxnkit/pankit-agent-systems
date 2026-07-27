import "./test-setup";
import { fireEvent, render, screen } from "@testing-library/react";
import { vi } from "vitest";
import { ProjectCatalogue } from "@/components/portfolio/project-catalogue";
import { RankedProjectPanel } from "@/components/portfolio/ranked-project-panel";
import type { Project } from "@/data/projects";

vi.mock("next/link", () => ({
  default: ({
    href,
    children,
    ...props
  }: React.AnchorHTMLAttributes<HTMLAnchorElement> & { href: string }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

const verified: Project = {
  slug: "memequiv",
  title: "MemEquiv",
  shortDescription: "Executable contracts for persistent memory equivalence.",
  primaryPillar: "Agent Memory and Adaptation",
  tags: ["memory correction"],
  aliases: ["Mem Equiv"],
  repositoryUrl: "https://github.com/pxnkit/memequiv",
  featured: true,
  sourceStatus: "verified",
  languages: ["Python"],
  technologies: ["FastAPI"],
  cardVariant: "accent",
  sourceIds: ["memequiv-readme"],
  limitations: ["Synthetic fixture."],
  relatedProjects: [],
};

const pending: Project = {
  slug: "chaffmem",
  title: "ChaffMem",
  primaryPillar: "Curated shortlist",
  tags: [],
  aliases: [],
  featured: false,
  sourceStatus: "pending",
  languages: [],
  technologies: [],
  cardVariant: "dark",
  sourceIds: [],
  limitations: [],
  relatedProjects: [],
};

test("catalogue search and empty state stay local", () => {
  render(<ProjectCatalogue projects={[verified, pending]} />);
  const search = screen.getByRole("searchbox", { name: "Search projects" });
  fireEvent.change(search, { target: { value: "memory correction" } });
  expect(screen.getByRole("heading", { name: "MemEquiv" })).toBeVisible();
  expect(
    screen.queryByRole("heading", { name: "ChaffMem" }),
  ).not.toBeInTheDocument();

  fireEvent.change(search, { target: { value: "not present" } });
  expect(
    screen.getByRole("heading", { name: "Try a broader research term." }),
  ).toBeVisible();
});

test("ranked row interaction updates the honest preview", () => {
  render(
    <RankedProjectPanel
      rankedProjects={[
        { rank: 1, projectNumber: 24, title: "ChaffMem", slug: "chaffmem" },
        { rank: 2, projectNumber: 21, title: "MemEquiv", slug: "memequiv" },
      ]}
      projects={[verified, pending]}
    />,
  );
  fireEvent.mouseEnter(
    screen.getByRole("link", { name: "21. MemEquiv" }).closest("tr")!,
  );
  expect(screen.getByText("Verified public source")).toBeVisible();
  expect(screen.getByRole("link", { name: "Open project" })).toHaveAttribute(
    "href",
    "/projects/memequiv",
  );
});
