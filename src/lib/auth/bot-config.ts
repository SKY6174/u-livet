import "server-only";
import { botProtectionConfig } from "./abuse-policy";

export function getBotProtection() {
  return botProtectionConfig(process.env);
}
