import { createServerSupabaseClient } from "@/lib/supabase/server";
import type {
  MyParkingContext,
  ParkingAdminContext,
  ParkingCenterCode,
} from "./types";

export async function getMyParkingContext(): Promise<MyParkingContext | null> {
  const { data, error } = await (
    await createServerSupabaseClient()
  ).rpc("life_parking_my_context");
  return error || !data ? null : (data as MyParkingContext);
}

export async function getAdminParkingContext(
  year: number,
  center: ParkingCenterCode | null,
): Promise<ParkingAdminContext | null> {
  const { data, error } = await (
    await createServerSupabaseClient()
  ).rpc("life_parking_admin_context", { y: year, c: center });
  return error || !data ? null : (data as ParkingAdminContext);
}
