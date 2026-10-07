import { getManagementBoard, managementFilters } from "@/lib/management/data";
import { ManagementList } from "@/components/management/management-list";
export default async function Applications({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const filters = managementFilters(await searchParams);
  return <ManagementList kind="applications" filters={filters} data={await getManagementBoard("applications", filters)} />;
}
