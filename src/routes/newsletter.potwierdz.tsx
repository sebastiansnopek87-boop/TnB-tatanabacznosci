import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { z } from "zod";
import { PageHeading, PageShell } from "@/components/tnb/PageShell";
import { confirmNewsletter } from "@/lib/api/newsletter";

export const Route = createFileRoute("/newsletter/potwierdz")({
  validateSearch: z.object({ token: z.string().uuid().optional() }),
  head: () => ({
    meta: [
      { title: "Potwierdź zapis do newslettera — Tata Na Baczności" },
      { name: "description", content: "Potwierdź adres e-mail i zapis do newslettera Tata Na Baczności." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: ConfirmNewsletter,
});

function ConfirmNewsletter() {
  const { token } = Route.useSearch();
  const [state, setState] = useState<"loading" | "done" | "error">("loading");
  const ran = useRef(false);

  useEffect(() => {
    if (ran.current) return;
    ran.current = true;
    if (!token) { setState("error"); return; }
    confirmNewsletter({ data: { token } }).then(() => setState("done")).catch(() => setState("error"));
  }, [token]);

  return (
    <PageShell>
      <PageHeading eyebrow="Newsletter" title="Potwierdź zapis" intro="Potwierdzenie adresu e-mail kończy zapis do newslettera." />
      <div className="max-w-xl px-5 py-14 lg:px-14">
        {state === "loading" ? <p className="text-muted-foreground">Potwierdzanie zapisu…</p>
          : state === "done" ? <p role="status" className="border border-gold/60 bg-surface p-6 text-foreground">Dziękujemy. Jeśli link był prawidłowy, adres jest aktywny i zapis został potwierdzony.</p>
          : <p role="alert" className="border border-destructive/50 p-6 text-destructive">Nie udało się potwierdzić zapisu. Link może być nieprawidłowy lub wykorzystany.</p>}
        <Link to="/" className="mt-8 inline-block text-sm text-gold hover:underline">Wróć na stronę główną</Link>
      </div>
    </PageShell>
  );
}
