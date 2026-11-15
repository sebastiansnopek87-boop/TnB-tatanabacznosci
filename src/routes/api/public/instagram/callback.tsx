import { createFileRoute } from "@tanstack/react-router";
import { useEffect } from "react";
import { finishInstagramOAuth } from "@/lib/api/voice";

export const Route = createFileRoute("/api/public/instagram/callback")({ component: InstagramCallback });
const finishRequests = new Map<string, Promise<void>>();

function InstagramCallback() {
  const message = "Kończymy autoryzację konta Instagram…";
  useEffect(() => {
    let active = true;
    const params = new URLSearchParams(window.location.search);
    const state = params.get("state") ?? "";
    const code = params.get("code") ?? "";
    const error = params.get("error");
    const back = (status: "polaczono" | "anulowano" | "blad") => {
      if (active) window.location.replace("/admin/podcast?instagram=" + status + "#instagram");
    };
    if (error || !state || !code) {
      back("anulowano");
      return () => { active = false; };
    }
    if (!finishRequests.has(state)) {
      finishRequests.set(state, finishInstagramOAuth({ data: { state, code } }).then(() => undefined));
    }
    finishRequests.get(state)!
      .then(() => back("polaczono"))
      .catch((failure: unknown) => {
        console.error("Instagram OAuth callback failed", failure);
        back("blad");
      });
    return () => { active = false; };
  }, []);
  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-6">
      <div className="max-w-md border border-border/60 p-8 text-center">
        <p className="font-display text-xl font-semibold uppercase">Głos TNB</p>
        <p className="mt-3 text-sm text-muted-foreground">{message}</p>
      </div>
    </main>
  );
}
