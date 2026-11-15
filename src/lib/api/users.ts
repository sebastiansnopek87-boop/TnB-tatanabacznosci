import { invokeEdge } from "@/lib/api/edge";

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

export type ListUsersInput = {
  q: string;
  role: "" | "none" | UserRole;
  status: "" | "confirmed" | "unconfirmed";
  page: number;
};

export type ListUsersResult = {
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

export function listUsers({ data }: { data: ListUsersInput }): Promise<ListUsersResult> {
  return invokeEdge("tnb-users", { action: "listUsers", ...data });
}

export function getUserDetail({ data }: { data: { id: string } }): Promise<UserDetail> {
  return invokeEdge("tnb-users", { action: "getUserDetail", ...data });
}

export function setUserRole({ data }: { data: { id: string; role: UserRole; grant: boolean } }): Promise<{ ok: true }> {
  return invokeEdge("tnb-users", { action: "setUserRole", ...data });
}
