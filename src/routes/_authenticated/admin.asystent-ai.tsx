import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { errMsg } from "@/components/admin/format";
import { CreateArticle, MaterialsTab } from "@/components/admin/ai/Materials";
import { listMaterials } from "@/lib/editor-materials.functions";
import { stageOf } from "@/lib/editor-materials";
import { MATERIAL_RULES } from "@/lib/editor-materials";
import {
  addNoteSource, addWebSource, deleteSource, developProposal, getEditorDashboard, getEditorSettings, listAnalyses, listProposals, listSources,
  previewAnalysisData, runAnalysis, saveEditorSettings, testAiConnection, updateProposal, updateSource,
} from "@/lib/editor-ai.functions";

export const Route = createFileRoute("/_authenticated/admin/asystent-ai")({
  head: () => ({ meta: [{ title: "Asystent redakcyjny AI — Panel TNB" }, { name: "description", content: "Prywatny asystent redakcyjny TNB." }, { name: "robots", content: "noindex, nofollow" }] }),
  component: EditorAi,
});

const TABS = [["pulpit", "Start"], ["zrodla", "Źródła wiedzy"], ["analiza", "Analiza tematów"], ["propozycje", "Propozycje materiałów"], ["materialy", "Materiały w pracy"], ["historia", "Historia analiz"], ["ustawienia", "Ustawienia agenta"]] as const;
type Tab = (typeof TABS)[number][0];
const STATUS: Record<string, string> = { new: "Nowa", considering: "Do rozważenia", accepted: "Zaakceptowana", rejected: "Odrzucona", later: "Odłożona na później", in_progress: "W trakcie realizacji", done: "Zrealizowana" };
const SRC_STATUS: Record<string, string> = { pending: "Do zatwierdzenia", approved: "Zatwierdzone", rejected: "Odrzucone" };
const KIND: Record<string, string> = { web: "Internet", note: "Notatka redakcyjna", idea: "Pomysł" };
const SCOPES = [["articles", "Własne artykuły i podcasty"], ["library", "Biblioteka"], ["web", "Źródła internetowe"], ["notes", "Notatki i pomysły"], ["community", "Zagregowane tematy społeczności"]] as const;
const FINDINGS: Record<string, string> = { recurring: "Powracające zagadnienia", needs: "Pytania i potrzeby odbiorców", partial: "Tematy rozwinięte częściowo", gaps: "Brakujące materiały", connections: "Powiązania między źródłami", series: "Możliwe serie", duplicates: "Potencjalne powtórzenia", community: "Sygnały ze społeczności" };
const fmt = (d?: string | null) => (d ? new Date(d).toLocaleString("pl-PL") : "—");
const box = "border border-border/60 p-4";
const input = "w-full border border-border/60 bg-background p-2 text-sm";

function EditorAi() {
  const [tab, setTab] = useState<Tab>("pulpit");
  const [matId, setMatId] = useState<string | null>(null);
  const dash = useServerFn(getEditorDashboard);
  const q = useQuery({ queryKey: ["ai-ed", "dash"], queryFn: () => dash(), retry: false });
  if (q.isLoading) return <p className="text-muted-foreground">Ładowanie…</p>;
  if (q.error) return <div className="max-w-xl"><h1 className="font-display text-3xl font-semibold uppercase">Asystent redakcyjny AI</h1><p role="alert" className="mt-4 text-sm text-destructive">{errMsg(q.error)}</p></div>;
  return (
    <div className="max-w-5xl">
      <h1 className="font-display text-3xl font-semibold uppercase">Asystent redakcyjny AI</h1>
      <p className="mt-2 text-sm text-muted-foreground">Na podstawie zatwierdzonych źródeł analizuje tematy, proponuje materiały i tworzy ich pełne wersje robocze — Ty jesteś redaktorem: edytujesz, zlecasz poprawki, zatwierdzasz i publikujesz w istniejących modułach. Model nie jest trenowany na danych TNB — przy każdej analizie dostaje wybrane źródła jako kontekst. Decyzje należą do redakcji.</p>
      <div className="mt-6 flex flex-wrap gap-2" role="tablist">{TABS.map(([k, l]) => <Button key={k} role="tab" aria-selected={tab === k} size="sm" variant={tab === k ? "default" : "outline"} onClick={() => setTab(k)}>{l}</Button>)}</div>
      <div className="mt-6">
        {tab === "pulpit" && <Dashboard d={q.data!} go={setTab} open={(id) => { setMatId(id); setTab("materialy"); }} />}
        {tab === "zrodla" && <Sources />}
        {tab === "analiza" && <Analysis aiOn={q.data!.aiConfigured} go={setTab} />}
        {tab === "propozycje" && <Proposals aiOn={q.data!.aiConfigured} onCreated={(id) => { setMatId(id); setTab("materialy"); }} />}
        {tab === "materialy" && <MaterialsTab aiOn={q.data!.aiConfigured} openId={matId} setOpenId={setMatId} />}
        {tab === "historia" && <History />}
        {tab === "ustawienia" && <Settings d={q.data!} />}
      </div>
    </div>
  );
}

