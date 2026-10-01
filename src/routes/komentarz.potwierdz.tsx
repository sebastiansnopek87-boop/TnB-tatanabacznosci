import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useRef, useState } from "react";
import { z } from "zod";
import { PageHeading, PageShell } from "@/components/tnb/PageShell";
import { Button } from "@/components/ui/button";
import { confirmGuestComment, resendGuestComment } from "@/lib/guest-comments.functions";

export const Route = createFileRoute("/komentarz/potwierdz")({
  validateSearch: z.object({ t: z.string().max(100).optional().catch(undefined) }),
  head: () => ({
    meta: [
      { title: "Potwierdzenie komentarza — Tata Na Baczności" },
      { name: "description", content: "Potwierdzenie komentarza dodanego pod artykułem bez konta TNB." },
      { property: "og:title", content: "Potwierdzenie komentarza — Tata Na Baczności" },
      { property: "og:description", content: "Potwierdź swój komentarz pod artykułem TATA NA BACZNOŚCI." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: Confirm,
});

// One confirmation request per token per page load, even if the view mounts twice.
const pending = new Map<string, Promise<R>>();
type R = Awaited<ReturnType<typeof confirmGuestComment>>;
const TEXT: Record<R["status"], { title: string; body: string }> = {
  published: { title: "Dziękujemy! Komentarz został opublikowany", body: "Twój adres e-mail został potwierdzony, a komentarz jest już widoczny pod artykułem." },
  used: { title: "Ten link został już wykorzystany", body: "Każdy link potwierdzający działa tylko raz. Jeśli komentarz został wcześniej potwierdzony, jest już widoczny pod artykułem." },
  expired: { title: "Link potwierdzający wygasł", body: "Minęło 48 godzin od wysłania wiadomości. Możesz poprosić o nowy link." },
  invalid: { title: "Link jest nieprawidłowy", body: "Nie rozpoznajemy tego linku. Sprawdź, czy skopiowałeś go w całości, albo dodaj komentarz ponownie." },
  blocked: { title: "Nie można opublikować tego komentarza", body: "Komentarz został zatrzymany przez moderację i nie zostanie opublikowany." },
};

function Confirm() {
  const { t } = Route.useSearch();
  const confirm = useServerFn(confirmGuestComment);
  const resend = useServerFn(resendGuestComment);
  const [r, setR] = useState<R | null>(null);
  const [resent, setResent] = useState(false);
  const ran = useRef(false);
  // Runs in the browser only (not during page rendering), so link scanners that do not run scripts cannot confirm.
  useEffect(() => {
    if (ran.current) return; ran.current = true;
    if (!t) { setR({ status: "invalid" }); return; }
    if (!pending.has(t)) pending.set(t, confirm({ data: { token: t } }).catch(() => ({ status: "invalid" }) as R));
    pending.get(t)!.then(setR);
  }, [t, confirm]);
  const txt = r ? TEXT[r.status] : null;
  return (
    <PageShell>
      <PageHeading eyebrow="Komentarze" title={txt?.title ?? "Sprawdzamy link…"} intro={txt?.body ?? "To potrwa chwilę."} />
      <div className="flex flex-wrap items-center gap-4 px-5 py-10 lg:px-14">
        {r?.status === "expired" && r.canResend && !resent && (
          <Button onClick={async () => { await resend({ data: { token: t! } }).catch(() => null); setResent(true); }}>Wyślij nowy link</Button>
        )}
        {resent && <p className="text-sm text-foreground/85" role="status">Jeśli było to możliwe, wysłaliśmy nowy link na adres podany przy komentarzu. Nowy link można zamówić najwyżej raz na 10 minut.</p>}
        {r?.slug && <Link to="/artykuly/$slug" params={{ slug: r.slug }} hash="komentarze" className="text-gold underline underline-offset-4">Przejdź do artykułu</Link>}
        {r && !r.slug && <Link to="/artykuly" className="text-gold underline underline-offset-4">Wszystkie artykuły</Link>}
      </div>
    </PageShell>
  );
}
