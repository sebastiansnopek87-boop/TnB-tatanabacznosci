import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { CHECKLIST, EDITORIAL_VERSION, IDENTITY, LANGUAGE, TEMPLATES, VISUAL, type Block } from "@/config/editorial";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/admin/standardy")({
  head: () => ({ meta: [{ title: "Standardy redakcyjne — Panel TNB" }, { name: "robots", content: "noindex" }] }),
  component: Standards,
});

const TABS = [["standard", "Standard"], ["szablony", "Szablony"], ["checklista", "Checklista"]] as const;

function List({ b }: { b: Block }) {
  return (
    <section className="mt-6">
      <h2 className="font-display text-xl font-semibold text-gold">{b.heading}</h2>
      <ul className="mt-3 list-disc space-y-2 pl-5 text-sm leading-relaxed">{b.items.map((i) => <li key={i}>{i}</li>)}</ul>
    </section>
  );
}

function Standards() {
  const [tab, setTab] = useState<(typeof TABS)[number][0]>("standard");
  const [done, setDone] = useState<Set<number>>(new Set());
  const copy = async (t: string) => { try { await navigator.clipboard.writeText(t); toast.success("Skopiowano szkielet"); } catch { toast.error("Nie udało się skopiować"); } };

  return (
    <div className="max-w-4xl">
      <h1 className="font-display text-3xl font-semibold uppercase">Standardy redakcyjne</h1>
      <p className="mt-2 text-sm text-muted-foreground">Zasady i szablony dla przyszłych materiałów Biblioteki TNB. Wersja {EDITORIAL_VERSION}.</p>
      <div className="mt-6 flex flex-wrap gap-2" role="tablist">
        {TABS.map(([k, l]) => <Button key={k} role="tab" aria-selected={tab === k} variant={tab === k ? "default" : "outline"} size="sm" onClick={() => setTab(k)}>{l}</Button>)}
      </div>

      {tab === "standard" && <><List b={IDENTITY} /><List b={LANGUAGE} /><List b={VISUAL} /></>}

      {tab === "szablony" && TEMPLATES.map((t) => (
        <section key={t.id} className="mt-6 border border-border p-4 sm:p-6">
          <h2 className="font-display text-xl font-semibold text-gold">{t.name}</h2>
          <p className="mt-1 text-sm text-muted-foreground">{t.purpose}</p>
          <ol className="mt-3 list-decimal space-y-1 pl-5 text-sm">{t.sections[0].items.map((i) => <li key={i}>{i}</li>)}</ol>
          <div className="mt-4 flex items-center justify-between gap-2"><span className="text-xs uppercase tracking-widest text-muted-foreground">Szkielet do skopiowania</span><Button size="sm" variant="outline" onClick={() => copy(t.skeleton)}>Kopiuj</Button></div>
          <pre className="mt-2 overflow-x-auto whitespace-pre-wrap break-words border border-border bg-muted/30 p-3 text-xs">{t.skeleton}</pre>
        </section>
      ))}

      {tab === "checklista" && (
        <section className="mt-6">
          <p className="text-sm text-muted-foreground">Zaznaczenia nie są zapisywane — to lista robocza przed publikacją. Zaznaczono {done.size} z {CHECKLIST.length}.</p>
          <ul className="mt-4 space-y-3">{CHECKLIST.map((c, i) => (
            <li key={c}><label className="flex cursor-pointer gap-3 text-sm"><input type="checkbox" className="mt-1 accent-primary" checked={done.has(i)} onChange={() => setDone((s) => { const n = new Set(s); n.has(i) ? n.delete(i) : n.add(i); return n; })} />{c}</label></li>
          ))}</ul>
        </section>
      )}
    </div>
  );
}
