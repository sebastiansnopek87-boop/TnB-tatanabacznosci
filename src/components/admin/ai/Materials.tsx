import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { errMsg } from "@/components/admin/format";
import { ArticleView } from "@/components/articles/ArticleView";
import {
  aiEditFragment, aiEditWhole, approveAndHandoff, finishMaterial, generateMaterialImage, getMaterial, listMaterials, materialImageUrls, previewCreateMaterial,
  restoreMaterialVersion, saveMaterial, setMaterialStatus, startMaterial, updateMaterialImage, writeMaterial,
} from "@/lib/editor-materials.functions";
import { CONTRIB, HANDOFF_LABEL, HANDOFF_PATH, USAGE_LABEL, VERIFY, handoffTarget, stageOf, type ArticleMeta, type MaterialImage, type MaterialSection } from "@/lib/editor-materials";
import { articleCategoriesQuery } from "@/lib/articles";
import { newSection, type PageSection } from "@/lib/pages";

const box = "border border-border/60 bg-card/40 p-4";
const input = "mt-1 w-full border border-border bg-background px-3 py-2 text-sm";
const fmt = (s: string | null) => (s ? new Date(s).toLocaleString("pl-PL", { dateStyle: "short", timeStyle: "short" }) : "—");
const FORMATS = ["artykuł", "e-book", "poradnik", "podcast", "scenariusz audio/wideo", "zeszyt ćwiczeń", "karty refleksji", "materiał edukacyjny"];
const FRAG_CMDS = ["Napisz to mocniej.", "Napisz bardziej po ludzku.", "Skróć ten fragment o połowę.", "Rozwiń ten argument.", "Usuń moralizatorski ton.", "Dodaj więcej emocji.",
  "Zmień ten fragment tak, aby pasował do stylu TNB.", "Napisz ten fragment od nowa.", "Usuń powtórzenia.", "Znajdź słaby argument i zaproponuj lepszy.", "Zmień ton na bardziej naturalny."];
const WHOLE_CMDS = ["Przeczytaj cały materiał i popraw jego spójność.", "Skróć materiał o około 20%, zachowując najważniejsze treści.", "Przygotuj mocniejszy początek.",
  "Znajdź wszystkie powtórzenia.", "Sprawdź, czy materiał nie brzmi jak tekst wygenerowany przez AI.", "Przeredaguj tekst tak, aby był naturalny i zgodny z charakterem TNB."];
const rid = () => Math.random().toString(36).slice(2, 10);
const fix = (p: Promise<any>) => p.then((r) => r, (e) => ({ ok: false, error: errMsg(e) }));
const tok = (u?: { input: number; output: number }) => (u ? `${(u.input + u.output).toLocaleString("pl-PL")} tokenów (wejście ${u.input.toLocaleString("pl-PL")}, wyjście ${u.output.toLocaleString("pl-PL")})` : "—");
export const ImgKey = (id: string) => ["ai-ed", "img", id];

