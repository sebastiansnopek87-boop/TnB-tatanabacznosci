import { invokeTnbFunction } from "@/lib/api/client";

export const ROLE_VALUES = ["superadmin", "admin", "moderator", "editor", "support", "premium"] as const;
export type UserRole = (typeof ROLE_VALUES)[number];
export type UserRoleFilter = "" | "none" | UserRole;
export type UserStatusFilter = "" | "confirmed" | "unconfirmed";

export type AdminUser = {
  id: string;
  email: string | null;
  created_at: string;
  confirmed: boolean;
  last_sign_in_at: string | null;
  banned: boolean;
  name: string | null;
  nick: string | null;
  roles: string[];
  tnb_id: string | null;
};

export type UserListResult = {
  rows: AdminUser[];
  total: number;
  pageSize: number;
  canManage: boolean;
};

export type UserDetail = AdminUser & {
  providers: string[];
  isSelf: boolean;
  canManage: boolean;
};

type ServerCall<T> = { data: T };

export function listUsers({ data }: ServerCall<{
  q?: string;
  role?: UserRoleFilter;
  status?: UserStatusFilter;
  page?: number;
}>): Promise<UserListResult> {
  return invokeTnbFunction<UserListResult>("tnb-users", {
    action: "listUsers",
    q: data.q ?? "",
    role: data.role ?? "",
    status: data.status ?? "",
    page: data.page ?? 0,
  });
}

export function getUserDetail({ data }: ServerCall<{ id: string }>): Promise<UserDetail> {
  return invokeTnbFunction<UserDetail>("tnb-users", {
    action: "getUserDetail",
    id: data.id,
  });
}

export function setUserRole({ data }: ServerCall<{
  id: string;
  role: UserRole;
  grant: boolean;
}>): Promise<{ ok: true }> {
  return invokeTnbFunction<{ ok: true }>("tnb-users", {
    action: "setUserRole",
    id: data.id,
    role: data.role,
    grant: data.grant,
  });
}
