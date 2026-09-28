import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/admin/tresci")({ component: Content });

const PLANNED = [
  "Dane kontaktowe i media społecznościowe",
  "Dane podmiotu (nazwa, dane prawne)",
  "Teksty stopki i strony Kontakt",
  "Polityka prywatności, regulamin, polityka cookies",
  "Sekcje strony głównej i zdjęcia",
];

function Content() {
  return (
    <div className="max-w-2xl">
      <h1 className="font-display text-3xl font-semibold uppercase">Treści strony</h1>
      <p className="mt-4 border border-border/60 p-4 text-sm text-muted-foreground">
        Niedostępne w tym etapie. Edycja treści zostanie dodana w kolejnym etapie — obecnie te dane są ustawiane w konfiguracji strony.
      </p>
      <ul className="mt-6 list-disc space-y-2 pl-5 text-sm text-foreground/80">
        {PLANNED.map((p) => <li key={p}>{p} <span className="text-muted-foreground">— wkrótce</span></li>)}
      </ul>
    </div>
  );
}
