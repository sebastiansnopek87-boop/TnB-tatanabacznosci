import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import { corsHeaders as supabaseCorsHeaders } from "npm:@supabase/supabase-js@2.117.2/cors";

type Context = {
  supabase: any;
  supabaseAdmin: any;
  userClaims?: { id?: string; email?: string };
};

class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code: string,
  ) {
    super(message);
  }
}

const Roles = ["superadmin", "admin", "moderator", "editor", "support", "premium"] as const;
type Role = (typeof Roles)[number];
const PER_PAGE = 25;

const RequestSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("listUsers"),
    q: z.string().trim().max(100).default(""),
    role: z.enum(["", "none", ...Roles]).default(""),
    status: z.enum(["", "confirmed", "unconfirmed"]).default(""),
    page: z.number().int().min(0).max(1000).default(0),
  }),
  z.object({
    action: z.literal("getUserDetail"),
    id: z.string().uuid(),
  }),
  z.object({
    action: z.literal("setUserRole"),
    id: z.string().uuid(),
    role: z.enum(Roles),
    grant: z.boolean(),
  }),
]);

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

type AuthUser = {
  id: string;
  email?: string;
  created_at: string;
  email_confirmed_at?: string | null;
  last_sign_in_at?: string | null;
  banned_until?: string | null;
  user_metadata?: Record<string, unknown>;
  app_metadata?: Record<string, unknown>;
};


const allowedOrigins = new Set([
  "https://tatanabacznosci.pl",
  "https://www.tatanabacznosci.pl",
  "http://localhost:5173",
]);

function corsHeaders(origin: string | null): Headers {
  // Keep the SDK's required header list in sync with the supabase-js version used by the browser.
  const headers = new Headers(supabaseCorsHeaders);
  headers.set("Access-Control-Allow-Methods", "POST, OPTIONS");
  headers.set("Access-Control-Max-Age", "86400");
  headers.set("Vary", "Origin");
  headers.delete("Access-Control-Allow-Origin");
  if (origin && allowedOrigins.has(origin)) headers.set("Access-Control-Allow-Origin", origin);
  return headers;
}

function envKey(...names: string[]): string | null {
  for (const name of names) {
    const raw = Deno.env.get(name);
    if (!raw) continue;
    try {
      const value = JSON.parse(raw);
      if (typeof value === "string") return value;
      if (value && typeof value.default === "string") return value.default;
      continue;
    } catch {
      return raw;
    }
  }
  return null;
}

function createSupabaseFetch(apiKey: string): typeof fetch {
  return (input, init) => {
    const headers = new Headers(
      typeof Request !== "undefined" && input instanceof Request ? input.headers : undefined,
    );
    if (init?.headers) new Headers(init.headers).forEach((value, key) => headers.set(key, value));
    if (
      (apiKey.startsWith("sb_publishable_") || apiKey.startsWith("sb_secret_")) &&
      headers.get("Authorization") === "Bearer " + apiKey
    ) headers.delete("Authorization");
    headers.set("apikey", apiKey);
    return fetch(input, { ...init, headers });
  };
}

async function createRequestContext(req: Request): Promise<Context> {
  const authorization = req.headers.get("authorization");
  if (!authorization?.startsWith("Bearer ")) {
    throw new ApiError("Wymagane jest zalogowanie.", 401, "unauthorized");
  }

  const token = authorization.slice("Bearer ".length).trim();
  if (!token) throw new ApiError("Wymagane jest zalogowanie.", 401, "unauthorized");

  const url = Deno.env.get("SUPABASE_URL");
  const publishableKey = envKey(
    "SUPABASE_PUBLISHABLE_KEYS",
    "SUPABASE_PUBLISHABLE_KEY",
    "SUPABASE_ANON_KEY",
  );
  const secretKey = envKey(
    "SUPABASE_SECRET_KEYS",
    "SUPABASE_SECRET_KEY",
    "SUPABASE_SERVICE_ROLE_KEY",
  );

  if (!url || !publishableKey || !secretKey) {
    console.error("TNB Supabase runtime configuration is incomplete");
    throw new ApiError("Usługa jest chwilowo niedostępna.", 503, "backend_not_configured");
  }

  const supabase = createClient(url, publishableKey, {
    global: {
      fetch: createSupabaseFetch(publishableKey),
      headers: { Authorization: "Bearer " + token },
    },
    auth: { storage: undefined, persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });

  // Supabase Auth verifies the session using the project's active signing configuration.
  // This supports the project's existing Auth tokens; do not trust browser-supplied user IDs.
  const { data, error } = await supabase.auth.getUser(token);
  const userId = data?.user?.id;
  if (error || typeof userId !== "string" || !userId) {
    throw new ApiError("Sesja jest nieprawidłowa lub wygasła.", 401, "unauthorized");
  }

  const supabaseAdmin = createClient(url, secretKey, {
    global: { fetch: createSupabaseFetch(secretKey) },
    auth: { storage: undefined, persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });

  return {
    supabase,
    supabaseAdmin,
    userClaims: {
      id: userId,
      email: data.user.email ?? undefined,
    },
  };
}

function addCors(response: Response, headers: Headers): Response {
  const merged = new Headers(response.headers);
  headers.forEach((value, key) => merged.set(key, value));
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: merged,
  });
}

