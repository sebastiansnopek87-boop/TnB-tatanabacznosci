import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";

export const ROLE_VALUES = ["superadmin", "admin", "moderator", "editor", "support", "premium"] as const;
export type Role = (typeof ROLE_VALUES)[number];
export type RoleFilter = "" | "none" | Role;
export type UserStatus = "" | "confirmed" | "unconfirmed";

export interface AdminUser {
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
}

export interface UserDetail extends AdminUser {
  providers: string[];
  isSelf: boolean;
  canManage: boolean;
}

export interface ListUsersResult {
  rows: AdminUser[];
  total: number;
  pageSize: number;
  canManage: boolean;
}

const listUsersSchema = z.object({
  q: z.string().trim().max(100).default(""),
  role: z.enum(["", "none", ...ROLE_VALUES]).default(""),
  status: z.enum(["", "confirmed", "unconfirmed"]).default(""),
  page: z.number().int().min(0).max(1000).default(0),
});

type RequestBody = Record<string, unknown>;

async function invoke<T>(body: RequestBody): Promise<T> {
  const { data, error } = await supabase.functions.invoke<T>("tnb-users", { body });

  if (error) {
    let message = error.message || "Nie udało się wykonać operacji.";
    const context = (error as Error & { context?: unknown }).context;

    if (typeof Response !== "undefined" && context instanceof Response) {
      try {
        const payload = await context.clone().json() as { message?: unknown };
        if (typeof payload.message === "string" && payload.message.trim()) {
          message = payload.message;
        }
      } catch {
        // Keep the SDK's safe fallback message when the response is not JSON.
      }
    }

    throw new Error(message);
  }

  if (data == null) throw new Error("Serwer zwrócił pustą odpowiedź.");
  return data;
}

export function listUsers(input: {
  q?: string;
  role?: RoleFilter;
  status?: UserStatus;
  page?: number;
} = {}): Promise<ListUsersResult> {
  const filters = listUsersSchema.parse(input);
  return invoke<ListUsersResult>({ action: "listUsers", ...filters });
}

export function getUserDetail(input: { id: string }): Promise<UserDetail> {
  const parsed = z.object({ id: z.string().uuid() }).parse(input);
  return invoke<UserDetail>({ action: "getUserDetail", ...parsed });
}

export function setUserRole(input: { id: string; role: Role; grant: boolean }): Promise<{ ok: true }> {
  const parsed = z.object({
    id: z.string().uuid(),
    role: z.enum(ROLE_VALUES),
    grant: z.boolean(),
  }).parse(input);
  return invoke<{ ok: true }>({ action: "setUserRole", ...parsed });
}
