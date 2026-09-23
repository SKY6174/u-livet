import type { Identity } from "@/lib/portal/types";
import { OFFICE_POSITIONS } from "./login-audience";

type Member = Pick<Identity, "roles" | "member_group" | "office_position" | "instructor_kind" | "member_entry_orgs" | "is_super_admin">;
export type WorkspaceLink = { label: string; href: string; description: string };
const OFFICE_ROLES = ["SYSTEM_ADMIN", "COURSE_MANAGER", "CERTIFIER", "FINANCE", "PERFORMANCE"];
export const hasRole = (member: Member, ...roles: string[]) =>
  member.roles.some((entry) => roles.includes(entry.role));
export const isOfficeMember = (member: Member) => member.member_group === "office" || hasRole(member, ...OFFICE_ROLES) || !!member.member_entry_orgs?.length;
export const workspaceKind = (member: Member) =>
  isOfficeMember(member) ? "office" : hasRole(member, "INSTRUCTOR") ? "instructor" : "learner";

export function memberLabel(member: Member) {
  if (member.is_super_admin) return "최고 관리자";
  if (isOfficeMember(member)) return member.office_position
    ? `관리자 · ${OFFICE_POSITIONS[member.office_position]}` : "관리자";
  if (hasRole(member, "INSTRUCTOR")) return member.instructor_kind
    ? `강사(${member.instructor_kind === "INTERNAL" ? "교내" : "교외"})` : "강사";
  return "수강생";
}

// Presentation follows granted roles. Server routes, RPCs and RLS remain authoritative.
export function officeSections(member: Member) {
  const manager = hasRole(member, "COURSE_MANAGER");
  const certifier = hasRole(member, "COURSE_MANAGER", "CERTIFIER");
  return [
    { title: "기획·개설", links: [
      ...(hasRole(member, "COURSE_MANAGER", "SYSTEM_ADMIN") ? [
        { label: "과정 운영 관리", href: "/admin/courses", description: "과정 개설·모집, 강사 배정과 출결을 관리합니다." },
      ] : []),
      ...(manager ? [
        { label: "전문가 관리", href: "/admin/instructors", description: "교내·교외·보조강사 대장, 비공개 서류와 교육과정 활동·수당 지급을 관리합니다." },
      ] : []),
      ...(hasRole(member, "COURSE_MANAGER", "SYSTEM_ADMIN") ? [
        { label: "운영계획서", href: "/operation-documents/plan", description: "책임강사 작성, 담당자 예산 검토와 최종 제출" },
      ] : []),
    ] },
    { title: "접수·운영", links: [
      ...(hasRole(member, "COURSE_MANAGER", "SYSTEM_ADMIN", "FINANCE") ? [{ label: "수강생 서류", href: "/admin/learner-documents", description: "수강신청·장학금·환불 서류의 접수 원본과 처리 이력을 관리합니다." }] : []),
      ...(hasRole(member, "COURSE_MANAGER", "SYSTEM_ADMIN") ? [{ label: "무료 주차권 관리", href: "/admin/parking", description: "과정별 담당 센터, 발급 신청·승인, 재고와 사용대장을 관리합니다." }] : []),
    ] },
    { title: "마감·수료", links: [
      ...(hasRole(member, "COURSE_MANAGER", "SYSTEM_ADMIN") ? [
        { label: "결과보고서", href: "/operation-documents/result", description: "공식 결과보고서와 과정별 결과 보고·6종 증빙을 관리합니다." },
      ] : []),
      ...(certifier ? [
        { label: "수료 검토", href: "/completion", description: "출결·평가 근거를 확인하고 수료 판정을 검토·승인합니다." },
        { label: "증명 관리", href: "/credentials", description: "증명 신청·발급과 디지털배지를 관리합니다." },
      ] : []),
    ] },
    { title: "정산·성과", links: [
      ...(hasRole(member, "FINANCE") ? [{ label: "수납·환불", href: "/finance", description: "교육비 수납과 환불 처리 내역을 확인합니다." }] : []),
      ...(hasRole(member, "COURSE_MANAGER", "PERFORMANCE") ? [{ label: "연차 평가·성과", href: "/performance", description: "사업연도별 운영 통계와 성과 보고를 관리합니다." }] : []),
    ] },
    { title: "계정·권한", links: [
      ...((hasRole(member, "SYSTEM_ADMIN") || !!member.member_entry_orgs?.length) ? [{ label: "구성원 관리", href: "/admin/accounts", description: "사업단·강사·수강생의 정보와 활동 이력을 관리합니다." }] : []),
    ] },
  ].filter((section) => section.links.length);
}

export const courseOperationLinks: WorkspaceLink[] = [
  { label: "2026 과정 현황", href: "/admin/course-plan", description: "연간 교육과정 현황" },
  { label: "2026 개설 준비", href: "/admin/course-plan/opening", description: "운영계획서 기반 개설 준비" },
  { label: "과정 개발·심의", href: "/admin/development", description: "제안 과정 개발과 심의" },
  { label: "안내문자 관리", href: "/admin/messages", description: "안내문 예약·처리 이력" },
];

const within = (path: string, base: string) => path === base || path.startsWith(base + "/");
export function officeActiveHref(path: string) {
  if (within(path, "/operation-documents/plan") || /^\/operation-documents\/[^/]+\/plan(?:\/|$)/.test(path)) return "/operation-documents/plan";
  if (within(path, "/operation-documents/result") || /^\/operation-documents\/[^/]+\/result(?:\/|$)/.test(path)) return "/operation-documents/result";
  if (within(path, "/operation-documents")) return "/operation-documents/plan";
  if (within(path, "/admin/reports") || /^\/admin\/offerings\/[^/]+\/reports(?:\/|$)/.test(path)) return "/operation-documents/result";
  for (const href of ["/completion", "/credentials", "/finance", "/performance", "/admin/accounts", "/admin/instructors", "/admin/parking", "/admin/learner-documents"])
    if (within(path, href)) return href;
  return path === "/admin" ? "/admin" : "/admin/courses";
}
export function primaryLinks(member: Member | null, loginPage = false) {
  const links = [
    { label: "앵커사업 소개", href: "/about" },
    { label: "수강안내", href: "/terms" },
    { label: "교육과정 소개", href: "/courses" },
  ];
  if (!member || loginPage) return links;
  if (isOfficeMember(member)) links.push({ label: "사업단 관리", href: "/admin" });
  // 강사 권한 계정은 '강사 공간'과 '내 정보'를 일원화된 'My Room'으로 제공합니다.
  if (hasRole(member, "INSTRUCTOR")) {
    links.push({ label: "My Room", href: "/instructor" });
  } else {
    links.push({ label: workspaceKind(member) === "learner" ? "나의 학습" : "내 정보", href: "/mypage" });
  }
  return links;
}
export function primaryActive(path: string, href: string) {
  if (href === "/admin") return ["/admin", "/operation-documents", "/completion", "/credentials", "/finance", "/performance"].some((base) => within(path, base));
  if (href === "/instructor") return ["/instructor", "/development", "/mypage", "/auth/security", "/quality"].some(base => within(path, base));
  return within(path, href);
}