function nonEmptyString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function shapeUser(user: AuthUser, roles: string[], tnbId: string | null): AdminUser {
  const metadata = user.user_metadata ?? {};
  const first = nonEmptyString(metadata["first_name"]);
  const last = nonEmptyString(metadata["last_name"]);

  return {
    id: user.id,
    email: user.email ?? null,
    created_at: user.created_at,
    confirmed: !!user.email_confirmed_at,
    last_sign_in_at: user.last_sign_in_at ?? null,
    banned: !!(user.banned_until && new Date(user.banned_until) > new Date()),
    name:
      [first, last].filter(Boolean).join(" ") ||
      nonEmptyString(metadata["full_name"]) ||
      nonEmptyString(metadata["name"]),
    nick: nonEmptyString(metadata["nick"]),
    roles,
    tnb_id: tnbId,
  };
}

async function logEvent(
  ctx: Context,
  event: {
    type: string;
    actor: string;
    objectId?: string;
    result: "ok" | "failed" | "denied";
    detail?: string;
  },
): Promise<void> {
  try {
    const { error } = await ctx.supabaseAdmin.from("admin_events").insert({
      type: event.type,
      actor: event.actor,
      object_kind: "user",
      object_id: event.objectId ?? null,
      result: event.result,
      detail: event.detail?.slice(0, 300) ?? null,
    });
    if (error) console.error("admin event log failed");
  } catch {
    console.error("admin event log failed");
  }
}

async function hasRole(ctx: Context, userId: string, role: Role): Promise<boolean> {
  const { data, error } = await ctx.supabase.rpc("has_role", {
    _user_id: userId,
    _role: role,
  });
  if (error) return false;
  return !!data;
}

async function requireAdmin(ctx: Context, userId: string): Promise<void> {
  if (await hasRole(ctx, userId, "admin")) return;

  await logEvent(ctx, {
    type: "access_denied",
    actor: userId,
    result: "denied",
    detail: "Wymagana rola administratora",
  });
  throw new ApiError("Brak uprawnień administratora.", 403, "forbidden");
}

async function requireSuperadmin(ctx: Context, userId: string): Promise<void> {
  if (await hasRole(ctx, userId, "superadmin")) return;

  await logEvent(ctx, {
    type: "access_denied",
    actor: userId,
    objectId: "user_roles",
    result: "denied",
    detail: "Wymagana rola superadministratora",
  });
  throw new ApiError("Tylko superadministrator może zmieniać role.", 403, "forbidden");
}

async function rolesFor(ctx: Context, ids: string[]): Promise<Map<string, string[]>> {
  const map = new Map<string, string[]>();
  if (!ids.length) return map;

  const { data, error } = await ctx.supabaseAdmin
    .from("user_roles")
    .select("user_id, role")
    .in("user_id", ids);

  if (error) throw new ApiError("Nie udało się pobrać ról użytkowników.", 500, "database_error");

  for (const row of data ?? []) {
    map.set(row.user_id, [...(map.get(row.user_id) ?? []), row.role]);
  }
  return map;
}