// ---------- Creation: summary -> explicit start -> real stage-by-stage progress ----------
type Step = { key: string; label: string; state: "todo" | "doing" | "done" | "error"; note?: string | undefined };
export function CreateArticle({ proposal, topic: topic0 = "", aiOn, onCreated, onCancel, compact }: { proposal?: any; topic?: string; aiOn: boolean; onCreated: (id: string) => void; onCancel?: () => void; compact?: boolean }) {
  const prev = useServerFn(previewCreateMaterial), start = useServerFn(startMaterial), write = useServerFn(writeMaterial), gen = useServerFn(generateMaterialImage), finish = useServerFn(finishMaterial);
  const [topic, setTopic] = useState(topic0), [info, setInfo] = useState<any>(null), [format, setFormat] = useState("artykuł"), [dir, setDir] = useState("");
  const [busy, setBusy] = useState(false), [steps, setSteps] = useState<Step[] | null>(null), [usage, setUsage] = useState({ input: 0, output: 0, images: 0 }), [failedId, setFailedId] = useState<string | null>(null);
  const label = format === "artykuł" ? "STWÓRZ ARTYKUŁ" : "STWÓRZ MATERIAŁ";
  const check = async () => {
    setBusy(true); const r: any = await fix(prev({ data: { proposalId: proposal?.id ?? null, topic } })); setBusy(false);
    if (!r.ok) { toast.error(r.error); return; } setInfo(r); setFormat(r.format);
  };
  const set = (k: string, state: Step["state"], note?: string) => setSteps((s) => s!.map((x) => (x.key === k ? { ...x, state, note: note ?? x.note } : x)));
  const run = async () => {
    const base: Step[] = [
      { key: "src", label: info.summaries ? `Przygotowanie źródeł (pełna treść + ${info.summaries} streszczenie/a)` : "Przygotowanie źródeł (pełna treść)", state: "doing" },
      { key: "write", label: format === "artykuł" ? "Pisanie artykułu, SEO i uwag redakcyjnych" : "Pisanie materiału", state: "todo" },
      { key: "img", label: "Obrazy (obraz główny i ewentualne wewnętrzne)", state: "todo" },
      { key: "fin", label: "Finalizacja", state: "todo" },
    ];
    setSteps(base); setBusy(true);
    const u = { input: 0, output: 0, images: 0 };
    const r1: any = await fix(start({ data: { proposalId: proposal?.id ?? null, topic: info.topic, format, direction: dir, confirmed: true } }));
    if (!r1.ok) { set("src", "error", r1.error); setBusy(false); return; }
    u.input += r1.usage.input; u.output += r1.usage.output; setUsage({ ...u }); set("src", "done"); set("write", "doing");
    const r2: any = await fix(write({ data: { id: r1.id } }));
    if (!r2.ok) { set("write", "error", r2.error); setFailedId(r1.id); setBusy(false); return; }
    u.input += r2.usage.input; u.output += r2.usage.output; setUsage({ ...u }); set("write", "done"); set("img", "doing", `0 z ${r2.images.length}`);
    let ok = 0; const errs: string[] = [];
    for (const [i, imageId] of (r2.images as string[]).entries()) {
      set("img", "doing", `${i + 1} z ${r2.images.length}…`);
      const r3: any = await fix(gen({ data: { id: r1.id, imageId } }));
      if (r3.ok) { ok++; u.images++; setUsage({ ...u }); } else errs.push(r3.error);
    }
    set("img", errs.length && !ok ? "error" : "done", `${ok} z ${r2.images.length} wygenerowano${errs.length ? ` — ${errs[0]} (możesz ponowić w edytorze)` : ""}`);
    set("fin", "doing");
    const r4: any = await fix(finish({ data: { id: r1.id } }));
    set("fin", r4.ok ? "done" : "error", r4.ok ? undefined : r4.error); setBusy(false);
    if (r4.ok) { toast.success("Artykuł gotowy do przeglądu"); onCreated(r1.id); }
  };
  if (steps) return (
    <div className="w-full space-y-3 border border-gold/60 p-4">
      <p className="text-xs uppercase tracking-widest text-gold">Tworzenie: {info.topic}</p>
      <ol className="space-y-1 text-sm">{steps.map((s) => <li key={s.key} className={s.state === "error" ? "text-destructive" : s.state === "todo" ? "text-muted-foreground" : ""}>
        <span className="inline-block w-5">{s.state === "done" ? "✓" : s.state === "doing" ? "●" : s.state === "error" ? "✕" : "○"}</span>{s.label}{s.state === "doing" && <span className="ml-2 animate-pulse text-gold">trwa…</span>}{s.note && <span className="block pl-5 text-xs">{s.note}</span>}</li>)}</ol>
      <p className="text-xs text-muted-foreground">Rzeczywiste zużycie do tej pory: {tok(usage)}{usage.images ? `, obrazy: ${usage.images}` : ""}. Nie pokazujemy procentów — tylko faktyczny etap.</p>
      {!busy && steps.some((s) => s.state === "error") && <div className="flex gap-2">
        {failedId && <Button size="sm" onClick={async () => { setSteps(null); onCreated(failedId); }}>Otwórz materiał</Button>}
        <Button size="sm" variant="outline" onClick={() => { setSteps(null); setFailedId(null); }}>Wróć do podsumowania</Button></div>}
    </div>
  );
  if (!info) return compact && proposal ? <Button disabled={!aiOn || busy} onClick={check}>{busy ? "Sprawdzam…" : label}</Button> : (
    <div className="space-y-2">
      {!proposal && <label className="block text-xs">Temat artykułu<textarea className={input} rows={2} maxLength={600} value={topic} onChange={(e) => setTopic(e.target.value)} placeholder="np. Jak rozmawiać z nastoletnim synem, kiedy on milczy" /></label>}
      <div className="flex gap-2"><Button disabled={!aiOn || busy || (!proposal && topic.trim().length < 5)} onClick={check}>{busy ? "Sprawdzam źródła…" : "Dalej — pokaż podsumowanie"}</Button>{onCancel && <Button variant="outline" onClick={onCancel}>Anuluj</Button>}</div>
      {!aiOn && <p className="text-xs text-destructive">Model AI nie jest skonfigurowany.</p>}
    </div>
  );
  return (
    <div className="w-full space-y-3 border border-gold/60 p-4 text-sm">
      <p className="text-xs uppercase tracking-widest text-gold">Podsumowanie przed tworzeniem</p>
      <dl className="grid gap-2 sm:grid-cols-2">
        <div><dt className="text-xs uppercase text-muted-foreground">Temat</dt><dd className="font-medium">{info.topic}</dd></div>
        <div><dt className="text-xs uppercase text-muted-foreground">Format</dt><dd><select className={input} value={format} onChange={(e) => setFormat(e.target.value)}>{FORMATS.map((f) => <option key={f}>{f}</option>)}</select></dd></div>
        <div><dt className="text-xs uppercase text-muted-foreground">Liczba źródeł</dt><dd>{info.sources.filter((s: any) => s.usage !== "skipped").length} użytych{info.sources.some((s: any) => s.usage === "skipped") ? `, ${info.sources.filter((s: any) => s.usage === "skipped").length} pominiętych` : ""}</dd></div>
        <div><dt className="text-xs uppercase text-muted-foreground">Przewidywana objętość wejścia</dt><dd>ok. {info.chars.toLocaleString("pl-PL")} znaków (~{info.tokens.toLocaleString("pl-PL")} tokenów)</dd></div>
        <div className="sm:col-span-2"><dt className="text-xs uppercase text-muted-foreground">Przewidywany koszt</dt><dd>Koszt zostanie określony po wykonaniu operacji (pokażemy rzeczywiste zużycie tokenów i liczbę obrazów).</dd></div>
      </dl>
      <SourcesList sources={info.sources} title="ŹRÓDŁA WYKORZYSTANE DO TEGO ARTYKUŁU" />
      {info.duplicates.length > 0 && <div className="border-l-2 border-destructive pl-3"><p className="font-semibold text-destructive">UWAGA — PODOBNY MATERIAŁ ISTNIEJE</p><ul>{info.duplicates.map((d: any) => <li key={d.id}>{d.kind}: {d.title} ({d.score}% zbieżności tytułu)</li>)}</ul><p className="text-xs text-muted-foreground">Tworzenie nie jest blokowane — decyzja należy do Ciebie.</p></div>}
      <div><p className="text-xs uppercase text-muted-foreground">Co AI zrobi</p><ul className="list-disc pl-5">
        <li>przygotuje pełny{format === "artykuł" ? " artykuł" : " materiał"} — gotowy tekst, bez konspektu i placeholderów,</li>{format === "artykuł" && <li>przygotuje SEO, adres, kategorię, tagi, lead i ewentualne CTA,</li>}
        <li>zaplanuje i wygeneruje obrazy (obraz główny + wewnętrzne tylko tam, gdzie wspierają treść),</li><li>wątpliwości zapisze osobno w „Uwagach redakcyjnych” (nie trafiają do tekstu),</li>
        <li>zostawi materiał do Twojego przeglądu — nic nie publikuje.</li></ul></div>
      <label className="block text-xs">Kierunek / wskazówki (opcjonalnie)<textarea className={input} rows={2} value={dir} onChange={(e) => setDir(e.target.value)} maxLength={2000} /></label>
      <p className="text-xs text-muted-foreground">Po zatwierdzeniu trafi do: {HANDOFF_LABEL[handoffTarget(format)]} (jako szkic).</p>
      <div className="flex gap-2"><Button disabled={busy} onClick={run}>ROZPOCZNIJ TWORZENIE</Button><Button variant="outline" onClick={() => { setInfo(null); onCancel?.(); }}>Anuluj</Button></div>
    </div>
  );
}

