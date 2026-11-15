import { supabase } from "@/integrations/supabase/client";

export const ROLE_VALUES = ["superadmin", "admin", "moderator", "editor", "support", "premium"] as const;
export type UserRole = (typeof ROLE_VALUES)[number];

type ListUsersInput = {
  q: string;
  role: "" | "none" | UserRole;
  status: "" | "confirmed" | "unconfirmed";
  page: number;
};

type AdminUser = {
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

type ListUsersResult = {
  rows: AdminUser[];
  total: number;
  pageSize: number;
  canManage: boolean;
};

type UserDetailResult = AdminUser & {
  providers: string[];
  isSelf: boolean;
  canManage: boolean;
};

type EdgeErrorBody = {
  message?: unknown;
  error?: unknown;
};

async function invokeUsers<T>(body: Record<string, unknown>): Promise<T> {
  const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
  if (sessionError) {
    throw new Error("Nie udało się odczytać sesji. Zaloguj się ponownie.");
  }

  const accessToken = sessionData.session?.access_token;
  if (!accessToken) {
    throw new Error("Sesja wygasła. Zaloguj się ponownie.");
  }

  const { data, error } = await supabase.functions.invoke<T>("tnb-users", {
    body,
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (error) {
    const context = (error as { context?: unknown }).context;
    if (typeof Response !== "undefined" && context instanceof Response) {
      try {
        const payload = (await context.clone().json()) as EdgeErrorBody;
        if (typeof payload.message === "string" && payload.message.trim()) {
          throw new Error(payload.message);
        }
      } catch (parseError) {
        if (parseError instanceof Error && parseError.message !== "Unexpected end of JSON input") {
          throw parseError;
        }
      }
    }
    throw new Error(error.message || "Nie udało się połączyć z usługą użytkowników.");
  }

  if (data === null) {
    throw new Error("Usługa użytkowników zwróciła pustą odpowiedź.");
  }

  return data;
}

export async function listUsers({ data }: { data: ListUsersInput }): Promise<ListUsersResult> {
  return invokeUsers<ListUsersResult>({ action: "listUsers", ...data });
}

export async function getUserDetail({ data }: { data: { id: string } }): Promise<UserDetailResult> {
  return invokeUsers<UserDetailResult>({ action: "getUserDetail", ...data });
}

export async function setUserRole({
  data,
}: {
  data: { id: string; role: UserRole; grant: boolean };
}): Promise<{ ok: true }> {
  return invokeUsers<{ ok: true }>({ action: "setUserRole", ...data });
}
