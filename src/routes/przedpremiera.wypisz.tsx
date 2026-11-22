import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { z } from "zod";
import { PageHeading, PageShell } from "@/components/tnb/PageShell";
import { unsubscribePrelaunch } from "@/lib/api/prelaunch";

const WITHDRAW_STORAGE_KEY = "tnb.prelaunch.withdraw-token";
const TITLE = "Wycofaj zgodę — Tata Na Baczności";
const DESC = "Wycofaj zgodę na otrzymanie jednorazowej informacji o uruchomieniu TNB.";

export const Route = createFileRoute("/przedpremiera/wypisz")({
  validateSearch: z.object({ token: z.string().uuid().optional() }),
  head: () => ({ meta: [
    { title: TITLE }, { name: "description", content: DESC }, { name: "robots", content: "noindex, nofollow" },
  ] }),
  component: WithdrawPrelaunch,
});

function WithdrawPrelaunch() {
  const { token } = Route.useSearch();
  const [state, setState] = useState<"busy" | "done" | "error">(token ? "busy" : "error");
  const ran = useRef(false);

  useEffect(() => {
    if (!token || ran.current) return;
    ran.current = true;
    unsubscribePrelaunch({ data: { token } })
      .then(() => {
        setState("done");
        try { window.localStorage.removeItem(WITHDRAW_STORAGE_KEY); } catch { /* storage may be unavailable */ }
      })
      .catch(() => setState("error"));
  }, [token]);

  return (
    <PageShell>
      <PageHeading eyebrow="Lista przedpremierowa" title="Wycofaj zgodę" intro="Możesz w każdej chwili zrezygnować z jednorazowej informacji o uruchomieniu TNB." />
      <div className="max-w-xl px-5 py-14 lg:px-14">
        {state === "busy" && <p className="text-muted-foreground">Usuwanie zapisu…</p>}
        {state === "done" && <p role="status" className="border border-gold/60 bg-surface p-6 text-foreground">Zapis został wycofany. Adres nie będzie użyty do wysłania informacji o starcie TNB.</p>}
        {state === "error" && <p role="alert" className="border border-border bg-surface p-6 text-foreground">Nie udało się potwierdzić linku. Jeśli chcesz usunąć swój zapis, skontaktuj się z nami przez <Link to="/kontakt" className="text-gold underline">formularz kontaktowy</Link>.</p>}
        <Link to="/" className="mt-6 inline-block text-sm text-gold underline underline-offset-4">Wróć na stronę główną</Link>
      </div>
    </PageShell>
  );
}
