import { supabase } from "@/integrations/supabase/client";
import { tnbPublicFunctionUrl } from "@/lib/public-edge-url";

async function callAvatarEdge(action: "save" | "remove", blob?: Blob): Promise<{ ok: true }> {
  const { data, error } = await supabase.auth.getSession();
  if (error || !data.session) throw new Error("Zaloguj się ponownie.");

  const apiKey = import.meta.env["VITE_SUPABASE_PUBLISHABLE_KEY"] as string | undefined;
  if (!apiKey) throw new Error("Brak konfiguracji usługi.");

  const response = await fetch(tnbPublicFunctionUrl("tnb-avatar", { action }), {
    method: "POST",
    headers: {
      apikey: apiKey,
      authorization: `Bearer ${data.session.access_token}`,
      ...(blob ? { "content-type": "image/webp" } : { "content-type": "application/json" }),
    },
    body: blob ?? JSON.stringify({}),
  });

  const payload = await response.json().catch(() => null) as { ok?: true; message?: string } | null;
  if (!response.ok || !payload?.ok) throw new Error(payload?.message || "Nie udało się zapisać avatara.");
  return { ok: true };
}

export function saveMyAvatar(blob: Blob): Promise<{ ok: true }> {
  return callAvatarEdge("save", blob);
}

export function removeMyAvatar(): Promise<{ ok: true }> {
  return callAvatarEdge("remove");
}