function SourcesList({ sources, title }: { sources: any[]; title: string }) {
  return <div><p className="text-xs uppercase text-gold">{title}</p>
    {!sources.length ? <p className="text-muted-foreground">Brak dopasowanych źródeł — AI napisze tekst bez konkretnych faktów i zapisze uwagi do weryfikacji.</p> :
      <ul className="mt-1 space-y-1">{sources.map((s: any) => <li key={s.ref ?? s.id} className="border-t border-border/40 pt-1">
        <details><summary className="cursor-pointer"><b>{s.title}</b> <span className="text-xs text-muted-foreground">· {s.kind} · {s.status ?? "—"} · {s.usage ? USAGE_LABEL[s.usage as keyof typeof USAGE_LABEL] : "—"}{s.total ? ` · ${s.total.toLocaleString("pl-PL")} znaków` : ""}</span></summary>
          <p className="mt-1 whitespace-pre-wrap text-xs text-muted-foreground">{s.excerpt ? `${s.excerpt}${s.total > 600 ? "…" : ""}` : "Podgląd niedostępny."}</p>{s.url && <a className="text-xs text-gold underline" href={s.url} target="_blank" rel="noreferrer">otwórz źródło</a>}</details></li>)}</ul>}
  </div>;
}

// ---------- List ----------
export function MaterialsTab({ aiOn, openId, setOpenId }: { aiOn: boolean; openId: string | null; setOpenId: (id: string | null) => void }) {
  const list = useServerFn(listMaterials), status = useServerFn(setMaterialStatus);
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["ai-ed", "materials"], queryFn: () => list() });
  if (openId) return <Editor id={openId} aiOn={aiOn} close={() => { setOpenId(null); qc.invalidateQueries({ queryKey: ["ai-ed"] }); }} />;
  if (q.isLoading) return <p className="text-muted-foreground">Ładowanie…</p>;
  const rows = q.data ?? [];
  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">Wszystkie materiały przygotowane przez AI. Kliknij „Otwórz”, aby przeczytać, zlecić poprawki i zatwierdzić.</p>
      {!rows.length && <p className="text-sm text-muted-foreground">Brak materiałów w pracy.</p>}
      {rows.length > 0 && <div className="overflow-x-auto"><table className="w-full text-left text-sm">
        <thead className="text-xs uppercase text-muted-foreground"><tr><th className="p-2">Materiał</th><th className="p-2">Etap</th><th className="p-2">Wymaga uwagi</th><th className="p-2">Ostatnia zmiana</th><th className="p-2">Akcje</th></tr></thead>
        <tbody>{rows.map((m: any) => <tr key={m.id} className="border-t border-border/60 align-top">
          <td className="p-2"><span className="font-medium">{m.title}</span><span className="block text-xs text-muted-foreground">{m.format} · źródła: {m.sourceCount}</span></td>
          <td className="p-2">{stageOf(m).label}</td>
          <td className="p-2 text-xs">{[m.imagesPending ? `obrazy do decyzji: ${m.imagesPending}` : "", m.notes ? `uwagi redakcyjne: ${m.notes}` : ""].filter(Boolean).join(" · ") || "—"}</td>
          <td className="p-2">{fmt(m.updated_at)}</td>
          <td className="p-2"><div className="flex flex-wrap gap-1">
            <Button size="sm" onClick={() => setOpenId(m.id)}>Otwórz</Button>
            {!m.handoff_id && !["rejected", "archived"].includes(m.status) && <Button size="sm" variant="outline" onClick={async () => { if (!confirm("Odrzucić materiał? Treść i wersje zostaną zachowane.")) return; const r: any = await fix(status({ data: { id: m.id, status: "rejected" } })); r.ok ? q.refetch() : toast.error(r.error); }}>Odrzuć</Button>}
          </div></td></tr>)}</tbody>
      </table></div>}
    </div>
  );
}

function Marked({ text }: { text: string }) {
  const parts = text.split(new RegExp(`(\\[(?:${CONTRIB}|${VERIFY})[^\\]]*\\])`, "g"));
  return <>{parts.map((p, i) => p.startsWith(`[${CONTRIB}`) || p.startsWith(`[${VERIFY}`) ? <mark key={i} className="bg-destructive/25 px-1 text-foreground">{p}</mark> : <span key={i}>{p}</span>)}</>;
}

