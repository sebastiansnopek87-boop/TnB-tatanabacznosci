import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listMyRegistrations } from "@/lib/meetings.functions";
import { MEETING_KINDS, fmtWhen, type MeetingKind } from "@/lib/meetings";
import { MyRegBox } from "./MyRegBox";

/** Moje TNB — webinars and LIVE meetings the user signed up for, split into upcoming / ended / cancelled. */
export function MyEvents() {
  const fn = useServerFn(listMyRegistrations);
  const q = useQuery({ queryKey: ["my-meeting-regs"], queryFn: () => fn() });
  if (q.isLoading) return <p className="text-sm text-muted-foreground">Ładowanie…</p>;
  if (q.error) return <p className="text-sm text-destructive">Nie udało się wczytać wydarzeń.</p>;
  const rows = q.data ?? [];
  const cancelled = rows.filter((r) => r.status === "cancelled" || r.status === "rejected");
  const ended = rows.filter((r) => r.ended && !cancelled.includes(r)).reverse();
  const upcoming = rows.filter((r) => !r.ended && !cancelled.includes(r));
  const group = (title: string, list: typeof rows, empty: React.ReactNode) => (
    <div>
      <h3 className="text-xs uppercase tracking-[0.14em] text-muted-foreground">{title}</h3>
      {!list.length ? <p className="mt-2 text-sm text-muted-foreground">{empty}</p> : (
        <ul className="mt-3 space-y-4">
          {list.map((r) => (
            <li key={r.id} className="border border-border/60 p-4" data-testid="my-event">
              <p className="text-xs uppercase tracking-[0.12em] text-gold">{MEETING_KINDS[r.kind as MeetingKind]}</p>
              <p className="mt-1 break-words font-medium text-foreground">{r.slug ? <Link to="/spotkania/$slug" params={{ slug: r.slug }} className="hover:text-gold">{r.title}</Link> : r.title}</p>
              <p className="mt-1 text-sm text-foreground/70">{fmtWhen(r.starts_at)}</p>
              {r.meetingCancelled && <p className="mt-1 text-sm text-destructive">Wydarzenie odwołane przez organizatora.</p>}
              <div className="mt-3 [&_h2]:hidden"><MyRegBox m={r} reg={r} onChange={() => q.refetch()} /></div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
  return (
    <div className="space-y-6">
      {group("Nadchodzące", upcoming, <>Nie masz zapisów na webinary ani spotkania LIVE. <Link to="/spotkania" className="text-gold underline">Zobacz spotkania</Link>.</>)}
      {group("Zakończone", ended, "Brak zakończonych wydarzeń.")}
      {group("Anulowane", cancelled, "Brak anulowanych zgłoszeń.")}
    </div>
  );
}
