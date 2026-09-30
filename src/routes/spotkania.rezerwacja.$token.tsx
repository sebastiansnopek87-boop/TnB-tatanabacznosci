import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { CheckCircle2 } from "lucide-react";
import { PageShell } from "@/components/tnb/PageShell";
import { getBookingByToken } from "@/lib/consult.functions";
import { BOOKING_STATUS, fmtDate, fmtHm, type BookingStatus } from "@/lib/consult";

export const Route = createFileRoute("/spotkania/rezerwacja/$token")({
  head: () => ({ meta: [
    { title: "Rezerwacja rozmowy 1:1 — Tata Na Baczności" }, { name: "description", content: "Potwierdzenie rezerwacji rozmowy 1:1." },
    { property: "og:title", content: "Rezerwacja rozmowy 1:1" }, { property: "og:description", content: "Potwierdzenie rezerwacji rozmowy 1:1." },
    { name: "robots", content: "noindex, nofollow" },
  ] }),
  component: Confirmation,
});

function Confirmation() {
  const { token } = Route.useParams();
  const ok = /^[0-9a-f-]{36}$/i.test(token);
  const q = useQuery({ queryKey: ["consult-booking", token], queryFn: () => getBookingByToken({ data: { token } }), enabled: ok });
  const b = q.data;
  return (
    <PageShell>
      <div className="mx-auto max-w-2xl px-5 py-14 lg:py-20">
        {q.isLoading ? <p className="text-sm text-muted-foreground">Wczytywanie…</p> : !b ? (
          <div className="text-center">
            <h1 className="font-display text-3xl font-semibold uppercase text-foreground">Nie znaleziono rezerwacji</h1>
            <Link to="/spotkania" className="mt-6 inline-block text-gold underline">Wróć do spotkań</Link>
          </div>
        ) : (
          <>
            {b.status === "booked" && <CheckCircle2 className="h-10 w-10 text-gold" />}
            <p className="eyebrow mt-4 text-gold">Rozmowa 1:1 · {b.number}</p>
            <h1 className="mt-3 font-display text-[2.2rem] font-semibold uppercase leading-tight text-foreground">
              {b.status === "booked" ? "Rezerwacja potwierdzona" : BOOKING_STATUS[b.status as BookingStatus]}
            </h1>
            <dl className="mt-8 grid gap-4 border border-border/60 bg-card p-5 text-sm sm:grid-cols-2">
              <div><dt className="text-xs uppercase tracking-[0.12em] text-muted-foreground">Numer rezerwacji</dt><dd className="mt-1 text-foreground">{b.number}</dd></div>
              <div><dt className="text-xs uppercase tracking-[0.12em] text-muted-foreground">Status</dt><dd className="mt-1 text-foreground">{BOOKING_STATUS[b.status as BookingStatus]}</dd></div>
              <div><dt className="text-xs uppercase tracking-[0.12em] text-muted-foreground">Data</dt><dd className="mt-1 text-foreground">{fmtDate(b.starts_at)}</dd></div>
              <div><dt className="text-xs uppercase tracking-[0.12em] text-muted-foreground">Godzina</dt><dd className="mt-1 text-foreground">{fmtHm(b.starts_at)}–{fmtHm(b.ends_at)} (30 minut)</dd></div>
              <div className="sm:col-span-2"><dt className="text-xs uppercase tracking-[0.12em] text-muted-foreground">Koszt</dt><dd className="mt-1 text-foreground">Rozmowa jest bezpłatna.</dd></div>
            </dl>
            {b.status === "booked" && (
              <div className="mt-6 space-y-4 text-[0.95rem] leading-[1.75] text-foreground/85">
                {b.confirmation === "sent"
                  ? <p>Wysłaliśmy potwierdzenie na Twój adres e-mail.</p>
                  : <p className="border border-gold/40 bg-surface-deep p-4">Rezerwacja została zapisana, ale potwierdzenie e-mail nie mogło zostać wysłane. Zachowaj numer rezerwacji lub zapisz adres tej strony.</p>}
                {b.link
                  ? <p>Link do spotkania: <a href={b.link} target="_blank" rel="noopener noreferrer" className="break-all text-gold underline">{b.link}</a></p>
                  : <p>Link do spotkania przekażemy przed rozmową{b.account ? " — pojawi się też w sekcji „Moje TNB”" : ""}.</p>}
                {b.account
                  ? <p>Rezerwację, link i możliwość anulowania znajdziesz w sekcji <Link to="/moje-tnb" className="text-gold underline">Moje TNB</Link>.</p>
                  : <p>Zmiana lub anulowanie rezerwacji wymaga kontaktu z organizatorem przez <Link to="/kontakt" className="text-gold underline">formularz kontaktowy</Link>.</p>}
              </div>
            )}
          </>
        )}
      </div>
    </PageShell>
  );
}