const WORKFLOW = ["Temat", "Źródła", "Tworzenie", "Obrazy", "SEO", "Przegląd", "Poprawki", "Zatwierdzenie", "Artykuł", "Newsletter"];

// ---------- Editor: review, fixes, images, preview, approval ----------
function Editor({ id, aiOn, close }: { id: string; aiOn: boolean; close: () => void }) {
  const get = useServerFn(getMaterial), save = useServerFn(saveMaterial), frag = useServerFn(aiEditFragment), whole = useServerFn(aiEditWhole),
    restore = useServerFn(restoreMaterialVersion), approve = useServerFn(approveAndHandoff), urls = useServerFn(materialImageUrls);
  const q = useQuery({ queryKey: ["ai-ed", "material", id], queryFn: () => get({ data: { id } }) });
  const iq = useQuery({ queryKey: ImgKey(id), queryFn: () => urls({ data: { id } }), staleTime: 30 * 60 * 1000 });
  const cats = useQuery(articleCategoriesQuery());
  const [meta, setMeta] = useState<ArticleMeta>({});
  const [title, setTitle] = useState(""), [subtitle, setSubtitle] = useState(""), [secs, setSecs] = useState<MaterialSection[]>([]), [dirty, setDirty] = useState(false);
  const [sel, setSel] = useState<{ sectionId: string; text: string } | null>(null), [instr, setInstr] = useState(""), [wInstr, setWInstr] = useState("");
  const [busy, setBusy] = useState<string | null>(null), [report, setReport] = useState(""), [view, setView] = useState<string | null>(null), [cmp, setCmp] = useState<string | null>(null);
  const [preview, setPreview] = useState(false), [author, setAuthor] = useState("Sebastian Snopek"), [customAuthor, setCustomAuthor] = useState(""), [handed, setHanded] = useState<any>(null);
  const aiRef = useRef<HTMLDivElement>(null);
  const m: any = q.data?.material, versions: any[] = q.data?.versions ?? [];
  useEffect(() => { if (m) { setTitle(m.title); setSubtitle(m.subtitle); setSecs(m.sections ?? []); setMeta(m.meta ?? {}); setDirty(false); } }, [m]);
  if (q.isLoading) return <p className="text-muted-foreground">Ładowanie…</p>;
  if (q.error || !m) return <p className="text-destructive">{errMsg(q.error)}</p>;
  const refresh = async () => { await Promise.all([q.refetch(), iq.refetch()]); };
  const edit = (i: number, patch: Partial<MaterialSection>) => { setSecs((s) => s.map((x, j) => (j === i ? { ...x, ...patch } : x))); setDirty(true); };
  const move = (i: number, d: number) => { setSecs((s) => { const n = [...s]; const t = n[i + d]; if (!t) return s; n[i + d] = n[i]!; n[i] = t; return n; }); setDirty(true); };
  const done = async (r: any, msg: string) => { if (!r.ok) { toast.error(r.error); return false; } toast.success(msg); await refresh(); return true; };
  const isArt = handoffTarget(m.format) === "article";
  const { notes: _n, images: _i, usage: _u, ...editableMeta } = meta as any;
  const doSave = async (note = "") => { setBusy("save"); const r = await fix(save({ data: { id, title, subtitle, sections: secs, note, meta: { ...editableMeta, notes: meta.notes ?? [] } } })); setBusy(null); return done(r, "Zapisano nową wersję"); };
  const pick = (t: HTMLTextAreaElement, sectionId: string) => { const text = t.value.slice(t.selectionStart, t.selectionEnd); if (text || sel?.sectionId !== sectionId) setSel({ sectionId, text }); };
  const locked = !!m.handoff_id;
  const sm = (patch: Partial<ArticleMeta>) => { setMeta((o) => ({ ...o, ...patch })); setDirty(true); };
  const snap = (vid: string | null) => versions.find((v) => v.id === vid)?.snapshot;
  const images = (m.meta?.images ?? []) as MaterialImage[];
  const imgUrl = (f: string | null) => (f ? iq.data?.[f] : undefined);
  const stage = stageOf(m);
  const reached = locked ? (m.status === "published" ? 10 : 9) : stage.key === "ready" ? 8 : stage.key === "fix" ? 7 : stage.key === "review" ? 6 : 3;
  const pending = images.filter((x) => x.status !== "accepted");
  const legacy = secs.filter((s) => s.body.includes(CONTRIB) || s.body.includes(VERIFY));
  const finalAuthor = author === "__custom" ? customAuthor.trim() : author;

  if (preview) {
    const sections: PageSection[] = [];
    for (const s of secs) {
      sections.push({ ...newSection("text"), heading: s.heading, body: s.body });
      for (const img of images.filter((x) => x.placement === "inline" && x.after_section_id === s.id && x.file)) sections.push({ ...newSection("image"), image: img.file, imageAlt: img.alt });
    }
    const cover = images.find((x) => x.placement === "cover" && x.file);
    const catName = (cats.data ?? []).find((c) => c.slug === meta.category)?.name ?? null;
    return <div className="fixed inset-0 z-50 overflow-auto bg-background">
      <div className="sticky top-0 z-10 flex flex-wrap items-center justify-between gap-2 border-b border-border bg-background/95 px-4 py-2 text-sm">
        <span>Podgląd materiału tak, jak będzie wyglądał na stronie {pending.length ? `· obrazy niezaakceptowane (${pending.length}) też są widoczne w podglądzie` : ""}</span>
        <Button size="sm" onClick={() => setPreview(false)}>Zamknij podgląd</Button></div>
      <ArticleView preview title={title} excerpt={meta.lead || subtitle} category={catName} author={finalAuthor || "—"} publishedAt={null}
        minutes={Math.max(1, Math.round(secs.reduce((a, s) => a + s.body.split(/\s+/).length, 0) / 200))} cover={imgUrl(cover?.file ?? null)} coverAlt={cover?.alt ?? ""}
        sections={sections} imageSrc={(f) => imgUrl(f)}
        after={(meta.reflection_question || meta.cta) ? <div className="mx-auto max-w-3xl space-y-4 px-5 pb-12">{meta.reflection_question && <div className="border-l-2 border-gold pl-4"><p className="eyebrow text-gold">Pytanie do refleksji</p><p className="mt-2 text-lg">{meta.reflection_question}</p></div>}{meta.cta && <p className="text-muted-foreground">CTA (zapisane w pochodzeniu artykułu): {meta.cta}</p>}</div> : undefined} />
    </div>;
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Button size="sm" variant="outline" onClick={() => { if (dirty && !confirm("Masz niezapisane zmiany. Wyjść bez zapisu?")) return; close(); }}>← Materiały w pracy</Button>
        <div className="flex flex-wrap items-center gap-2 text-sm"><span className="text-muted-foreground">{m.format}</span><span className="border border-gold/60 px-2 py-0.5 text-xs uppercase text-gold">{stage.label}</span>
          <Button size="sm" variant="outline" onClick={() => setPreview(true)}>PODGLĄD ARTYKUŁU</Button></div>
      </div>
      <ol className="flex flex-wrap gap-1 text-[0.7rem] uppercase tracking-wide">{WORKFLOW.map((w, i) => <li key={w} className={`border px-2 py-1 ${i + 1 < reached ? "border-gold/40 text-gold" : i + 1 === reached ? "border-gold bg-gold/15 text-foreground" : "border-border/60 text-muted-foreground"}`}>{i + 1 < reached ? "✓ " : ""}{w}</li>)}</ol>
      <p className="text-sm text-muted-foreground">{locked ? "Materiał jest w module Artykuły — tam wykonujesz ostateczną kontrolę i publikację." : pending.length ? `Następny krok: zdecyduj o obrazach (${pending.length}), przeczytaj tekst i zleć ewentualne poprawki, potem kliknij „ZATWIERDŹ I PRZEKAŻ”.` : "Następny krok: przeczytaj tekst (najlepiej w podglądzie), zleć ewentualne poprawki, potem kliknij „ZATWIERDŹ I PRZEKAŻ”."}</p>

      {(m.duplicates ?? []).length > 0 && <div className="border-l-2 border-destructive pl-3 text-sm"><p className="font-semibold text-destructive">UWAGA — PODOBNY MATERIAŁ ISTNIEJE</p><ul>{m.duplicates.map((d: any) => <li key={d.id}>{d.kind}: {d.title} ({d.score}%)</li>)}</ul></div>}
      {legacy.length > 0 && <div className="border-l-2 border-destructive pl-3 text-sm"><p className="text-xs uppercase text-destructive">Starsza wersja zawiera oznaczenia w treści</p><p>Sekcje: {legacy.map((s) => s.heading || "(bez nagłówka)").join(", ")} — usuń je lub poleć AI „Napisz ten fragment od nowa”.</p></div>}

      <section className={`${box} border-gold/50`}>
        <h3 className="font-semibold">UWAGI REDAKCYJNE <span className="text-xs font-normal text-muted-foreground">— tylko dla Ciebie, nigdy nie są publikowane</span></h3>
        {(meta.notes ?? []).length ? <ul className="mt-2 space-y-1 text-sm">{(meta.notes ?? []).map((n, i) => <li key={i} className="flex items-start justify-between gap-2"><span>• {n}</span>{!locked && <button className="text-xs text-muted-foreground underline" onClick={() => sm({ notes: (meta.notes ?? []).filter((_, j) => j !== i) })}>usuń</button>}</li>)}</ul> : <p className="mt-1 text-sm text-muted-foreground">Brak uwag.</p>}
      </section>

      <section className={box}>
        <label className="block text-xs">Tytuł<input className={input} value={title} disabled={locked} onChange={(e) => { setTitle(e.target.value); setDirty(true); }} /></label>
        <label className="mt-2 block text-xs">Podtytuł (opcjonalnie)<textarea className={input} rows={2} value={subtitle} disabled={locked} onChange={(e) => { setSubtitle(e.target.value); setDirty(true); }} /></label>
        {isArt && <label className="mt-2 block text-xs">Lead / wprowadzenie<textarea className={input} rows={3} maxLength={600} value={meta.lead ?? ""} disabled={locked} onChange={(e) => sm({ lead: e.target.value })} /></label>}
      </section>

      {isArt && <ImagesPanel id={id} images={images} secs={secs} urls={iq.data ?? {}} locked={locked} aiOn={aiOn} refresh={refresh} />}

      {isArt && <section className={box}>
        <h3 className="font-semibold">SEO i dane artykułu</h3>
        <div className="grid gap-2 sm:grid-cols-2">
          <label className="block text-xs">Meta title ({(meta.meta_title ?? "").length}/70)<input className={input} maxLength={70} value={meta.meta_title ?? ""} disabled={locked} onChange={(e) => sm({ meta_title: e.target.value })} /></label>
          <label className="block text-xs">Adres URL: /artykuly/<input className={input} maxLength={80} value={meta.slug ?? ""} disabled={locked} onChange={(e) => sm({ slug: e.target.value })} /></label>
          <label className="block text-xs sm:col-span-2">Meta description ({(meta.meta_description ?? "").length}/170)<textarea className={input} rows={2} maxLength={170} value={meta.meta_description ?? ""} disabled={locked} onChange={(e) => sm({ meta_description: e.target.value })} /></label>
          <label className="block text-xs">Kategoria<select className={input} value={meta.category ?? ""} disabled={locked} onChange={(e) => sm({ category: e.target.value })}><option value="">— bez kategorii —</option>{(cats.data ?? []).map((c) => <option key={c.slug} value={c.slug}>{c.name}</option>)}</select></label>
          <label className="block text-xs">Tagi (po przecinku)<input className={input} value={(meta.tags ?? []).join(", ")} disabled={locked} onChange={(e) => sm({ tags: e.target.value.split(",").map((t) => t.trim()).filter(Boolean).slice(0, 12) })} /></label>
          <label className="block text-xs sm:col-span-2">Pytanie do refleksji<input className={input} maxLength={400} value={meta.reflection_question ?? ""} disabled={locked} onChange={(e) => sm({ reflection_question: e.target.value })} /></label>
          <label className="block text-xs sm:col-span-2">CTA<input className={input} maxLength={400} value={meta.cta ?? ""} disabled={locked} onChange={(e) => sm({ cta: e.target.value })} /></label>
        </div>
      </section>}

      {secs.map((s, i) => (
        <section key={s.id} id={`sec-${s.id}`} className={`${box} ${sel?.sectionId === s.id ? "border-gold" : ""}`}>
          <div className="flex flex-wrap items-center gap-2">
            <input className="flex-1 border border-border bg-background px-3 py-2 text-sm font-semibold" value={s.heading} disabled={locked} placeholder="Śródtytuł" onChange={(e) => edit(i, { heading: e.target.value })} />
            <Button size="sm" variant="outline" disabled={locked || i === 0} onClick={() => move(i, -1)} aria-label="W górę">↑</Button>
            <Button size="sm" variant="outline" disabled={locked || i === secs.length - 1} onClick={() => move(i, 1)} aria-label="W dół">↓</Button>
            <Button size="sm" variant="outline" disabled={locked} onClick={() => { if (confirm("Usunąć sekcję? (poprzednia treść zostaje w historii wersji)")) { setSecs((x) => x.filter((_, j) => j !== i)); setDirty(true); } }}>Usuń</Button>
          </div>
          <textarea className={`${input} font-[inherit]`} rows={Math.min(24, Math.max(5, Math.ceil(s.body.length / 90)))} value={s.body} disabled={locked}
            onChange={(e) => edit(i, { body: e.target.value })} onSelect={(e) => pick(e.currentTarget, s.id)} onMouseUp={(e) => pick(e.currentTarget, s.id)} onKeyUp={(e) => pick(e.currentTarget, s.id)} />
          {images.filter((x) => x.after_section_id === s.id).map((x) => <p key={x.id} className="mt-1 text-xs text-gold">▣ Po tej sekcji: obraz wewnętrzny ({x.status === "accepted" ? "zaakceptowany" : "do decyzji"})</p>)}
          <p className="mt-1 text-xs text-muted-foreground">Źródła sekcji: {s.refs?.length ? s.refs.join("; ") : "—"}</p>
          {!locked && <div className="mt-2 flex flex-wrap gap-2">
            <Button size="sm" variant="outline" onClick={() => { setSecs((x) => [...x.slice(0, i + 1), { id: rid(), heading: "", body: "", refs: [] }, ...x.slice(i + 1)]); setDirty(true); }}>+ Sekcja poniżej</Button>
            <Button size="sm" variant="outline" disabled={!aiOn} onClick={() => { setSel({ sectionId: s.id, text: sel?.sectionId === s.id ? sel.text : "" }); aiRef.current?.scrollIntoView({ behavior: "smooth" }); }}>Polecenie AI dla tej sekcji</Button>
          </div>}
        </section>
      ))}
      {!locked && <div className="flex flex-wrap gap-2">
        <Button size="sm" variant="outline" onClick={() => { setSecs((x) => [...x, { id: rid(), heading: "", body: "", refs: [] }]); setDirty(true); }}>+ Dodaj sekcję</Button>
        <Button size="sm" disabled={!dirty || busy === "save"} onClick={() => doSave()}>{busy === "save" ? "Zapisywanie…" : "Zapisz zmiany"}</Button>
        {dirty && <span className="self-center text-xs text-gold">Niezapisane zmiany</span>}
      </div>}

      {!locked && <section ref={aiRef} className={box}>
        <h3 className="font-semibold">POPRAWKI — polecenie AI dla fragmentu</h3>
        <p className="text-xs text-muted-foreground">{sel ? `Sekcja: „${secs.find((s) => s.id === sel.sectionId)?.heading || "bez nagłówka"}” — ${sel.text ? `zaznaczono ${sel.text.length} znaków` : "brak zaznaczenia: zmiana obejmie całą sekcję"}` : "Zaznacz fragment tekstu w dowolnej sekcji (lub kliknij „Polecenie AI dla tej sekcji”)."} Każda zmiana AI zapisuje nową wersję; poprzednia zostaje w historii.</p>
        <div className="mt-2 flex flex-wrap gap-1">{FRAG_CMDS.map((c) => <Button key={c} size="sm" variant={instr === c ? "default" : "outline"} onClick={() => setInstr(c)}>{c}</Button>)}</div>
        <textarea className={input} rows={2} placeholder="Własne polecenie" value={instr} onChange={(e) => setInstr(e.target.value)} />
        <Button className="mt-2" size="sm" disabled={!aiOn || !sel || instr.trim().length < 2 || !!busy || dirty} onClick={async () => {
          setBusy("frag"); const r: any = await fix(frag({ data: { id, sectionId: sel!.sectionId, selection: sel!.text, instruction: instr } })); setBusy(null);
          if (await done(r, `AI zmieniło fragment — nowa wersja (zużycie: ${tok(r.usage)})`)) setSel(null);
        }}>{busy === "frag" ? "AI poprawia fragment…" : "Wykonaj (1 wywołanie AI)"}</Button>
        {dirty && <p className="mt-1 text-xs text-gold">Najpierw zapisz swoje zmiany, aby AI pracowało na aktualnej wersji.</p>}

        <h3 className="mt-6 font-semibold">Polecenie dla całego materiału</h3>
        <div className="mt-2 flex flex-wrap gap-1">{WHOLE_CMDS.map((c) => <Button key={c} size="sm" variant={wInstr === c ? "default" : "outline"} onClick={() => setWInstr(c)}>{c}</Button>)}</div>
        <textarea className={input} rows={2} value={wInstr} onChange={(e) => setWInstr(e.target.value)} placeholder="Własne polecenie dla całości" />
        <p className="mt-1 text-xs text-muted-foreground">AI otrzyma cały tekst i pełne źródła. Koszt zostanie określony po wykonaniu operacji.</p>
        <Button className="mt-2" size="sm" disabled={!aiOn || wInstr.trim().length < 2 || dirty || !!busy} onClick={async () => { setBusy("whole"); const r: any = await fix(whole({ data: { id, instruction: wInstr, confirmed: true } })); setBusy(null); if (r.ok) setReport(`${r.report}\n\nZużycie: ${tok(r.usage)}`); await done(r, r.changed ? "Zastosowano zmiany — nowa wersja" : "Analiza gotowa (bez zmian w tekście)"); }}>{busy === "whole" ? "AI pracuje nad całością…" : "Wykonaj dla całości"}</Button>
        {report && <div className="mt-3 border-l-2 border-gold pl-3 text-sm"><p className="text-xs uppercase text-gold">Informacja o zmianie</p><p className="whitespace-pre-wrap">{report}</p></div>}
      </section>}

      <section className={box}><SourcesList sources={m.sources ?? []} title="ŹRÓDŁA WYKORZYSTANE DO TEGO ARTYKUŁU" />
        <p className="mt-2 text-xs text-muted-foreground">Łączne rzeczywiste zużycie AI dla materiału: {tok(meta.usage)}{meta.usage ? ` · wywołań tekstowych: ${meta.usage.calls} · obrazów: ${meta.usage.images}` : ""}</p></section>

      <section className={box}>
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

      <section className={`${box} border-gold/60`}>
        <h3 className="font-semibold">ZATWIERDZENIE</h3>
        {locked || handed ? <div className="mt-2 space-y-2 text-sm"><p className="font-semibold text-gold">{isArt ? "ARTYKUŁ PRZEKAZANY DO MODUŁU ARTYKUŁY" : "MATERIAŁ PRZEKAZANY DO MODUŁU GŁOS TNB"}</p>
          <p>Szkic z {fmt(m.handoff_at)}{handed ? ` · przekazane obrazy: ${handed.images}` : ""}. Publikujesz go tam ręcznie; newsletter możesz dodać po publikacji.</p>
          <Button asChild size="sm"><Link to={HANDOFF_PATH[(m.handoff_kind ?? handed?.kind) as keyof typeof HANDOFF_PATH]}>OTWÓRZ W {isArt ? "ARTYKUŁACH" : "GŁOSIE TNB"}</Link></Button></div> : <>
          <p className="mt-1 text-sm text-muted-foreground">Jedno kliknięcie: sprawdzenie kompletności → zapis wersji zatwierdzonej → szkic w module {HANDOFF_LABEL[handoffTarget(m.format)]}{isArt ? " z obrazem głównym, obrazami wewnętrznymi, alt i SEO" : ""}. AI nie publikuje.</p>
          {isArt && <div className="mt-2 grid gap-2 sm:grid-cols-2"><label className="block text-xs">AUTOR<select className={input} value={author} onChange={(e) => setAuthor(e.target.value)}>{(q.data?.authors ?? ["Sebastian Snopek"]).map((a: string) => <option key={a}>{a}</option>)}<option value="__custom">Inny autor…</option></select></label>
            {author === "__custom" && <label className="block text-xs">Imię i nazwisko autora<input className={input} maxLength={120} value={customAuthor} onChange={(e) => setCustomAuthor(e.target.value)} /></label>}</div>}
          {pending.length > 0 && <p className="mt-2 text-sm text-gold">Najpierw zdecyduj o obrazach: {pending.length} czeka na akceptację lub usunięcie.</p>}
          {(meta.notes ?? []).length > 0 && <p className="mt-1 text-xs text-muted-foreground">Uwagi redakcyjne ({(meta.notes ?? []).length}) nie blokują zatwierdzenia — nie trafiają do artykułu.</p>}
          <div className="mt-3 flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => setPreview(true)}>Podgląd przed zatwierdzeniem</Button>
            <Button disabled={dirty || busy === "approve" || pending.length > 0 || (isArt && finalAuthor.length < 2)} onClick={async () => {
              if (!confirm(`Zatwierdzić i przekazać jako szkic do modułu ${HANDOFF_LABEL[handoffTarget(m.format)]}?${isArt ? ` Autor: ${finalAuthor}.` : ""}`)) return;
              setBusy("approve"); const r: any = await fix(approve({ data: { id, author: isArt ? finalAuthor : "Sebastian Snopek" } })); setBusy(null);
              if (r.ok) setHanded(r); await done(r, "Przekazano jako szkic");
            }}>{busy === "approve" ? "Przekazuję…" : `ZATWIERDŹ I PRZEKAŻ DO ${isArt ? "ARTYKUŁÓW" : "GŁOSU TNB"}`}</Button>
          </div>
          {dirty && <p className="mt-1 text-xs text-gold">Zapisz zmiany przed zatwierdzeniem.</p>}
        </>}
      </section>
    </div>
  );
}

