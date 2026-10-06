import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { errMsg } from "@/components/admin/format";
import {
  aiEditFragment, aiEditWhole, createMaterial, getMaterial, listMaterials, prepareForPublication, previewCreateMaterial,
  restoreMaterialVersion, saveMaterial, setMaterialStatus,
} from "@/lib/editor-materials.functions";
import { CONTRIB, HANDOFF_LABEL, HANDOFF_PATH, MATERIAL_STATUS, VERIFY, handoffTarget, type MaterialSection } from "@/lib/editor-materials";

const box = "border border-border/60 bg-card/40 p-4";
const input = "mt-1 w-full border border-border bg-background px-3 py-2 text-sm";
const fmt = (s: string | null) => (s ? new Date(s).toLocaleString("pl-PL", { dateStyle: "short", timeStyle: "short" }) : "—");
const FORMATS = ["artykuł", "e-book", "poradnik", "podcast", "scenariusz audio/wideo", "zeszyt ćwiczeń", "karty refleksji", "materiał edukacyjny"];
const FRAG_CMDS = ["Napisz to mocniej.", "Napisz bardziej po ludzku.", "Skróć ten fragment o połowę.", "Rozwiń ten argument.", "Usuń moralizatorski ton.", "Dodaj więcej emocji.",
  "Zmień ten fragment tak, aby pasował do stylu TNB.", "Napisz ten fragment od nowa.", "Dodaj pytania do refleksji.", "Połącz te dwa fragmenty.", "Usuń powtórzenia.", "Znajdź słaby argument i zaproponuj lepszy."];
const WHOLE_CMDS = ["Przeczytaj cały materiał i popraw jego spójność.", "Skróć materiał o około 20%, zachowując najważniejsze treści.", "Zmień strukturę, aby materiał był bardziej angażujący.",
  "Znajdź wszystkie powtórzenia.", "Przygotuj mocniejszy początek.", "Sprawdź, czy materiał nie brzmi jak tekst wygenerowany przez AI.", "Przeredaguj tekst tak, aby był naturalny i zgodny z charakterem TNB."];
const rid = () => Math.random().toString(36).slice(2, 10);
const fix = (p: Promise<any>) => p.then((r) => r, (e) => ({ ok: false, error: errMsg(e) }));

