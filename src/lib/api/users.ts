import { invokeEdge } from "./_invoke";

export const ROLE_VALUES = ["superadmin", "admin", "moderator", "editor", "support", "premium"] as const;
export type UserRole = (typeof ROLE_VALUES)[number];

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

export type AdminUserDetail = AdminUser & {
  providers: string[];
  isSelf: boolean;
  canManage: boolean;
};

export type AdminUsersResult = {
  rows: AdminUser[];
  total: number;
  pageSize: number;
  canManage: boolean;
};

export type ListUsersInput = {
  q?: string;
  role?: "" | "none" | UserRole;
  status?: "" | "confirmed" | "unconfirmed";
  page?: number;
};

export async function listUsers(input: ListUsersInput = {}): Promise<AdminUsersResult> {
  return invokeEdge("tnb-users", {
    action: "listUsers",
    q: input.q ?? "",
    role: input.role ?? "",
    status: input.status ?? "",
    page: input.page ?? 0,
  });
}

export async function getUserDetail(input: { id: string }): Promise<AdminUserDetail> {
  return invokeEdge("tnb-users", { action: "getUserDetail", id: input.id });
}

export async function setUserRole(input: { id: string; role: UserRole; grant: boolean }): Promise<{ ok: true }> {
  return invokeEdge("tnb-users", { action: "setUserRole", ...input });
}