function ImagesPanel({ id, images, secs, urls, locked, aiOn, refresh }: { id: string; images: MaterialImage[]; secs: MaterialSection[]; urls: Record<string, string>; locked: boolean; aiOn: boolean; refresh: () => Promise<void> }) {
  const gen = useServerFn(generateMaterialImage), upd = useServerFn(updateMaterialImage);
  const [busy, setBusy] = useState<string | null>(null), [edit, setEdit] = useState<{ id: string; text: string } | null>(null);
  const act = async (key: string, p: Promise<any>, msg: string) => { setBusy(key); const r: any = await fix(p); setBusy(null); if (!r.ok) { toast.error(r.error); return; } toast.success(msg); await refresh(); };
  const one = (img: MaterialImage) => {
    const url = img.file ? urls[img.file] : undefined; const k = busy?.startsWith(img.id);
    return <div key={img.id} className="space-y-2 border border-border/60 p-3">
      <p className="text-xs uppercase tracking-widest text-gold">{img.placement === "cover" ? "OBRAZ GŁÓWNY" : `OBRAZ WEWNĘTRZNY — po sekcji „${secs.find((s) => s.id === img.after_section_id)?.heading || "?"}”`} · {img.status === "accepted" ? "zaakceptowany" : img.file ? "do decyzji" : "jeszcze nie wygenerowany"} · wygenerowany przez AI</p>
      {url ? <img src={url} alt={img.alt} className={`w-full border border-border/60 object-cover ${img.placement === "cover" ? "aspect-[3/2]" : "aspect-[3/2] max-w-md"}`} /> : <div className="flex aspect-[3/2] max-w-md items-center justify-center border border-dashed border-border text-sm text-muted-foreground">{k ? "AI generuje obraz… (zwykle kilkadziesiąt sekund)" : "Brak obrazu"}</div>}
      <p className="text-sm"><span className="text-xs uppercase text-muted-foreground">Dlaczego ten obraz? </span>{img.why || "—"}</p>
      <label className="block text-xs">Alt (opis dla niewidomych i wyszukiwarek)<input className={input} maxLength={200} defaultValue={img.alt} disabled={locked} onBlur={(e) => { if (e.target.value !== img.alt) act(`${img.id}-alt`, upd({ data: { id, imageId: img.id, action: "alt", alt: e.target.value } }), "Zapisano alt"); }} /></label>
      {img.placement === "inline" && !locked && <label className="block text-xs">ZMIANA MIEJSCA — po sekcji<select className={input} value={img.after_section_id ?? ""} onChange={(e) => act(`${img.id}-mv`, upd({ data: { id, imageId: img.id, action: "move", afterSectionId: e.target.value } }), "Przeniesiono obraz")}>{secs.map((s, i) => <option key={s.id} value={s.id}>{i + 1}. {s.heading || "(bez nagłówka)"}</option>)}</select></label>}
      {edit?.id === img.id && <div><label className="block text-xs">Polecenie dla obrazu<textarea className={input} rows={3} maxLength={800} value={edit.text} onChange={(e) => setEdit({ id: img.id, text: e.target.value })} /></label>
        <div className="mt-1 flex gap-2"><Button size="sm" disabled={!!busy || edit.text.trim().length < 5} onClick={async () => { await act(`${img.id}-gen`, gen({ data: { id, imageId: img.id, description: edit.text } }), "Wygenerowano nowy obraz"); setEdit(null); }}>Generuj z nowym poleceniem</Button><Button size="sm" variant="outline" onClick={() => setEdit(null)}>Anuluj</Button></div></div>}
      {!locked && <div className="flex flex-wrap gap-2">
        {img.file && img.status !== "accepted" && <Button size="sm" disabled={!!busy} onClick={() => act(`${img.id}-ok`, upd({ data: { id, imageId: img.id, action: "accept" } }), "Zaakceptowano obraz")}>AKCEPTUJ</Button>}
        <Button size="sm" variant="outline" disabled={!aiOn || !!busy} onClick={() => act(`${img.id}-gen`, gen({ data: { id, imageId: img.id } }), "Wygenerowano obraz")}>{k && busy?.endsWith("gen") ? "Generuję…" : img.file ? "WYGENERUJ INNY" : "WYGENERUJ"}</Button>
        <Button size="sm" variant="outline" disabled={!!busy} onClick={() => setEdit({ id: img.id, text: img.description })}>ZMIEŃ POLECENIE</Button>
        <Button size="sm" variant="outline" disabled={!!busy} onClick={() => { if (confirm("Usunąć ten obraz?")) act(`${img.id}-del`, upd({ data: { id, imageId: img.id, action: "delete" } }), "Usunięto obraz"); }}>USUŃ</Button>
      </div>}
    </div>;
  };
  return <section className={box}>
    <h3 className="font-semibold">OBRAZY</h3>
    <p className="text-xs text-muted-foreground">Styl TNB: realistyczna, filmowa fotografia, naturalne światło, bez tekstu i bez logo. Do artykułu trafią tylko obrazy zaakceptowane. Każde generowanie to osobne wywołanie AI.</p>
    <div className="mt-3 space-y-3">{images.map(one)}</div>
    {!locked && <Button className="mt-3" size="sm" variant="outline" disabled={!!busy} onClick={() => act("add", upd({ data: { id, imageId: null, action: "add", afterSectionId: secs[0]?.id ?? null } }), images.some((x) => x.placement === "cover") ? "Dodano miejsce na obraz wewnętrzny — wygeneruj go" : "Dodano obraz główny — wygeneruj go")}>{images.some((x) => x.placement === "cover") ? "+ Obraz wewnętrzny" : "+ Obraz główny"}</Button>}
  </section>;
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
