import { supabase } from "@/integrations/supabase/client";

export const ROLE_VALUES = ["superadmin", "admin", "moderator", "editor", "support", "premium"] as const;
export type UserRole = (typeof ROLE_VALUES)[number];

type EdgeError = { error?: string; message?: string };

async function invokeUsers<T>(action: string, payload: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke<T>("tnb-users", {
    body: { action, ...payload },
  });

  if (error) {
    const response = (error as { context?: unknown }).context;
    if (response instanceof Response) {
      const body = await response.clone().json().catch(() => null) as EdgeError | null;
      if (body?.message) throw new Error(body.message);
    }
    throw error;
  }

  return data as T;
}

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
  return invokeUsers("listUsers", data);
}

export function getUserDetail({ data }: { data: { id: string } }): Promise<UserDetail> {
  return invokeUsers("getUserDetail", data);
}

export function setUserRole({ data }: { data: { id: string; role: UserRole; grant: boolean } }): Promise<{ ok: true }> {
  return invokeUsers("setUserRole", data);
}
