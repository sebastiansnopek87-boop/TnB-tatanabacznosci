import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Eye, EyeOff } from "lucide-react";
import { toast } from "sonner";
import { adminSaveYoutubeKey, adminTestYoutubeKey } from "@/lib/voice.functions";
import { errMsg } from "@/components/admin/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type Result = { ok: true; text: string } | { ok: false; text: string } | null;

export function YoutubeKeyField({ masked, source, onChanged }: { masked?: string | undefined; source?: "panel" | "env" | null | undefined; onChanged: () => void }) {
  const saveFn = useServerFn(adminSaveYoutubeKey); const testFn = useServerFn(adminTestYoutubeKey);
  const [val, setVal] = useState(""); const [show, setShow] = useState(false); const [res, setRes] = useState<Result>(null);
  const save = useMutation({
    mutationFn: () => saveFn({ data: { key: val.trim() } }),
    onSuccess: (r) => {
      if (r.ok) { setVal(""); setShow(false); setRes({ ok: true, text: `Google zaakceptował klucz. Zapisano (${r.masked}).` }); toast.success("Klucz YouTube zapisany"); onChanged(); }
      else setRes({ ok: false, text: `Google odrzucił klucz — nie został zapisany. ${r.error}` });
    },
    onError: (e) => setRes({ ok: false, text: errMsg(e) }),
  });
  const test = useMutation({
    mutationFn: () => testFn(),
    onSuccess: (r) => setRes(r.ok ? { ok: true, text: "Połączenie działa — obecny klucz jest poprawny." } : { ok: false, text: r.error }),
    onError: (e) => setRes({ ok: false, text: errMsg(e) }),
  });

  return (
    <div className="mt-6 border border-border/60 p-4">
      <h3 className="font-display text-lg font-semibold uppercase">Klucz YouTube Data API v3</h3>
      <p className="mt-1 text-xs text-muted-foreground">
        Obecny klucz: <code>{masked || "brak"}</code>
        {source === "panel" ? " (zapisany w panelu)" : source === "env" ? " (z ustawień projektu)" : ""}.
        Pełna wartość nigdy nie jest wyświetlana. Nowy klucz jest najpierw sprawdzany w Google i zapisywany tylko, gdy działa.
      </p>
      <form onSubmit={(e) => { e.preventDefault(); setRes(null); save.mutate(); }} className="mt-3 space-y-2">
        <Label htmlFor="ytkey">Nowy klucz (zaczyna się od „AIza”)</Label>
        <div className="flex flex-col gap-2 sm:flex-row">
          <div className="relative flex-1">
            <Input id="ytkey" type={show ? "text" : "password"} autoComplete="off" spellCheck={false} value={val} onChange={(e) => setVal(e.target.value)} placeholder="AIza…" className="pr-10" />
            <button type="button" onClick={() => setShow((s) => !s)} aria-label={show ? "Ukryj klucz" : "Pokaż klucz"} className="absolute inset-y-0 right-0 flex w-10 items-center justify-center text-muted-foreground hover:text-foreground">
              {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
          <Button type="submit" disabled={save.isPending || val.trim().length < 20}>{save.isPending ? "Sprawdzanie…" : "Zapisz klucz i sprawdź"}</Button>
          <Button type="button" variant="outline" disabled={test.isPending || !masked} onClick={() => { setRes(null); test.mutate(); }}>{test.isPending ? "Sprawdzanie…" : "Sprawdź połączenie"}</Button>
        </div>
      </form>
      {res && <p className={`mt-2 break-words text-xs ${res.ok ? "text-gold" : "text-destructive"}`}>{res.text}</p>}
    </div>
  );
}
