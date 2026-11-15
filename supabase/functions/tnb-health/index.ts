import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { corsHeaders as supabaseCorsHeaders } from "npm:@supabase/supabase-js@2.117.2/cors";

const allowedOrigins = new Set([
  "https://tatanabacznosci.pl",
  "https://www.tatanabacznosci.pl",
  "http://localhost:5173",
]);

function corsHeaders(origin: string | null): Record<string, string> {
  const headers: Record<string, string> = {
    ...supabaseCorsHeaders,
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Max-Age": "86400",
    "Vary": "Origin",
  };
  delete headers["Access-Control-Allow-Origin"];

  if (origin && allowedOrigins.has(origin)) {
    headers["Access-Control-Allow-Origin"] = origin;
  }

  return headers;
}

Deno.serve((req: Request) => {
  const headers = corsHeaders(req.headers.get("origin"));

  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers });
  }

  if (req.method !== "GET") {
    return Response.json(
      { ok: false, error: "method_not_allowed" },
      { status: 405, headers },
    );
  }

  return Response.json(
    {
      ok: true,
      service: "tnb-edge",
      runtime: "supabase-edge",
      timestamp: new Date().toISOString(),
    },
    { status: 200, headers },
  );
});
