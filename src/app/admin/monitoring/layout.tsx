import { OfficeSection } from "@/components/navigation/office-section";

export default function MonitoringLayout({ children }: { children: React.ReactNode }) {
  return OfficeSection({ children, roles: ["COURSE_MANAGER"], returnTo: "/admin/monitoring" });
}