function Dashboard({ d, go }: { d: Awaited<ReturnType<typeof getEditorDashboard>>; go: (t: Tab) => void }) {
  const tiles = [["Zatwierdzone źródła", d.approved], ["Artykuły (bez archiwum)", d.articles], ["Materiały Biblioteki", d.library], ["Nowe propozycje", d.fresh], ["Propozycje zaakceptowane", d.accepted], ["Źródła do zatwierdzenia", d.pending]] as const;
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3">{tiles.map(([l, v]) => <div key={l} className={box}><p className="text-xs uppercase tracking-widest text-muted-foreground">{l}</p><p className="mt-1 text-2xl font-semibold">{v}</p></div>)}</div>
      <div className={box + " space-y-1 text-sm"}>
        <p>Ostatnia analiza: <strong>{d.lastAnalysis ? `${fmt(d.lastAnalysis.created_at)} (${d.lastAnalysis.status === "done" ? "zakończona" : d.lastAnalysis.status === "failed" ? "błąd" : "w toku"})` : "jeszcze nie przeprowadzono"}</strong></p>
        <p>Połączenie z modelem AI: <strong className={d.aiConfigured ? "text-gold" : "text-destructive"}>{d.aiConfigured ? `skonfigurowane (${d.model})` : "nie skonfigurowane — generowanie wyłączone"}</strong></p>
        <p>Analiza społeczności: <strong>{d.communityEnabled ? "włączona decyzją administratora" : "wyłączona (wymaga decyzji)"}</strong></p>
        {d.pending > 0 && <p className="text-gold">{d.pending} źródeł czeka na zatwierdzenie — nie są używane w analizach.</p>}
      </div>
      {!d.lastAnalysis && <div className={box + " text-sm"}><p className="font-medium">Jak zacząć</p><ol className="mt-2 list-decimal space-y-1 pl-5 text-muted-foreground"><li>Dodaj i zatwierdź źródła w zakładce „Źródła wiedzy” (opcjonalnie — artykuły i Biblioteka są dostępne od razu).</li><li>Przejdź do „Analiza tematów”, wybierz zakres i sprawdź, jakie dane zostaną wysłane.</li><li>Kliknij „Przeprowadź analizę”.</li></ol><Button className="mt-3" size="sm" onClick={() => go("analiza")}>Przejdź do analizy</Button></div>}
    </div>
  );
}