// "STWÓRZ MATERIAŁ" on a proposal: shows sources, context size and duplicates, then requires explicit start.
export function CreateMaterial({ p, aiOn, onCreated }: { p: any; aiOn: boolean; onCreated: (id: string) => void }) {
  const prev = useServerFn(previewCreateMaterial), create = useServerFn(createMaterial);
  const [info, setInfo] = useState<any>(null), [format, setFormat] = useState(""), [dir, setDir] = useState(""), [busy, setBusy] = useState(false);
  if (!info) return <Button size="sm" disabled={!aiOn || busy} onClick={async () => { setBusy(true); const r: any = await fix(prev({ data: { proposalId: p.id } })); setBusy(false); if (!r.ok) { toast.error(r.error); return; } setInfo(r); setFormat(r.format); }}>{busy ? "Sprawdzam…" : "STWÓRZ MATERIAŁ"}</Button>;
  return (
    <div className="w-full space-y-3 border border-gold/60 p-3">
      <p className="text-xs uppercase text-gold">Przed generowaniem pełnej wersji roboczej</p>
      <ul className="text-sm">
        <li>Operacja: <b>pełna wersja robocza</b> — zostanie wykonane jedno wywołanie AI (zużywa kredyty).</li>
        <li>Wybrane źródła: <b>{info.sources.length}</b> {info.sources.length ? `(${info.sources.map((s: any) => s.title).join("; ")})` : "— AI oznaczy wszystkie fakty jako wymagające weryfikacji"}</li>
        <li>Objętość kontekstu: ok. {info.chars.toLocaleString("pl-PL")} znaków (~{info.tokens.toLocaleString("pl-PL")} tokenów wejścia)</li>
      </ul>
      {info.duplicates.length > 0 && <div className="border-l-2 border-destructive pl-3 text-sm"><p className="font-semibold text-destructive">UWAGA — PODOBNY MATERIAŁ ISTNIEJE</p><ul>{info.duplicates.map((d: any) => <li key={d.id}>{d.kind}: {d.title} ({d.score}% zbieżności tytułu)</li>)}</ul><p className="text-xs text-muted-foreground">Tworzenie nie jest blokowane — decyzja należy do Ciebie.</p></div>}
      <label className="block text-xs">Format<select className={input} value={format} onChange={(e) => setFormat(e.target.value)}>{FORMATS.map((f) => <option key={f}>{f}</option>)}</select></label>
      <label className="block text-xs">Kierunek / wskazówki (opcjonalnie)<textarea className={input} rows={2} value={dir} onChange={(e) => setDir(e.target.value)} maxLength={2000} /></label>
      <p className="text-xs text-muted-foreground">Trafi do: {HANDOFF_LABEL[handoffTarget(format)]} (dopiero po Twoim zatwierdzeniu, jako szkic).</p>
      <div className="flex gap-2">
        <Button size="sm" disabled={busy} onClick={async () => { setBusy(true); const r: any = await fix(create({ data: { proposalId: p.id, format, direction: dir, confirmed: true } })); setBusy(false); if (!r.ok) { toast.error(r.error); return; } toast.success("Wersja robocza gotowa"); onCreated(r.id); }}>{busy ? "AI pisze materiał… (może potrwać kilka minut)" : "ROZPOCZNIJ GENEROWANIE"}</Button>
        <Button size="sm" variant="outline" disabled={busy} onClick={() => setInfo(null)}>Anuluj</Button>
      </div>
    </div>
  );
}

export function MaterialsTab({ aiOn, openId, setOpenId }: { aiOn: boolean; openId: string | null; setOpenId: (id: string | null) => void }) {
  const list = useServerFn(listMaterials), status = useServerFn(setMaterialStatus);
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["ai-ed", "materials"], queryFn: () => list() });
  const [mode, setMode] = useState<"edit" | "ai" | "versions">("edit");
  if (openId) return <Editor id={openId} aiOn={aiOn} initial={mode} close={() => { setOpenId(null); qc.invalidateQueries({ queryKey: ["ai-ed", "materials"] }); }} />;
  if (q.isLoading) return <p className="text-muted-foreground">Ładowanie…</p>;
  const rows = q.data ?? [];
  const open = (id: string, m: typeof mode) => { setMode(m); setOpenId(id); };
  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">Wszystkie materiały przygotowane przez agenta. Nowy materiał tworzysz przyciskiem „STWÓRZ MATERIAŁ” w zakładce Propozycje.</p>
      {!rows.length && <p className="text-sm text-muted-foreground">Brak materiałów w pracy.</p>}
      {rows.length > 0 && <div className="overflow-x-auto"><table className="w-full text-left text-sm">
        <thead className="text-xs uppercase text-muted-foreground"><tr><th className="p-2">Materiał</th><th className="p-2">Format</th><th className="p-2">Status</th><th className="p-2">Utworzono</th><th className="p-2">Ostatnia zmiana</th><th className="p-2">Źródła</th><th className="p-2">Autor</th><th className="p-2">Akcje</th></tr></thead>
        <tbody>{rows.map((m: any) => <tr key={m.id} className="border-t border-border/60 align-top">
          <td className="p-2 font-medium">{m.title}</td><td className="p-2">{m.format}</td><td className="p-2">{MATERIAL_STATUS[m.status] ?? m.status}{m.handoff_kind && <span className="block text-xs text-gold">→ {HANDOFF_LABEL[m.handoff_kind as keyof typeof HANDOFF_LABEL]}</span>}</td>
          <td className="p-2">{fmt(m.created_at)}</td><td className="p-2">{fmt(m.updated_at)}</td><td className="p-2">{m.sourceCount}</td><td className="p-2">{m.last_author === "ai" ? "AI" : "Sebastian"}</td>
          <td className="p-2"><div className="flex flex-wrap gap-1">
            <Button size="sm" variant="outline" onClick={() => open(m.id, "edit")}>Otwórz</Button>
            <Button size="sm" variant="outline" onClick={() => open(m.id, "edit")}>Edytuj</Button>
            <Button size="sm" variant="outline" disabled={!aiOn} onClick={() => open(m.id, "ai")}>Poleć AI zmianę</Button>
            <Button size="sm" variant="outline" onClick={() => open(m.id, "versions")}>Historia wersji</Button>
            <Button size="sm" variant="outline" onClick={() => open(m.id, "edit")}>Przygotuj do publikacji</Button>
            {m.status !== "rejected" && <Button size="sm" variant="destructive" onClick={async () => { if (!confirm("Odrzucić materiał? Treść i wersje zostaną zachowane.")) return; const r: any = await fix(status({ data: { id: m.id, status: "rejected" } })); r.ok ? q.refetch() : toast.error(r.error); }}>Odrzuć</Button>}
          </div></td></tr>)}</tbody>
      </table></div>}
    </div>
  );
}

