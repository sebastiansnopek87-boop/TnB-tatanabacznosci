import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { PageShell } from "@/components/tnb/PageShell";
import { getRegistrationByToken } from "@/lib/meetings.functions";
import { fmtWhen } from "@/lib/meetings";
import { MyRegBox } from "@/components/meetings/MyRegBox";

export const Route = createFileRoute("/spotkania/zgloszenie/$token")({
  head: () => ({ meta: [
    { title: "Zgłoszenie na spotkanie — Tata Na Baczności" }, { name: "description", content: "Status zgłoszenia na spotkanie TNB." },
    { property: "og:title", content: "Zgłoszenie na spotkanie — TNB" }, { property: "og:description", content: "Status zgłoszenia na spotkanie TNB." },
    { name: "robots", content: "noindex, nofollow" },
  ] }),
  component: RegistrationStatus,
});

const MSG: Record<string, { h: string; p: string }> = {
  pending: { h: "Zgłoszenie przyjęte", p: "Dziękujemy! Twoje zgłoszenie trafiło do organizatora. To jeszcze nie jest potwierdzenie udziału — organizator musi je zatwierdzić." },
  approved: { h: "Udział potwierdzony", p: "Twój udział w spotkaniu został potwierdzony." },
  rejected: { h: "Zgłoszenie odrzucone", p: "Niestety tym razem organizator nie może potwierdzić Twojego udziału." },
  cancelled: { h: "Zgłoszenie anulowane", p: "To zgłoszenie zostało anulowane." },
};

function RegistrationStatus() {
  const { token } = Route.useParams();
  const q = useQuery({ queryKey: ["meeting-reg", token], queryFn: () => getRegistrationByToken({ data: { token } }), retry: false });
  const r = q.data; const msg = r ? (r.ended && r.status === "approved" ? { h: "Spotkanie zakończone", p: "Dziękujemy za udział." } : MSG[r.status] ?? MSG["pending"]) : null;
  return (
    <PageShell>
      <div className="mx-auto max-w-2xl px-5 py-20">
        {q.isLoading ? <p className="text-sm text-muted-foreground">Ładowanie…</p>
          : !r || !msg ? (<><h1 className="font-display text-3xl font-semibold uppercase text-foreground">Nie znaleziono zgłoszenia</h1><Link to="/spotkania" className="mt-6 inline-block text-gold underline">Wróć do spotkań</Link></>)
          : (
            <div className="border border-gold/40 bg-surface-deep p-8">
              <p className="eyebrow text-gold">Spotkania TNB</p>
              <h1 className="mt-3 font-display text-3xl font-semibold uppercase text-foreground">{msg.h}</h1>
              <p className="mt-4 text-sm leading-[1.75] text-foreground/80">{msg.p}</p>
              <div className="mt-6 border border-border/60 bg-card p-4 text-sm">
                <p className="font-medium text-foreground">{r.title}</p>
                <p className="mt-1 text-foreground/70">{fmtWhen(r.starts_at)}</p>
                  {r.status === "approved" && r.kind === "live" && r.location && !r.address && <p className="mt-1 text-foreground/70">{r.location}</p>}
              </div>
              {r.meetingCancelled && <p className="mt-4 text-sm text-foreground/80">Spotkanie zostało odwołane.{r.cancel_reason ? ` ${r.cancel_reason}` : ""}</p>}
              <div className="mt-6 border-t border-border/60 pt-6"><MyRegBox m={r} reg={r} onChange={() => q.refetch()} /></div>
              <p className="mt-6 text-xs text-muted-foreground">Zachowaj ten adres — pod nim zawsze sprawdzisz aktualny status zgłoszenia.</p>
              {r.slug && <Link to="/spotkania/$slug" params={{ slug: r.slug }} className="mt-4 inline-block text-sm text-gold underline">Wróć do spotkania</Link>}
            </div>
          )}
      </div>
    </PageShell>
  );
}