function Sources() {
  const qc = useQueryClient();
  const list = useServerFn(listSources), addWeb = useServerFn(addWebSource), addNote = useServerFn(addNoteSource), upd = useServerFn(updateSource), del = useServerFn(deleteSource);
  const q = useQuery({ queryKey: ["ai-ed", "sources"], queryFn: () => list() });
  const [url, setUrl] = useState(""), [comment, setComment] = useState(""), [busy, setBusy] = useState(false);
  const [note, setNote] = useState({ kind: "note" as "note" | "idea", title: "", content: "" });
  const [open, setOpen] = useState<string | null>(null);
  const [filter, setFilter] = useState("all");
  const refresh = () => qc.invalidateQueries({ queryKey: ["ai-ed"] });
  const act = async (p: Promise<{ ok: boolean; error?: string }>, okMsg: string) => { const r = await p; if (r.ok) { toast.success(okMsg); refresh(); } else toast.error(r.error ?? "Błąd"); return r.ok; };

  return (
    <div className="space-y-6">
      <form className={box + " space-y-2"} onSubmit={async (e) => { e.preventDefault(); setBusy(true); try { const r = await addWeb({ data: { url, comment } }); if (r.ok) { r.fetched ? toast.success("Pobrano treść — sprawdź podgląd i zatwierdź.") : toast.warning(r.error ?? "Nie pobrano treści"); setUrl(""); setComment(""); refresh(); } else toast.error(r.error); } catch (er) { toast.error(errMsg(er)); } finally { setBusy(false); } }}>
        <h2 className="font-semibold">Dodaj źródło z internetu</h2>
        <input className={input} type="url" required placeholder="https://…" value={url} onChange={(e) => setUrl(e.target.value)} aria-label="Adres URL" />
        <textarea className={input} rows={2} maxLength={2000} placeholder="Dlaczego to źródło jest istotne? (opcjonalnie)" value={comment} onChange={(e) => setComment(e.target.value)} aria-label="Komentarz" />
        <p className="text-xs text-muted-foreground">Pobieramy tylko publicznie dostępny tekst. Nie omijamy logowania ani paywalli — w takim przypadku wkleisz fragment ręcznie. Źródło trafia do analiz dopiero po zatwierdzeniu.</p>
        <Button size="sm" disabled={busy}>{busy ? "Pobieranie…" : "Pobierz i dodaj"}</Button>
      </form>
      <form className={box + " space-y-2"} onSubmit={async (e) => { e.preventDefault(); if (await act(addNote({ data: note }), "Dodano — zatwierdź, aby użyć w analizie.")) setNote({ kind: "note", title: "", content: "" }); }}>
        <h2 className="font-semibold">Dodaj notatkę redakcyjną lub pomysł</h2>
        <select className={input} value={note.kind} onChange={(e) => setNote({ ...note, kind: e.target.value as "note" | "idea" })} aria-label="Rodzaj"><option value="note">Notatka redakcyjna</option><option value="idea">Pomysł</option></select>
        <input className={input} required minLength={2} maxLength={300} placeholder="Tytuł" value={note.title} onChange={(e) => setNote({ ...note, title: e.target.value })} aria-label="Tytuł" />
        <textarea className={input} required minLength={5} rows={3} placeholder="Treść" value={note.content} onChange={(e) => setNote({ ...note, content: e.target.value })} aria-label="Treść" />
        <Button size="sm">Dodaj</Button>
      </form>
      <div className="flex flex-wrap gap-2">{[["all", "Wszystkie"], ...Object.entries(SRC_STATUS)].map(([k, l]) => <Button key={k} size="sm" variant={filter === k ? "default" : "outline"} onClick={() => setFilter(k!)}>{l}</Button>)}</div>
      {q.isLoading ? <p className="text-muted-foreground">Ładowanie…</p> : (q.data ?? []).filter((s: any) => filter === "all" || s.status === filter).length === 0 ? <p className="text-sm text-muted-foreground">Brak źródeł w tym widoku. Artykuły i materiały Biblioteki są uwzględniane automatycznie i nie trzeba ich tu dodawać.</p> : (
        <ul className="space-y-3">{(q.data ?? []).filter((s: any) => filter === "all" || s.status === filter).map((s: any) => (
          <li key={s.id} className={box}>
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="min-w-0"><p className="font-medium break-words">{s.title || s.url || "Bez tytułu"}</p>
                <p className="text-xs text-muted-foreground">{KIND[s.kind]} · {SRC_STATUS[s.status]} · dodano {fmt(s.created_at)}{s.author ? ` · autor: ${s.author}` : ""}{s.published_on ? ` · data: ${s.published_on}` : ""}</p>
                {s.url && <a href={s.url} target="_blank" rel="noopener noreferrer nofollow" className="text-xs text-gold break-all hover:underline">{s.url}</a>}
                {s.fetch_status === "failed" && <p className="mt-1 text-xs text-destructive">Nie pobrano treści: {s.fetch_error}</p>}
              </div>
              <div className="flex flex-wrap gap-2">
                <Button size="sm" variant="outline" onClick={() => setOpen(open === s.id ? null : s.id)}>{open === s.id ? "Zwiń" : "Podgląd i edycja"}</Button>
                {s.status !== "approved" && <Button size="sm" onClick={() => act(upd({ data: { id: s.id, status: "approved" } }), "Zatwierdzono")}>Zatwierdź</Button>}
                {s.status !== "rejected" && <Button size="sm" variant="outline" onClick={() => act(upd({ data: { id: s.id, status: "rejected" } }), "Odrzucono")}>Odrzuć</Button>}
                <Button size="sm" variant="destructive" onClick={() => { if (confirm("Usunąć źródło i wszystkie jego dane z bazy wiedzy?")) act(del({ data: { id: s.id } }), "Usunięto"); }}>Usuń</Button>
              </div>
            </div>
            {open === s.id && <SourceEditor s={s} save={(p) => act(upd({ data: { id: s.id, ...p } }), "Zapisano")} />}
          </li>))}</ul>)}
    </div>
  );
}

