import type { MetadataRoute } from "next";

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: "http://localhost:6396/" },
    { url: "http://localhost:6396/assessment" },
    { url: "http://localhost:6396/onboarding" },
    { url: "http://localhost:6396/employers" },
    { url: "http://localhost:6396/employers/talent" },
    { url: "http://localhost:6396/employers/talent/candidate-001" },
    { url: "http://localhost:6396/u/test-user-0001" },
    { url: "http://localhost:6396/u/test-user-0001/projects/project-alpha-001" },
  ];
}
