import { useEffect, useRef, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { finishInstagramOAuth } from "@/lib/api/voice";
import { readInstagramOAuthCallback } from "@/lib/instagram-callback";

export const Route = createFileRoute("/instagram/callback")({
  validateSearch: z.object({
    state: z.string().optional(),
    code: z.string().optional(),
    error: z.string().optional(),
  }),
  head: () => ({
    meta: [
      { title: "Łączenie Instagrama — Tata Na Baczności" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: InstagramOAuthCallbackPage,
});

function InstagramOAuthCallbackPage() {
  const search = Route.useSearch();
  const started = useRef(false);
  const [message, setMessage] = useState("Kończymy bezpieczne łączenie konta Instagram…");

  useEffect(() => {
    if (started.current) return;
    started.current = true;

    const params = new URLSearchParams();
    if (search.state) params.set("state", search.state);
    if (search.code) params.set("code", search.code);
    if (search.error) params.set("error", search.error);

    const callback = readInstagramOAuthCallback(params);
    if (callback.status === "cancelled") {
      window.location.replace("/admin/podcast?instagram=anulowano#instagram");
      return;
    }
    if (callback.status === "invalid") {
      window.location.replace("/admin/podcast?instagram=blad#instagram");
      return;
    }

    finishInstagramOAuth({ data: { state: callback.state, code: callback.code } })
      .then(() => window.location.replace("/admin/podcast?instagram=polaczono#instagram"))
      .catch(() => {
        setMessage("Nie udało się połączyć konta. Za chwilę wrócisz do ustawień Instagrama.");
        window.setTimeout(() => window.location.replace("/admin/podcast?instagram=blad#instagram"), 1800);
      });
  }, [search.state, search.code, search.error]);

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-6 text-center">
      <div className="max-w-lg space-y-3">
        <p className="text-xs uppercase tracking-[0.2em] text-gold">Tata Na Baczności</p>
        <h1 className="font-display text-2xl font-semibold">Instagram</h1>
        <p role="status" className="text-sm text-muted-foreground">{message}</p>
      </div>
    </main>
  );
}
