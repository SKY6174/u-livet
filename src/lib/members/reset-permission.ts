import type { Identity } from "@/lib/portal/types";

const PASSWORD_RESET_OPERATOR_EMAIL = "kysong@uc.ac.kr";

export function canSendMemberPasswordReset(identity: Identity & { email?: string }) {
  return identity.is_super_admin === true
    && identity.email?.toLowerCase() === PASSWORD_RESET_OPERATOR_EMAIL
    && identity.roles.some(role => role.role === "SYSTEM_ADMIN");
}
