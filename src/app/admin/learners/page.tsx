import { getManagementBoard, managementFilters } from "@/lib/management/data";
import { ManagementList } from "@/components/management/management-list";
export default async function Learners({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const filters = managementFilters(await searchParams);
  return <ManagementList kind="learners" filters={filters} data={await getManagementBoard("learners", filters)} />;
}