function SourceEditor({ s, save }: { s: any; save: (p: any) => void }) {
  const [f, setF] = useState({ title: s.title ?? "", author: s.author ?? "", published_on: s.published_on ?? "", admin_comment: s.admin_comment ?? "", content: s.content ?? "" });
  return (
    <div className="mt-3 space-y-2 border-t border-border/60 pt-3">
      <div className="grid gap-2 sm:grid-cols-3">
        <input className={input} value={f.title} maxLength={300} onChange={(e) => setF({ ...f, title: e.target.value })} aria-label="Tytuł" placeholder="Tytuł" />
        <input className={input} value={f.author} maxLength={200} onChange={(e) => setF({ ...f, author: e.target.value })} aria-label="Autor" placeholder="Autor" />
        <input className={input} type="date" value={f.published_on} onChange={(e) => setF({ ...f, published_on: e.target.value })} aria-label="Data publikacji" />
      </div>
      <textarea className={input} rows={2} value={f.admin_comment} onChange={(e) => setF({ ...f, admin_comment: e.target.value })} aria-label="Komentarz" placeholder="Komentarz administratora" />
      <textarea className={input + " font-mono text-xs"} rows={10} value={f.content} onChange={(e) => setF({ ...f, content: e.target.value })} aria-label="Treść źródła" placeholder="Treść lub własne notatki (wklej ręcznie, jeśli nie udało się pobrać)" />
      <p className="text-xs text-muted-foreground">{f.content.length} znaków. Treść służy tylko analizie — nie kopiujemy całych artykułów do publikacji.</p>
      <Button size="sm" onClick={() => save({ title: f.title, author: f.author || null, published_on: f.published_on || null, admin_comment: f.admin_comment, content: f.content })}>Zapisz korektę</Button>
    </div>
  );
}

function Analysis({ aiOn, go }: { aiOn: boolean; go: (t: Tab) => void }) {
  const qc = useQueryClient();
  const preview = useServerFn(previewAnalysisData), run = useServerFn(runAnalysis);
  const [scopes, setScopes] = useState<string[]>(["articles", "library", "web", "notes"]);
  const [from, setFrom] = useState(""), [to, setTo] = useState(""), [focus, setFocus] = useState("");
  const [pv, setPv] = useState<Awaited<ReturnType<typeof previewAnalysisData>> | null>(null);
  const [busy, setBusy] = useState(false);
  const payload = () => ({ scopes: scopes as any, from: from || null, to: to || null });
  useEffect(() => { setPv(null); }, [scopes, from, to]);
  return (
    <div className="space-y-4">
      {!aiOn && <p role="alert" className="border border-destructive/60 p-3 text-sm text-destructive">Model AI nie jest skonfigurowany. Możesz przygotować zakres i podgląd danych, ale analiza nie zostanie uruchomiona.</p>}
      <fieldset className={box}><legend className="px-1 text-sm font-semibold">Zakres</legend>
        <div className="flex flex-wrap gap-4">{SCOPES.map(([k, l]) => <label key={k} className="flex items-center gap-2 text-sm"><input type="checkbox" className="accent-primary" checked={scopes.includes(k)} onChange={() => setScopes((s) => s.includes(k) ? s.filter((x) => x !== k) : [...s, k])} />{l}</label>)}</div>
        <Button className="mt-2" size="sm" variant="outline" onClick={() => setScopes(SCOPES.map(([k]) => k))}>Wszystkie zatwierdzone źródła</Button>
        <div className="mt-3 grid gap-2 sm:grid-cols-2"><label className="text-xs">Od<input type="date" className={input} value={from} onChange={(e) => setFrom(e.target.value)} /></label><label className="text-xs">Do<input type="date" className={input} value={to} onChange={(e) => setTo(e.target.value)} /></label></div>
        <p className="mt-1 text-xs text-muted-foreground">Okres dotyczy źródeł z datą; źródła bez daty są uwzględniane zawsze.</p>
        <textarea className={input + " mt-3"} rows={2} maxLength={500} placeholder="Na czym się skupić? (opcjonalnie, np. relacje z nastolatkami)" value={focus} onChange={(e) => setFocus(e.target.value)} aria-label="Priorytet" />
      </fieldset>
      <div className="flex flex-wrap gap-2">
        <Button size="sm" variant="outline" disabled={!scopes.length} onClick={async () => { try { setPv(await preview({ data: payload() })); } catch (e) { toast.error(errMsg(e)); } }}>Pokaż, jakie dane zostaną wysłane</Button>
        <Button size="sm" disabled={!aiOn || !pv || busy || !pv.docs.length} onClick={async () => {
          setBusy(true);
          try { const r = await run({ data: { ...payload(), focus } }); if (r.ok) { toast.success(`Analiza zakończona: ${r.proposals} propozycji${r.skipped ? `, pominięto ${r.skipped} powtórzeń` : ""}.`); qc.invalidateQueries({ queryKey: ["ai-ed"] }); go("propozycje"); } else toast.error(r.error); }
          catch (e) { toast.error(errMsg(e)); } finally { setBusy(false); }
        }}>{busy ? "Analiza trwa (do ok. 2 min)…" : "Przeprowadź analizę"}</Button>
      </div>
      {pv && <div className={box + " text-sm"}>
        <p className="font-medium">Do dostawcy AI (Lovable AI, model OpenAI) zostanie wysłanych {pv.docs.length} źródeł, ok. {Math.round(pv.totalChars / 1000)} tys. znaków, wraz z wytycznymi redakcyjnymi i tytułami wcześniej ocenionych propozycji.</p>
        <p className="mt-1 text-xs text-muted-foreground">Nie wysyłamy e-maili, numerów telefonów, imion autorów wpisów ani danych kont. Każde uruchomienie zużywa kredyty AI obszaru roboczego.</p>
        {pv.communityBlocked && <p className="mt-2 text-xs text-gold">Analiza społeczności jest wyłączona w ustawieniach — wpisy nie zostaną użyte.</p>}
        <ul className="mt-2 max-h-64 list-disc overflow-y-auto pl-5 text-xs">{pv.docs.map((d) => <li key={d.ref}>{d.ref} · {d.kind} · {d.title} ({d.chars} zn.)</li>)}</ul>
        {!pv.docs.length && <p className="mt-2 text-destructive">Brak danych w wybranym zakresie.</p>}
      </div>}
    </div>
  );
}