function Marked({ text }: { text: string }) {
  const parts = text.split(new RegExp(`(\\[(?:${CONTRIB}|${VERIFY})[^\\]]*\\])`, "g"));
  return <>{parts.map((p, i) => p.startsWith(`[${CONTRIB}`) ? <mark key={i} className="bg-gold/25 px-1 text-foreground">{p}</mark> : p.startsWith(`[${VERIFY}`) ? <mark key={i} className="bg-destructive/25 px-1 text-foreground">{p}</mark> : <span key={i}>{p}</span>)}</>;
}

function Editor({ id, aiOn, initial, close }: { id: string; aiOn: boolean; initial: "edit" | "ai" | "versions"; close: () => void }) {
  const get = useServerFn(getMaterial), save = useServerFn(saveMaterial), frag = useServerFn(aiEditFragment), whole = useServerFn(aiEditWhole),
    restore = useServerFn(restoreMaterialVersion), setStatus = useServerFn(setMaterialStatus), prepare = useServerFn(prepareForPublication);
  const q = useQuery({ queryKey: ["ai-ed", "material", id], queryFn: () => get({ data: { id } }) });
  const [title, setTitle] = useState(""), [subtitle, setSubtitle] = useState(""), [secs, setSecs] = useState<MaterialSection[]>([]), [dirty, setDirty] = useState(false);
  const [sel, setSel] = useState<{ sectionId: string; text: string } | null>(null), [instr, setInstr] = useState(""), [wInstr, setWInstr] = useState(""), [wConfirm, setWConfirm] = useState(false);
  const [busy, setBusy] = useState<string | null>(null), [report, setReport] = useState(""), [view, setView] = useState<string | null>(null), [cmp, setCmp] = useState<string | null>(null);
  const aiRef = useRef<HTMLDivElement>(null), verRef = useRef<HTMLDivElement>(null);
  const m: any = q.data?.material, versions: any[] = q.data?.versions ?? [];
  useEffect(() => { if (m) { setTitle(m.title); setSubtitle(m.subtitle); setSecs(m.sections ?? []); setDirty(false); } }, [m]);
  useEffect(() => { if (!q.data) return; (initial === "ai" ? aiRef : initial === "versions" ? verRef : null)?.current?.scrollIntoView({ behavior: "smooth" }); }, [q.data, initial]);
  if (q.isLoading) return <p className="text-muted-foreground">Ładowanie…</p>;
  if (q.error || !m) return <p className="text-destructive">{errMsg(q.error)}</p>;
  const edit = (i: number, patch: Partial<MaterialSection>) => { setSecs((s) => s.map((x, j) => (j === i ? { ...x, ...patch } : x))); setDirty(true); };
  const move = (i: number, d: number) => { setSecs((s) => { const n = [...s]; const t = n[i + d]; if (!t) return s; n[i + d] = n[i]!; n[i] = t; return n; }); setDirty(true); };
  const done = async (r: any, msg: string) => { if (!r.ok) { toast.error(r.error); return false; } toast.success(msg); await q.refetch(); return true; };
  const doSave = async (note = "") => { setBusy("save"); const r = await fix(save({ data: { id, title, subtitle, sections: secs, note } })); setBusy(null); return done(r, "Zapisano nową wersję"); };
  const pick = (t: HTMLTextAreaElement, sectionId: string) => { const text = t.value.slice(t.selectionStart, t.selectionEnd); if (text || sel?.sectionId !== sectionId) setSel({ sectionId, text }); };
  const markers = secs.filter((s) => s.body.includes(CONTRIB) || s.body.includes(VERIFY));
  const locked = !!m.handoff_id;
  const snap = (vid: string | null) => versions.find((v) => v.id === vid)?.snapshot;
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Button size="sm" variant="outline" onClick={() => { if (dirty && !confirm("Masz niezapisane zmiany. Wyjść bez zapisu?")) return; close(); }}>← Materiały w pracy</Button>
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <span>{m.format} · Status:</span>
          <select className="border border-border bg-background px-2 py-1" value={m.status} onChange={async (e) => done(await fix(setStatus({ data: { id, status: e.target.value as any } })), "Zmieniono status")}>
            {Object.entries(MATERIAL_STATUS).filter(([k]) => k !== "published" || m.status === "published").map(([k, l]) => <option key={k} value={k}>{l}</option>)}
          </select>
        </div>
      </div>

      {(m.duplicates ?? []).length > 0 && <div className="border-l-2 border-destructive pl-3 text-sm"><p className="font-semibold text-destructive">UWAGA — PODOBNY MATERIAŁ ISTNIEJE</p><ul>{m.duplicates.map((d: any) => <li key={d.id}>{d.kind}: {d.title} ({d.score}%)</li>)}</ul></div>}
      {markers.length > 0 && <div className="border-l-2 border-gold pl-3 text-sm"><p className="text-xs uppercase text-gold">Wymaga Twojej uwagi</p><ul>{markers.map((s) => <li key={s.id}><a className="underline" href={`#sec-${s.id}`}>{s.heading || "(bez nagłówka)"}</a> — {s.body.includes(CONTRIB) ? "potrzebny Twój wkład" : ""}{s.body.includes(CONTRIB) && s.body.includes(VERIFY) ? ", " : ""}{s.body.includes(VERIFY) ? "informacje do weryfikacji" : ""}</li>)}</ul>
        <p className="mt-1 text-xs text-muted-foreground">Możesz wpisać własną treść w miejsce oznaczenia, zostawić je, albo zaznaczyć je razem ze swoimi informacjami i polecić AI opracowanie.</p></div>}

      <section className={box}>
        <label className="block text-xs">Tytuł<input className={input} value={title} disabled={locked} onChange={(e) => { setTitle(e.target.value); setDirty(true); }} /></label>
        <label className="mt-2 block text-xs">Podtytuł / lead<textarea className={input} rows={2} value={subtitle} disabled={locked} onChange={(e) => { setSubtitle(e.target.value); setDirty(true); }} /></label>
      </section>

      {secs.map((s, i) => (
        <section key={s.id} id={`sec-${s.id}`} className={`${box} ${sel?.sectionId === s.id ? "border-gold" : ""}`}>
          <div className="flex flex-wrap items-center gap-2">
            <input className="flex-1 border border-border bg-background px-3 py-2 text-sm font-semibold" value={s.heading} disabled={locked} placeholder="Nagłówek sekcji" onChange={(e) => edit(i, { heading: e.target.value })} />
            <Button size="sm" variant="outline" disabled={locked || i === 0} onClick={() => move(i, -1)} aria-label="W górę">↑</Button>
            <Button size="sm" variant="outline" disabled={locked || i === secs.length - 1} onClick={() => move(i, 1)} aria-label="W dół">↓</Button>
            <Button size="sm" variant="outline" disabled={locked} onClick={() => { if (confirm("Usunąć sekcję? (poprzednia treść zostaje w historii wersji po zapisie)")) { setSecs((x) => x.filter((_, j) => j !== i)); setDirty(true); } }}>Usuń</Button>
          </div>
          <textarea className={`${input} font-[inherit]`} rows={Math.min(24, Math.max(5, Math.ceil(s.body.length / 90)))} value={s.body} disabled={locked}
            onChange={(e) => edit(i, { body: e.target.value })}
            onSelect={(e) => pick(e.currentTarget, s.id)} onMouseUp={(e) => pick(e.currentTarget, s.id)} onKeyUp={(e) => pick(e.currentTarget, s.id)} />
          {(s.body.includes(CONTRIB) || s.body.includes(VERIFY)) && <p className="mt-1 text-xs"><Marked text={s.body.match(new RegExp(`\\[(?:${CONTRIB}|${VERIFY})[^\\]]*\\]`, "g"))?.join("  ") ?? ""} /></p>}
          <p className="mt-1 text-xs text-muted-foreground">Źródła sekcji: {s.refs?.length ? s.refs.join("; ") : "brak przypisanych — treść spoza źródeł powinna być oznaczona do weryfikacji"}</p>
          {!locked && <div className="mt-2 flex flex-wrap gap-2">
            <Button size="sm" variant="outline" onClick={() => { setSecs((x) => [...x.slice(0, i + 1), { id: rid(), heading: "", body: "", refs: [] }, ...x.slice(i + 1)]); setDirty(true); }}>+ Sekcja poniżej</Button>
            <Button size="sm" variant="outline" onClick={() => { edit(i, { body: `${s.body}\n\n[${CONTRIB}: opisz tu własne doświadczenie]` }); }}>+ Oznacz miejsce na mój wkład</Button>
            <Button size="sm" variant="outline" disabled={!aiOn} onClick={() => { setSel({ sectionId: s.id, text: sel?.sectionId === s.id ? sel.text : "" }); aiRef.current?.scrollIntoView({ behavior: "smooth" }); }}>Polecenie AI dla tej sekcji</Button>
          </div>}
        </section>
      ))}
      {!locked && <div className="flex flex-wrap gap-2">
        <Button size="sm" variant="outline" onClick={() => { setSecs((x) => [...x, { id: rid(), heading: "", body: "", refs: [] }]); setDirty(true); }}>+ Dodaj sekcję</Button>
        <Button size="sm" disabled={!dirty || busy === "save"} onClick={() => doSave()}>{busy === "save" ? "Zapisywanie…" : "Zapisz wersję roboczą"}</Button>
        {dirty && <span className="self-center text-xs text-gold">Niezapisane zmiany</span>}
      </div>}

      {!locked && <section ref={aiRef} className={box}>
        <h3 className="font-semibold">Polecenie AI dla fragmentu</h3>
        <p className="text-xs text-muted-foreground">{sel ? `Sekcja: „${secs.find((s) => s.id === sel.sectionId)?.heading || "bez nagłówka"}” — ${sel.text ? `zaznaczono ${sel.text.length} znaków` : "brak zaznaczenia: zmiana obejmie całą sekcję"}` : "Zaznacz fragment tekstu w dowolnej sekcji (lub kliknij „Polecenie AI dla tej sekcji”)."}</p>
        <div className="mt-2 flex flex-wrap gap-1">{FRAG_CMDS.map((c) => <Button key={c} size="sm" variant={instr === c ? "default" : "outline"} onClick={() => setInstr(c)}>{c}</Button>)}</div>
        <textarea className={input} rows={2} placeholder="Własne polecenie, np. „Opracuj ten fragment na podstawie moich informacji: …”" value={instr} onChange={(e) => setInstr(e.target.value)} />
        <Button className="mt-2" size="sm" disabled={!aiOn || !sel || instr.trim().length < 2 || !!busy || dirty} onClick={async () => {
          setBusy("frag"); const r = await fix(frag({ data: { id, sectionId: sel!.sectionId, selection: sel!.text, instruction: instr } })); setBusy(null); if (await done(r, "AI zmieniło fragment — zapisano nową wersję")) setSel(null);
        }}>{busy === "frag" ? "AI pracuje…" : "Wykonaj (1 wywołanie AI)"}</Button>
        {dirty && <p className="mt-1 text-xs text-gold">Najpierw zapisz swoje zmiany, aby AI pracowało na aktualnej wersji.</p>}

        <h3 className="mt-6 font-semibold">Polecenie dla całego materiału</h3>
        <div className="mt-2 flex flex-wrap gap-1">{WHOLE_CMDS.map((c) => <Button key={c} size="sm" variant={wInstr === c ? "default" : "outline"} onClick={() => { setWInstr(c); setWConfirm(false); }}>{c}</Button>)}</div>
        <textarea className={input} rows={2} value={wInstr} onChange={(e) => { setWInstr(e.target.value); setWConfirm(false); }} placeholder="Własne polecenie dla całości" />
        {!wConfirm ? <Button className="mt-2" size="sm" variant="outline" disabled={!aiOn || wInstr.trim().length < 2 || dirty} onClick={() => setWConfirm(true)}>Dalej</Button> : (
          <div className="mt-2 border border-gold/60 p-3 text-sm">
            <p>Operacja: <b>polecenie dla całego materiału</b> · sekcji: {secs.length} · objętość: ok. {secs.reduce((a, s) => a + s.body.length, 0).toLocaleString("pl-PL")} znaków · źródła: {(m.sources ?? []).length}. Zostanie wykonane wywołanie AI.</p>
            <div className="mt-2 flex gap-2">
              <Button size="sm" disabled={!!busy} onClick={async () => { setBusy("whole"); const r: any = await fix(whole({ data: { id, instruction: wInstr, confirmed: true } })); setBusy(null); setWConfirm(false); if (r.ok) setReport(r.report); await done(r, r.changed ? "Zastosowano zmiany — nowa wersja" : "Analiza gotowa (bez zmian w tekście)"); }}>{busy === "whole" ? "AI pracuje…" : "ROZPOCZNIJ GENEROWANIE"}</Button>
              <Button size="sm" variant="outline" onClick={() => setWConfirm(false)}>Anuluj</Button>
            </div>
          </div>)}
        {report && <div className="mt-3 border-l-2 border-gold pl-3 text-sm"><p className="text-xs uppercase text-gold">Raport AI</p><p className="whitespace-pre-wrap">{report}</p></div>}
      </section>}

      <section className={box}>
        <h3 className="font-semibold">ŹRÓDŁA WYKORZYSTANE</h3>
        {(m.sources ?? []).length ? <ul className="mt-2 list-disc pl-5 text-sm">{m.sources.map((s: any) => <li key={s.ref}>{s.title} <span className="text-xs text-muted-foreground">({s.kind}){s.url ? ` — ${s.url}` : ""}</span></li>)}</ul> : <p className="text-sm text-muted-foreground">Brak zatwierdzonych źródeł — wszystkie fakty wymagają weryfikacji.</p>}
      </section>

      <section ref={verRef} className={box}>
        <h3 className="font-semibold">Historia wersji</h3>
        <ul className="mt-2 space-y-1 text-sm">{versions.map((v, i) => <li key={v.id} className="flex flex-wrap items-center gap-2 border-t border-border/40 pt-1">
          <span className="font-medium">Wersja {v.n}</span><span className="text-xs text-muted-foreground">{fmt(v.created_at)} · {v.author === "ai" ? "AI" : "Sebastian"} · {v.note}</span>
          <Button size="sm" variant="outline" onClick={() => { setView(view === v.id ? null : v.id); setCmp(null); }}>Podgląd</Button>
          {versions[i + 1] && <Button size="sm" variant="outline" onClick={() => { setCmp(cmp === v.id ? null : v.id); setView(null); }}>Porównaj z poprzednią</Button>}
          {i > 0 && !locked && <Button size="sm" variant="outline" onClick={async () => { if (dirty && !confirm("Niezapisane zmiany zostaną utracone. Kontynuować?")) return; done(await fix(restore({ data: { id, versionId: v.id } })), `Przywrócono wersję ${v.n}`); }}>PRZYWRÓĆ WERSJĘ</Button>}
        </li>)}</ul>
        {view && <VersionView s={snap(view)} />}
        {cmp && <Compare a={versions[versions.findIndex((v) => v.id === cmp) + 1]?.snapshot} b={snap(cmp)} />}
      </section>

      <section className={box}>
        <h3 className="font-semibold">Przekazanie do publikacji</h3>
        {locked ? <p className="mt-2 text-sm">Przekazano do modułu <b>{HANDOFF_LABEL[m.handoff_kind as keyof typeof HANDOFF_LABEL]}</b> jako szkic ({fmt(m.handoff_at)}). Ostatnią edycję i publikację wykonujesz tam: <Link className="text-gold underline" to={HANDOFF_PATH[m.handoff_kind as keyof typeof HANDOFF_PATH]}>otwórz moduł</Link>.</p> : <>
          <p className="mt-1 text-sm text-muted-foreground">AI nie publikuje. Przycisk utworzy <b>szkic</b> w module {HANDOFF_LABEL[handoffTarget(m.format)]}; publikację zatwierdzasz tam ręcznie. Wymaga statusu „Gotowe do publikacji”.</p>
          <Button className="mt-2" size="sm" disabled={dirty || m.status !== "ready" || busy === "prep"} onClick={async () => {
            setBusy("prep"); let r: any = await fix(prepare({ data: { id } }));
            if (!r.ok && r.openMarkers && confirm(`${r.error}\nPrzekazać mimo to? Oznaczenia zostaną w szkicu.`)) r = await fix(prepare({ data: { id, acceptOpenMarkers: true } }));
            setBusy(null); done(r, "Utworzono szkic w module publikacji");
          }}>PRZYGOTUJ DO PUBLIKACJI</Button>
        </>}
      </section>
    </div>
  );
}

