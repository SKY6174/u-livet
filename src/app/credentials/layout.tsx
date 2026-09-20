import { OfficeSection } from "@/components/navigation/office-section";
export default function Layout({ children }: { children: React.ReactNode }) {
  return <OfficeSection roles={["COURSE_MANAGER", "CERTIFIER"]} returnTo="/credentials">{children}</OfficeSection>;
}
