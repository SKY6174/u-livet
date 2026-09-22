export type ParkingCenterCode = "RCC" | "ECC" | "AID-X";
export type ParkingStatus = "PENDING" | "APPROVED" | "REJECTED" | "CANCELLED";

export type ParkingOffering = {
  id: string;
  name: string;
  starts_on: string;
  ends_on: string;
  center_code: ParkingCenterCode | null;
  org_id?: string;
  kind?: "LEARNER" | "EXTERNAL_INSTRUCTOR";
};
export type MyParkingRequest = {
  id: string;
  offering_id: string;
  center_code: ParkingCenterCode;
  course_name: string;
  recipient_name: string;
  phone: string;
  use_on: string;
  quantity: number;
  status: ParkingStatus;
  requested_at: string;
  reviewed_at: string | null;
  decision_note: string;
};
export type ParkingCenter = {
  code: ParkingCenterCode;
  label: string;
  reviewer_name: string;
  reviewer_email: string;
};
export type ParkingAdminRequest = MyParkingRequest & {
  org_id: string;
  requester_name: string;
  reviewer_name: string | null;
  remaining_after: number | null;
  can_decide: boolean;
};
export type ParkingStock = {
  org_id: string;
  center_code: ParkingCenterCode;
  balance: number;
};
export type MyParkingContext = {
  offerings: ParkingOffering[];
  requests: MyParkingRequest[];
};
export type ParkingAdminContext = {
  centers: ParkingCenter[];
  organizations: { id: string; name: string }[];
  offerings: ParkingOffering[];
  stock: ParkingStock[];
  requests: ParkingAdminRequest[];
};

export const PARKING_STATUS_LABELS: Record<ParkingStatus, string> = {
  PENDING: "승인 대기",
  APPROVED: "승인·발급 완료",
  REJECTED: "반려",
  CANCELLED: "신청 취소",
};
export const PARKING_CENTERS: ParkingCenterCode[] = ["RCC", "ECC", "AID-X"];