function RefList({ refs }: { refs: Array<{ ref: string; kind: string; title: string; url?: string | null }> }) {
  if (!refs?.length) return <span className="text-muted-foreground">—</span>;
  return <ul className="list-disc pl-5">{refs.map((r, i) => <li key={i}>{r.url ? <a href={r.url} target="_blank" rel="noopener noreferrer nofollow" className="text-gold hover:underline">{r.title}</a> : r.title} <span className="text-muted-foreground">({r.kind})</span></li>)}</ul>;
}

function Proposals({ aiOn, onCreated }: { aiOn: boolean; onCreated: (id: string) => void }) {
  const qc = useQueryClient();
  const list = useServerFn(listProposals), upd = useServerFn(updateProposal), dev = useServerFn(developProposal);
  const q = useQuery({ queryKey: ["ai-ed", "proposals"], queryFn: () => list() });
  const [filter, setFilter] = useState("active"), [open, setOpen] = useState<string | null>(null), [busy, setBusy] = useState<string | null>(null);
  const refresh = () => qc.invalidateQueries({ queryKey: ["ai-ed"] });
  const act = async (p: Promise<{ ok: boolean; error?: string }>, msg: string) => { const r = await p; r.ok ? (toast.success(msg), refresh()) : toast.error(r.error ?? "Błąd"); };
  if (q.isLoading) return <p className="text-muted-foreground">Ładowanie…</p>;
  const all = q.data?.proposals ?? [];
  const shown = all.filter((p: any) => filter === "all" || (filter === "active" ? !["rejected", "done"].includes(p.status) : p.status === filter));
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">{[["active", "Aktywne"], ["all", "Wszystkie"], ...Object.entries(STATUS)].map(([k, l]) => <Button key={k} size="sm" variant={filter === k ? "default" : "outline"} onClick={() => setFilter(k!)}>{l}</Button>)}</div>
      {!shown.length && <p className="text-sm text-muted-foreground">{all.length ? "Brak propozycji w tym widoku." : "Nie ma jeszcze propozycji. Przeprowadź pierwszą analizę."}</p>}
      <ul className="space-y-3">{shown.map((p: any) => {
        const d = p.data ?? {}; const ev = (q.data?.events ?? []).filter((e: any) => e.proposal_id === p.id);
        return (
          <li key={p.id} className={box}>
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="min-w-0"><p className="font-medium break-words">{p.title}</p><p className="text-xs text-muted-foreground">{p.format} · {STATUS[p.status]} · {fmt(p.created_at)}</p></div>
              <Button size="sm" variant="outline" onClick={() => setOpen(open === p.id ? null : p.id)}>{open === p.id ? "Zwiń" : "Szczegóły"}</Button>
            </div>
            <p className="mt-2 text-sm">{p.description}</p>
            {!["rejected", "done"].includes(p.status) && !p.linked_id && <div className="mt-3"><CreateArticle proposal={p} aiOn={aiOn} onCreated={onCreated} compact /></div>}
            {open === p.id && <div className="mt-3 space-y-3 border-t border-border/60 pt-3 text-sm">
              <EditTitle p={p} save={(t, desc) => act(upd({ data: { id: p.id, title: t, description: desc } }), "Zapisano")} />
              <dl className="grid gap-3 sm:grid-cols-2">
                <div><dt className="text-xs uppercase text-muted-foreground">Problem / potrzeba</dt><dd>{d.need || "—"}</dd></div>
                <div><dt className="text-xs uppercase text-muted-foreground">Grupa odbiorców</dt><dd>{d.audience || "—"}</dd></div>
                <div><dt className="text-xs uppercase text-muted-foreground">Główne wątki</dt><dd><ul className="list-disc pl-5">{(d.threads ?? []).map((t: string, i: number) => <li key={i}>{t}</li>)}</ul></dd></div>
                <div><dt className="text-xs uppercase text-muted-foreground">Proponowana struktura</dt><dd><ol className="list-decimal pl-5">{(d.structure ?? []).map((t: string, i: number) => <li key={i}>{t}</li>)}</ol></dd></div>
                <div><dt className="text-xs uppercase text-muted-foreground">Powiązane materiały TNB</dt><dd><RefList refs={d.related} /></dd></div>
                <div><dt className="text-xs uppercase text-muted-foreground">Źródła użyte do propozycji</dt><dd><RefList refs={d.sources} /></dd></div>
              </dl>
              <div className="border-l-2 border-gold pl-3"><p className="text-xs uppercase text-gold">Fakty ze źródeł</p>{(d.facts ?? []).length ? <ul className="list-disc pl-5">{d.facts.map((f: any, i: number) => <li key={i}>{f.text} <span className="text-xs text-muted-foreground">— {f.source?.title}</span></li>)}</ul> : <p className="text-muted-foreground">Brak faktów przypisanych do źródeł.</p>}</div>
              <div className="border-l-2 border-border pl-3"><p className="text-xs uppercase text-muted-foreground">Sugestie AI (nie fakty)</p><ul className="list-disc pl-5">{(d.suggestions ?? []).map((t: string, i: number) => <li key={i}>{t}</li>)}</ul></div>
              {d.duplicate_warning && <p className="text-gold">Możliwe powtórzenie: {d.duplicate_warning}</p>}
              <div><p className="text-xs uppercase text-muted-foreground">Kolejne kroki</p><ul className="list-disc pl-5">{(d.next_steps ?? []).map((t: string, i: number) => <li key={i}>{t}</li>)}</ul></div>
              {p.expansion && <div><p className="text-xs uppercase text-muted-foreground">Rozwinięcie</p><pre className="whitespace-pre-wrap break-words border border-border/60 bg-muted/30 p-3 text-xs">{p.expansion}</pre></div>}
              {p.outline && <div><p className="text-xs uppercase text-muted-foreground">Konspekt</p><pre className="whitespace-pre-wrap break-words border border-border/60 bg-muted/30 p-3 text-xs">{p.outline}</pre></div>}
              <details className="border border-border/60 p-3"><summary className="cursor-pointer text-xs uppercase tracking-widest text-muted-foreground">Więcej — status propozycji i funkcje pomocnicze</summary>
              <div className="mt-3 flex flex-wrap gap-2">
                <Button size="sm" onClick={() => act(upd({ data: { id: p.id, status: "accepted" } }), "Zaakceptowano")}>Akceptuj</Button>
                <Button size="sm" variant="outline" onClick={() => act(upd({ data: { id: p.id, status: "considering" } }), "Do rozważenia")}>Do rozważenia</Button>
                <Button size="sm" variant="outline" onClick={() => act(upd({ data: { id: p.id, status: "later" } }), "Odłożono")}>Na później</Button>
                <Button size="sm" variant="outline" onClick={() => act(upd({ data: { id: p.id, status: "in_progress" } }), "W trakcie")}>W trakcie realizacji</Button>
                <Button size="sm" variant="outline" onClick={() => act(upd({ data: { id: p.id, status: "done" } }), "Zrealizowana")}>Zrealizowana</Button>
                <Button size="sm" variant="destructive" onClick={() => { const r = prompt("Powód odrzucenia (opcjonalnie):"); if (r !== null) act(upd({ data: { id: p.id, status: "rejected", reason: r } }), "Odrzucono"); }}>Odrzuć</Button>
                <Button size="sm" variant="outline" disabled={!aiOn || busy === p.id} onClick={async () => { setBusy(p.id); await act(dev({ data: { id: p.id, mode: "expand" } }), "Rozwinięto"); setBusy(null); }}>{busy === p.id ? "AI pracuje…" : "Rozwiń propozycję (pomocniczo)"}</Button>
                <Button size="sm" variant="outline" disabled={!aiOn || busy === p.id} onClick={async () => { setBusy(p.id); await act(dev({ data: { id: p.id, mode: "outline" } }), "Wygenerowano konspekt"); setBusy(null); }}>Wygeneruj konspekt (pomocniczo)</Button>
              </div></details>
              <label className="block text-xs">Powiąż z istniejącym materiałem
                <select className={input} value={p.linked_id ? `${p.linked_kind}:${p.linked_id}` : ""} onChange={(e) => { const [k, id] = e.target.value.split(":"); act(upd({ data: { id: p.id, link: k && id ? { kind: k as "article" | "library", id } : null } }), "Zapisano powiązanie"); }}>
                  <option value="">— brak —</option>{(q.data?.materials ?? []).map((m: any) => <option key={m.id} value={`${m.kind}:${m.id}`}>{m.kind === "article" ? "Artykuł" : "Biblioteka"}: {m.title}</option>)}
                </select></label>
              {p.reject_reason && <p className="text-xs text-muted-foreground">Powód odrzucenia: {p.reject_reason}</p>}
              <div><p className="text-xs uppercase text-muted-foreground">Historia decyzji</p><ul className="text-xs text-muted-foreground">{ev.map((e: any, i: number) => <li key={i}>{fmt(e.created_at)} — {e.action === "status" ? `${STATUS[e.from_status] ?? e.from_status} → ${STATUS[e.to_status] ?? e.to_status}` : e.note ?? e.action}{e.action === "status" && e.note ? ` (${e.note})` : ""}</li>)}</ul></div>
            </div>}
          </li>);
      })}</ul>
    </div>
  );
}