async function tnbIdsFor(ctx: Context, ids: string[]): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  if (!ids.length) return map;

  // Backfill missing TNB IDs in the same way as the current server implementation.
  const { error: ensureError } = await ctx.supabaseAdmin.rpc("ensure_identities", {
    _ids: ids,
  });
  if (ensureError) console.warn("ensure_identities did not complete");

  const { data, error } = await ctx.supabaseAdmin
    .from("user_identities")
    .select("user_id, tnb_id")
    .in("user_id", ids);

  if (error) throw new ApiError("Nie udało się pobrać identyfikatorów TNB.", 500, "database_error");

  for (const row of data ?? []) map.set(row.user_id, row.tnb_id);
  return map;
}

async function isSuperadmin(ctx: Context, userId: string): Promise<boolean> {
  return hasRole(ctx, userId, "superadmin");
}

async function listUsers(
  ctx: Context,
  actorId: string,
  input: Extract<z.infer<typeof RequestSchema>, { action: "listUsers" }>,
) {
  await requireAdmin(ctx, actorId);

  const filtered = !!(input.q || input.role || input.status);
  if (!filtered) {
    const { data, error } = await ctx.supabaseAdmin.auth.admin.listUsers({
      page: input.page + 1,
      perPage: PER_PAGE,
    });
    if (error) throw new ApiError("Nie udało się pobrać użytkowników.", 500, "auth_admin_error");

    const ids = data.users.map((user: AuthUser) => user.id);
    const [roles, tnbIds, canManage] = await Promise.all([
      rolesFor(ctx, ids),
      tnbIdsFor(ctx, ids),
      isSuperadmin(ctx, actorId),
    ]);

    const total = (data as typeof data & { total?: number }).total ?? data.users.length;
    return {
      rows: data.users.map((user: AuthUser) =>
        shapeUser(user, roles.get(user.id) ?? [], tnbIds.get(user.id) ?? null)
      ),
      total,
      pageSize: PER_PAGE,
      canManage,
    };
  }

  const search = input.q.toLowerCase();
  const matches: AdminUser[] = [];

  // Auth Admin API has no server-side search. Preserve the current 20,000-user scan cap.
  for (let page = 1; page <= 20; page++) {
    const { data, error } = await ctx.supabaseAdmin.auth.admin.listUsers({
      page,
      perPage: 1000,
    });
    if (error) throw new ApiError("Nie udało się pobrać użytkowników.", 500, "auth_admin_error");

    const ids = data.users.map((user: AuthUser) => user.id);
    const [roles, tnbIds] = await Promise.all([
      rolesFor(ctx, ids),
      tnbIdsFor(ctx, ids),
    ]);

    for (const user of data.users as AuthUser[]) {
      const shaped = shapeUser(user, roles.get(user.id) ?? [], tnbIds.get(user.id) ?? null);

      if (
        search &&
        ![shaped.email, shaped.name, shaped.nick, shaped.tnb_id]
          .some((value) => value?.toLowerCase().includes(search))
      ) continue;

      if (input.status === "confirmed" && !shaped.confirmed) continue;
      if (input.status === "unconfirmed" && shaped.confirmed) continue;
      if (input.role === "none" ? shaped.roles.length > 0 : input.role && !shaped.roles.includes(input.role)) {
        continue;
      }

      matches.push(shaped);
    }

    if (data.users.length < 1000) break;
  }

  return {
    rows: matches.slice(input.page * PER_PAGE, input.page * PER_PAGE + PER_PAGE),
    total: matches.length,
    pageSize: PER_PAGE,
    canManage: await isSuperadmin(ctx, actorId),
  };
}

async function getUserDetail(ctx: Context, actorId: string, targetId: string) {
  await requireAdmin(ctx, actorId);

  const { data, error } = await ctx.supabaseAdmin.auth.admin.getUserById(targetId);
  if (error || !data.user) {
    throw new ApiError("Nie znaleziono użytkownika.", 404, "user_not_found");
  }

  const [roles, tnbIds, canManage] = await Promise.all([
    rolesFor(ctx, [targetId]),
    tnbIdsFor(ctx, [targetId]),
    isSuperadmin(ctx, actorId),
  ]);

  const user = data.user as AuthUser;
  const providers = (user.app_metadata?.["providers"] as string[] | undefined) ?? [];

  return {
    ...shapeUser(user, roles.get(targetId) ?? [], tnbIds.get(targetId) ?? null),
    providers,
    isSelf: targetId === actorId,
    canManage,
  };
}

