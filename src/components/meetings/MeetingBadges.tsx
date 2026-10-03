import { badges, type PublicMeeting } from "@/lib/meetings";

const TONE = {
  gold: "border-gold/60 text-gold",
  muted: "border-border text-muted-foreground",
  danger: "border-destructive/70 text-destructive",
} as const;

export function MeetingBadges({ m }: { m: PublicMeeting }) {
  return (
    <div className="flex flex-wrap gap-2">
      {badges(m).map((b) => (
        <span key={b.label} className={`border px-2 py-0.5 text-[0.64rem] font-medium uppercase tracking-[0.14em] ${TONE[b.tone]}`}>{b.label}</span>
      ))}
    </div>
  );
}