function EditTitle({ p, save }: { p: any; save: (t: string, d: string) => void }) {
  const [t, setT] = useState(p.title), [d, setD] = useState(p.description ?? "");
  return <div className="space-y-2"><input className={input} value={t} maxLength={300} onChange={(e) => setT(e.target.value)} aria-label="Tytuł roboczy" /><textarea className={input} rows={2} value={d} maxLength={3000} onChange={(e) => setD(e.target.value)} aria-label="Opis" /><Button size="sm" variant="outline" onClick={() => save(t, d)}>Zapisz tytuł i opis</Button></div>;
}

function History() {
  const list = useServerFn(listAnalyses);
  const q = useQuery({ queryKey: ["ai-ed", "analyses"], queryFn: () => list() });
  const [open, setOpen] = useState<string | null>(null);
  if (q.isLoading) return <p className="text-muted-foreground">Ładowanie…</p>;
  if (!q.data?.length) return <p className="text-sm text-muted-foreground">Nie przeprowadzono jeszcze żadnej analizy.</p>;
  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground">Analiza pokazuje sygnały z dostępnych treści, a nie badanie opinii wszystkich użytkowników.</p>
      {q.data.map((a: any) => (
        <div key={a.id} className={box + " text-sm"}>
          <div className="flex flex-wrap justify-between gap-2"><p>{fmt(a.created_at)} · {a.status === "done" ? "zakończona" : a.status === "failed" ? "błąd" : "w toku"} · {a.source_count} źródeł · zakres: {(a.scope ?? []).map((s: string) => SCOPES.find(([k]) => k === s)?.[1] ?? s).join(", ")}{a.period_from || a.period_to ? ` · okres ${a.period_from ?? "…"}–${a.period_to ?? "…"}` : ""}</p>
            <Button size="sm" variant="outline" onClick={() => setOpen(open === a.id ? null : a.id)}>{open === a.id ? "Zwiń" : "Wyniki"}</Button></div>
          {a.error && <p className="mt-1 text-destructive">{a.error}</p>}
          {open === a.id && <div className="mt-3 space-y-3">
            {Object.entries(FINDINGS).map(([k, l]) => (a.findings?.[k] ?? []).length ? <div key={k}><p className="text-xs uppercase text-gold">{l}</p><ul className="list-disc pl-5">{a.findings[k].map((f: any, i: number) => <li key={i}>{f.text}{f.refs?.length ? <span className="text-xs text-muted-foreground"> — {f.refs.map((r: any) => r.title).join("; ")}</span> : null}</li>)}</ul></div> : null)}
            {(a.findings?.skipped ?? []).length > 0 && <div><p className="text-xs uppercase text-muted-foreground">Pominięte jako powtórzenia ocenionych tematów</p><ul className="list-disc pl-5 text-xs">{a.findings.skipped.map((s: string, i: number) => <li key={i}>{s}</li>)}</ul></div>}
            <div><p className="text-xs uppercase text-muted-foreground">Źródła użyte</p><RefList refs={a.sources_used} /></div>
          </div>}
        </div>))}
    </div>
  );
}

