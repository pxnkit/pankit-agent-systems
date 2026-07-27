import type { MetadataRoute } from "next";
import { projects } from "@/data/projects";

export default function sitemap(): MetadataRoute.Sitemap {
  const base =
    process.env.NEXT_PUBLIC_SITE_URL ??
    "https://pankit-agent-systems.brahmkhatripankit.chatgpt.site";
  const staticRoutes = ["", "/portfolio", "/projects", "/writing", "/privacy"];

  return [
    ...staticRoutes.map((route) => ({
      url: `${base}${route}`,
      changeFrequency: "weekly" as const,
      priority: route === "" ? 1 : route === "/portfolio" ? 0.9 : 0.7,
    })),
    ...projects.map((project) => ({
      url: `${base}/projects/${project.slug}`,
      lastModified: project.updatedAt ? new Date(project.updatedAt) : undefined,
      changeFrequency: "monthly" as const,
      priority: project.featured ? 0.8 : 0.6,
    })),
  ];
}
