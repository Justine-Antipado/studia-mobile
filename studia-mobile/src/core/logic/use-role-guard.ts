// use-role-guard.ts — client-side route guard for the /student and /instructor groups.
//
// SECURITY: this only hides UI. Real authorization MUST be enforced by the backend on every
// request (role claim in the token, ownership checks per class/assignment/submission).
import { router } from "expo-router";
import { useEffect } from "react";

import { useUser } from "@/core/data/storage/session-store";
import type { Role } from "@/core/types/role";

export const HOME_ROUTE: Record<Role, "/student/home" | "/instructor/home"> = {
  student: "/student/home",
  instructor: "/instructor/home",
};

export type GuardState = {
  /** Render the group only when this is true. */
  allowed: boolean;
  /** A redirect is in flight — render a neutral placeholder, never a dead end. */
  redirecting: boolean;
};

/**
 * Allows the group when the session role matches. Without a session it redirects to /auth
 * (except in __DEV__, where session-store serves a demo user so a route can be opened directly
 * after a hot reload). A role mismatch redirects to that role's own home.
 */
export function useRoleGuard(role: Role): GuardState {
  const user = useUser();
  const noSession = user === null;
  const mismatch = user !== null && user.role !== role;

  useEffect(() => {
    if (mismatch && user) {
      router.replace(HOME_ROUTE[user.role]);
      return;
    }
    if (noSession && !__DEV__) {
      router.replace({ pathname: "/auth", params: { role } });
    }
  }, [mismatch, noSession, role, user]);

  if (mismatch) return { allowed: false, redirecting: true };
  if (noSession) return { allowed: __DEV__, redirecting: !__DEV__ };
  return { allowed: true, redirecting: false };
}