function Settings({ d }: { d: Awaited<ReturnType<typeof getEditorDashboard>> }) {
  const qc = useQueryClient();
  const get = useServerFn(getEditorSettings), save = useServerFn(saveEditorSettings), test = useServerFn(testAiConnection);
  const q = useQuery({ queryKey: ["ai-ed", "settings"], queryFn: () => get() });
  const [f, setF] = useState<{ guidelines: string; community_enabled: boolean; community_decision_note: string } | null>(null);
  const [testing, setTesting] = useState(false);
  useEffect(() => { if (q.data && !f) setF({ guidelines: q.data.guidelines, community_enabled: q.data.community_enabled, community_decision_note: q.data.community_decision_note }); }, [q.data, f]);
  if (!f) return <p className="text-muted-foreground">Ładowanie…</p>;
  return (
    <div className="space-y-6">
      <section className={box + " space-y-2 text-sm"}><h2 className="font-semibold">Stałe zasady tworzenia materiałów</h2><p className="text-xs text-muted-foreground">Dołączane do każdego wywołania AI przy tworzeniu i poprawianiu materiałów (niezmienne).</p><ul className="list-disc pl-5">{MATERIAL_RULES.map((r) => <li key={r}>{r}</li>)}</ul></section>
      <section className={box + " space-y-2 text-sm"}>
        <h2 className="font-semibold">Połączenie z modelem AI</h2>
        <p>Dostawca: Lovable AI (bramka platformy), model {d.model}. Klucz jest przechowywany wyłącznie na serwerze. Status: <strong>{d.aiConfigured ? "skonfigurowane" : "brak konfiguracji"}</strong>.</p>
        <p className="text-xs text-muted-foreground">Wysyłane dane: treść wybranych źródeł (artykuły, Biblioteka, zatwierdzone źródła i notatki, opcjonalnie anonimowe fragmenty publicznych wpisów), wytyczne redakcyjne i tytuły ocenionych propozycji. Każde wywołanie (test, analiza, rozwinięcie, konspekt) uruchamia się tylko po kliknięciu i zużywa kredyty AI.</p>
        <Button size="sm" variant="outline" disabled={!d.aiConfigured || testing} onClick={async () => { setTesting(true); try { const r = await test(); r.ok ? toast.success("Połączenie działa.") : toast.error(r.error); } catch (e) { toast.error(errMsg(e)); } finally { setTesting(false); } }}>{testing ? "Sprawdzanie…" : "Sprawdź połączenie (1 krótkie wywołanie)"}</Button>
      </section>
      <section className={box + " space-y-2"}>
        <h2 className="font-semibold">Pamięć redakcyjna — stałe wytyczne</h2>
        <p className="text-xs text-muted-foreground">Uwzględniane w każdej analizie razem ze Standardami redakcyjnymi TNB (tożsamość i język).</p>
        <textarea className={input} rows={12} maxLength={8000} value={f.guidelines} onChange={(e) => setF({ ...f, guidelines: e.target.value })} aria-label="Wytyczne redakcyjne" />
      </section>
      <section className={box + " space-y-2 text-sm"}>
        <h2 className="font-semibold">Analiza społeczności</h2>
        <p className="text-xs text-muted-foreground">Obecna Polityka prywatności i Regulamin nie informują użytkowników, że ich wpisy mogą być analizowane przez AI. Dlatego funkcja jest domyślnie wyłączona i wymaga Twojej decyzji (np. po aktualizacji polityki). Gdy jest włączona: tylko publiczne, opublikowane wpisy, bez autorów, bez e-maili, telefonów i linków, analiza zagregowana.</p>
        <label className="flex items-center gap-2"><input type="checkbox" className="accent-primary" checked={f.community_enabled} onChange={(e) => setF({ ...f, community_enabled: e.target.checked })} />Włącz analizę zagregowanych tematów społeczności</label>
        <textarea className={input} rows={2} maxLength={2000} placeholder="Decyzja i jej podstawa (wymagane przy włączeniu)" value={f.community_decision_note} onChange={(e) => setF({ ...f, community_decision_note: e.target.value })} aria-label="Podstawa decyzji" />
      </section>
      <Button onClick={async () => { const r = await save({ data: f }); if (r.ok) { toast.success("Zapisano ustawienia"); qc.invalidateQueries({ queryKey: ["ai-ed"] }); } else toast.error(r.error); }}>Zapisz ustawienia</Button>
    </div>
  );
}
