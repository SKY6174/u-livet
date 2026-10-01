import { OfficeSection } from "@/components/navigation/office-section";

export default function CourseLayout({ children }: { children: React.ReactNode }) {
  return <OfficeSection roles={["COURSE_MANAGER", "SYSTEM_ADMIN"]} returnTo="/admin/courses">{children}</OfficeSection>;
}
