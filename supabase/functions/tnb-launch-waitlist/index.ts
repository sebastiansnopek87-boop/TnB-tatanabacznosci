import { createClient } from "npm:@supabase/supabase-js@2.117.2";
import { z } from "npm:zod@3.25.76";

const ALLOWED_ORIGINS = new Set([
  "https://tatanabacznosci.pl",
  "https://www.tatanabacznosci.pl",
  "http://localhost:5173",
  "http://127.0.0.1:5173",
]);
const CONSENT_VERSION = "2026-11-22";
const CONSENT_TEXT =
  "Wyrażam zgodę na przetwarzanie mojego imienia i adresu e-mail w celu jednorazowego powiadomienia mnie o uruchomieniu platformy Tata Na Baczności. Wiem, że mogę wycofać zgodę.";
const schema = z.object({
  name: z.string().trim().min(1).max(100),
  email: z.string().trim().toLowerCase().email().max(255),
  consent: z.literal(true),
  website: z.string().max(0).optional().default(""),
  elapsedMs: z.number().int().min(1800),
}).strict();

function cors(origin: string | null) {
  const headers = new Headers({
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "authorization, apikey, x-client-info, content-type, x-supabase-api-version",
    "Access-Control-Max-Age": "86400",
    "Vary": "Origin",
    "X-Content-Type-Options": "nosniff",
  });
  if (origin && ALLOWED_ORIGINS.has(origin)) headers.set("Access-Control-Allow-Origin", origin);
  return headers;
}
function json(body: unknown, status: number, headers: Headers) {
  headers.set("Content-Type", "application/json; charset=utf-8");
  return new Response(JSON.stringify(body), { status, headers });
}
function getSecret() {
  for (const key of ["SUPABASE_SECRET_KEYS", "SUPABASE_SECRET_KEY", "SUPABASE_SERVICE_ROLE_KEY"]) {
    const raw = Deno.env.get(key);
    if (!raw) continue;
    try {
      const parsed = JSON.parse(raw);
      if (typeof parsed === "string") return parsed;
      if (parsed && typeof parsed.default === "string") return parsed.default;
    } catch { return raw; }
  }
  return null;
}
async function hashIp(ip: string | null) {
  if (!ip) return null;
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode("tnb-launch:" + ip));
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
}

Deno.serve(async (req: Request) => {
  const headers = cors(req.headers.get("origin"));
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers });
  if (req.method !== "POST") return json({ message: "Niedozwolona metoda." }, 405, headers);
  const origin = req.headers.get("origin");
  if (origin && !ALLOWED_ORIGINS.has(origin)) return json({ message: "Niedozwolone źródło żądania." }, 403, headers);

  try {
    const payload = schema.safeParse(await req.json());
    if (!payload.success) return json({ message: "Sprawdź imię, adres e-mail i wymaganą zgodę." }, 400, headers);
    const data = payload.data;
    if (data.website) return json({ message: "Nie udało się przyjąć zgłoszenia." }, 400, headers);

    const url = Deno.env.get("SUPABASE_URL");
    const key = getSecret();
    if (!url || !key) {
      console.error("Launch waitlist backend configuration is missing.");
      return json({ message: "Formularz jest chwilowo niedostępny." }, 503, headers);
    }
    const db = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
    const ip = req.headers.get("cf-connecting-ip") ?? req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;
    const ipHash = await hashIp(ip);
    const since = new Date(Date.now() - 60 * 60 * 1000).toISOString();

    if (ipHash) {
      const { count, error: countError } = await db.from("launch_waitlist")
        .select("id", { count: "exact", head: true })
        .eq("ip_hash", ipHash)
        .gte("created_at", since);
      if (countError) throw countError;
      if ((count ?? 0) >= 5) return json({ message: "Zbyt wiele prób. Spróbuj ponownie za godzinę." }, 429, headers);
    }

    const { error } = await db.from("launch_waitlist").insert({
      name: data.name,
      email: data.email,
      consent_text: CONSENT_TEXT,
      consent_version: CONSENT_VERSION,
      consent_given_at: new Date().toISOString(),
      source: "coming_soon",
      ip_hash: ipHash,
      user_agent: (req.headers.get("user-agent") ?? "").slice(0, 300),
    });
    if (error?.code === "23505") return json({ status: "already" }, 200, headers);
    if (error) throw error;

    return json({ status: "saved" }, 200, headers);
  } catch (error) {
    console.error("Launch waitlist submission failed:", error instanceof Error ? error.message : "unknown");
    return json({ message: "Nie udało się zapisać zgłoszenia. Spróbuj ponownie." }, 500, headers);
  }
});