function VersionView({ s }: { s: any }) {
  if (!s) return null;
  return <div className="mt-3 max-h-[480px] overflow-auto border border-border/60 bg-muted/20 p-3 text-sm"><p className="font-semibold">{s.title}</p><p className="text-muted-foreground">{s.subtitle}</p>
    {(s.sections ?? []).map((x: any) => <div key={x.id} className="mt-3"><p className="font-semibold">{x.heading}</p><p className="whitespace-pre-wrap"><Marked text={x.body} /></p></div>)}</div>;
}

function Compare({ a, b }: { a: any; b: any }) {
  if (!a || !b) return null;
  const rows = Math.max(a.sections?.length ?? 0, b.sections?.length ?? 0);
  return <div className="mt-3 max-h-[480px] overflow-auto border border-border/60 text-xs">
    <div className="grid grid-cols-2 gap-2 p-2 font-semibold"><span>Poprzednia</span><span>Ta wersja</span></div>
    {a.title !== b.title && <div className="grid grid-cols-2 gap-2 bg-gold/10 p-2"><span>{a.title}</span><span>{b.title}</span></div>}
    {Array.from({ length: rows }).map((_, i) => { const x = a.sections?.[i], y = b.sections?.[i]; const same = x && y && x.heading === y.heading && x.body === y.body;
      return <div key={i} className={`grid grid-cols-2 gap-2 border-t border-border/40 p-2 ${same ? "opacity-50" : "bg-gold/10"}`}>
        <div><b>{x?.heading}</b><p className="whitespace-pre-wrap">{same ? "(bez zmian)" : x?.body ?? "—"}</p></div>
        <div><b>{y?.heading}</b><p className="whitespace-pre-wrap">{same ? "(bez zmian)" : y?.body ?? "—"}</p></div></div>; })}
  </div>;
}
