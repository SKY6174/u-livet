import type { MetadataRoute } from "next";
import { getCourseCatalog } from "@/lib/course-guide/data";

const PUBLIC_PATHS = ["/", "/about", "/operation-procedure", "/courses", "/terms", "/privacy", "/manuals"];

export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const origin = new URL(process.env.RELEASE_PRODUCTION_SITE_ORIGIN ?? "https://u-livet.org").origin;
  const { courses } = await getCourseCatalog();
  const paths = [...PUBLIC_PATHS, ...courses.map((course) => course.href)];

  return Array.from(new Set(paths)).map((path) => ({ url: new URL(path, origin).toString() }));
}
