import { useEffect, useRef, useState } from "react";
import { Pause, Play, Volume2, VolumeX } from "lucide-react";
import { fmtDuration } from "@/lib/podcast";

export function AudioPlayer({ src, title, onError }: { src: string; title: string; onError?: () => void }) {
  const ref = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [time, setTime] = useState(0);
  const [dur, setDur] = useState(0);
  const [vol, setVol] = useState(1);
  const [muted, setMuted] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => { setFailed(false); setPlaying(false); setTime(0); }, [src]);
  useEffect(() => { if (ref.current) { ref.current.volume = vol; ref.current.muted = muted; } }, [vol, muted]);

  const toggle = async () => {
    const a = ref.current; if (!a) return;
    if (a.paused) { try { await a.play(); } catch { /* handled by onError */ } } else a.pause();
  };

  return (
    <div className="border border-gold/40 bg-surface-deep p-4 sm:p-5" aria-label={`Odtwarzacz: ${title}`}>
      <audio
        ref={ref} src={src} preload="metadata"
        onPlay={() => setPlaying(true)} onPause={() => setPlaying(false)} onEnded={() => setPlaying(false)}
        onTimeUpdate={(e) => setTime(e.currentTarget.currentTime)}
        onLoadedMetadata={(e) => setDur(isFinite(e.currentTarget.duration) ? e.currentTarget.duration : 0)}
        onError={() => { setFailed(true); onError?.(); }}
      />
      <div className="flex items-center gap-4">
        <button type="button" onClick={toggle} disabled={failed} aria-label={playing ? "Pauza" : "Odtwórz"}
          className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-gold text-primary-foreground hover:bg-gold-bright disabled:opacity-40">
          {playing ? <Pause className="h-5 w-5" /> : <Play className="ml-0.5 h-5 w-5" />}
        </button>
        <div className="min-w-0 flex-1">
          <input type="range" min={0} max={dur || 0} step={1} value={Math.min(time, dur || 0)} disabled={!dur}
            onChange={(e) => { const a = ref.current; if (a) { a.currentTime = Number(e.target.value); setTime(a.currentTime); } }}
            aria-label="Przewiń nagranie" className="w-full accent-[var(--color-gold)]" />
          <div className="mt-1 flex justify-between text-xs tabular-nums text-muted-foreground">
            <span>{fmtDuration(time) ?? "0:00"}</span><span>{fmtDuration(dur) ?? "--:--"}</span>
          </div>
        </div>
        <div className="hidden items-center gap-2 sm:flex">
          <button type="button" onClick={() => setMuted((m) => !m)} aria-label={muted ? "Włącz dźwięk" : "Wycisz"} className="text-foreground/80 hover:text-gold">
            {muted || vol === 0 ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
          </button>
          <input type="range" min={0} max={1} step={0.05} value={muted ? 0 : vol}
            onChange={(e) => { setVol(Number(e.target.value)); setMuted(false); }} aria-label="Głośność" className="w-24 accent-[var(--color-gold)]" />
        </div>
      </div>
      <div className="mt-3 flex items-center gap-2 sm:hidden">
        <button type="button" onClick={() => setMuted((m) => !m)} aria-label={muted ? "Włącz dźwięk" : "Wycisz"} className="text-foreground/80">
          {muted || vol === 0 ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
        </button>
        <input type="range" min={0} max={1} step={0.05} value={muted ? 0 : vol}
          onChange={(e) => { setVol(Number(e.target.value)); setMuted(false); }} aria-label="Głośność" className="w-full accent-[var(--color-gold)]" />
      </div>
      {failed && <p className="mt-3 text-sm text-destructive">Nie udało się odtworzyć nagrania. Spróbuj ponownie później.</p>}
    </div>
  );
}
