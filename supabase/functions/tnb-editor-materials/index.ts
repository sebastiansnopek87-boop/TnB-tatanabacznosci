import { corsHeaders } from "npm:@supabase/supabase-js@2.117.2/cors";
import { requireSuperadminEdge } from "./index-auth.ts";
import * as logic from "./logic.ts";
import { supabaseAdmin, type EdgeContext } from "./compat.ts";
const CORS = new Headers({ ...corsHeaders, "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Methods": "POST, OPTIONS", "Access-Control-Allow-Headers": "authorization, apikey, x-client-info, content-type, x-supabase-api-version", "Access-Control-Max-Age": "86400", "X-Content-Type-Options": "nosniff" });
const ACTIONS = new Set(["previewCreateMaterial","startMaterial","writeMaterial","generateMaterialImage","updateMaterialImage","materialImageUrls","finishMaterial","listMaterials","getMaterial","saveMaterial","setMaterialStatus","restoreMaterialVersion","aiEditFragment","aiEditWhole","approveAndHandoff"]);
function json(body: unknown, status = 200) { return Response.json(body, { status, headers: CORS }); }
Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS });
  if (req.method !== "POST") return json({ message: "Niedozwolona metoda." }, 405);
  try {
    const raw = await req.json().catch(() => null) as { action?: unknown; data?: unknown } | null;
    if (!raw || typeof raw.action !== "string" || !ACTIONS.has(raw.action)) return json({ message: "Nieznana operacja." }, 400);
    const auth = await requireSuperadminEdge(req);
    const context: EdgeContext = { supabase: supabaseAdmin, userId: auth.userId };
    const fn = (logic as unknown as Record<string, unknown>)[raw.action];
    if (typeof fn !== "function") return json({ message: "Nieznana operacja." }, 400);
    const result = await (fn as (input: { data: unknown; context: EdgeContext }) => Promise<unknown>)({ data: raw.data ?? {}, context });
    return json(result);
  } catch (error) {
    const status = typeof error === "object" && error !== null && "status" in error && typeof error.status === "number" ? error.status : 500;
    const message = error instanceof Error ? error.message : "Wystąpił błąd serwera.";
    if (status >= 500) console.error("tnb-editor-materials:", message);
    return json({ message }, status);
  }
});