const roleErrorMessages: Record<string, { status: number; message: string }> = {
  actor_not_superadmin: {
    status: 403,
    message: "Tylko superadministrator może zmieniać role.",
  },
  target_user_not_found: {
    status: 404,
    message: "Nie znaleziono użytkownika.",
  },
  superadmin_requires_admin: {
    status: 400,
    message: "Najpierw nadaj rolę Administrator.",
  },
  cannot_revoke_admin_from_superadmin: {
    status: 400,
    message: "Najpierw odbierz rolę Superadministrator.",
  },
  last_superadmin_protected: {
    status: 400,
    message: "Nie można odebrać roli ostatniemu superadministratorowi.",
  },
};

async function setUserRole(
  ctx: Context,
  actorId: string,
  targetId: string,
  role: Role,
  grant: boolean,
) {
  await requireAdmin(ctx, actorId);
  await requireSuperadmin(ctx, actorId);

  // Atomic database procedure serializes role changes and protects the last superadmin.
  const { error } = await ctx.supabaseAdmin.rpc("admin_set_user_role", {
    _actor_id: actorId,
    _target_user_id: targetId,
    _role: role,
    _grant: grant,
  });

  if (error) {
    const known = Object.entries(roleErrorMessages)
      .find(([key]) => error.message?.includes(key));

    if (known) {
      const [code, info] = known;
      await logEvent(ctx, {
        type: grant ? "role_granted" : "role_revoked",
        actor: actorId,
        objectId: targetId,
        result: "denied",
        detail: "role=" + role + "; " + code,
      });
      throw new ApiError(info.message, info.status, code);
    }

    await logEvent(ctx, {
      type: grant ? "role_granted" : "role_revoked",
      actor: actorId,
      objectId: targetId,
      result: "failed",
      detail: "role=" + role,
    });
    throw new ApiError("Nie udało się zmienić roli.", 500, "role_update_failed");
  }

  return { ok: true as const };
}


async function handleRequest(req: Request, ctx: Context): Promise<Response> {
    if (req.method !== "POST") {
      return Response.json(
        { error: "method_not_allowed", message: "Dozwolona jest metoda POST." },
        { status: 405 },
      );
    }

    const actorId = ctx.userClaims?.id;
    if (!actorId) {
      return Response.json(
        { error: "unauthorized", message: "Wymagane jest zalogowanie." },
        { status: 401 },
      );
    }

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return Response.json(
        { error: "invalid_json", message: "Nieprawidłowe dane żądania." },
        { status: 400 },
      );
    }

    const parsed = RequestSchema.safeParse(body);
    if (!parsed.success) {
      return Response.json(
        { error: "validation_error", message: "Nieprawidłowe dane żądania." },
        { status: 400 },
      );
    }

    try {
      switch (parsed.data.action) {
        case "listUsers":
          return Response.json(await listUsers(ctx, actorId, parsed.data));
        case "getUserDetail":
          return Response.json(await getUserDetail(ctx, actorId, parsed.data.id));
        case "setUserRole":
          return Response.json(
            await setUserRole(ctx, actorId, parsed.data.id, parsed.data.role, parsed.data.grant),
          );
      }
    } catch (error) {
      if (error instanceof ApiError) {
        return Response.json(
          { error: error.code, message: error.message },
          { status: error.status },
        );
      }
      console.error("tnb-users request failed");
      return Response.json(
        { error: "internal_error", message: "Wystąpił błąd serwera." },
        { status: 500 },
      );
    }
}

Deno.serve(async (req: Request) => {
  const origin = req.headers.get("origin");
  const headers = corsHeaders(origin);
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers });
  if (origin && !allowedOrigins.has(origin)) {
    return Response.json(
      { error: "origin_not_allowed", message: "Niedozwolone źródło żądania." },
      { status: 403, headers },
    );
  }
  try {
    const ctx = await createRequestContext(req);
    return addCors(await handleRequest(req, ctx), headers);
  } catch (error) {
    if (error instanceof ApiError) {
      return Response.json({ error: error.code, message: error.message }, { status: error.status, headers });
    }
    console.error("tnb-users authentication/runtime failure");
    return Response.json(
      { error: "internal_error", message: "Wystąpił błąd serwera." },
      { status: 500, headers },
    );
  }
});
