"use client";
import { createContext, useContext } from "react";
import type { Identity } from "@/lib/portal/types";
// Presentation only. Every protected read/write checks identity again on the server/DB.
const RoleContext = createContext<(Identity & { email: string }) | null>(null);
export function RoleProvider({
  children,
  identity,
}: {
  children: React.ReactNode;
  identity: (Identity & { email: string }) | null;
}) {
  return (
    <RoleContext.Provider value={identity}>{children}</RoleContext.Provider>
  );
}
export function useRole() {
  return useContext(RoleContext);
}
