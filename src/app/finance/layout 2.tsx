import { OfficeSection } from "@/components/navigation/office-section";
export default function Layout({ children }: { children: React.ReactNode }) {
  return <OfficeSection roles={["FINANCE"]} returnTo="/finance">{children}</OfficeSection>;
}
