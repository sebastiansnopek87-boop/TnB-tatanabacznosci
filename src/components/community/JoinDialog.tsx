import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";

export function JoinDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="border-gold/30 bg-card">
        <DialogHeader>
          <DialogTitle className="font-display text-2xl font-semibold uppercase">Dołącz do rozmowy</DialogTitle>
          <DialogDescription className="text-[0.95rem] leading-[1.75] text-foreground/80">
            Aby publikować wpisy, komentować i zabierać głos w społeczności Tata Na Baczności, musisz posiadać konto i być zalogowany.
          </DialogDescription>
        </DialogHeader>
        <div className="mt-2 flex flex-wrap gap-3">
          <Button asChild variant="outline" className="uppercase tracking-[0.15em]"><Link to="/auth">Zaloguj się</Link></Button>
          <Button asChild className="uppercase tracking-[0.15em]"><Link to="/auth" search={{ tryb: "rejestracja" }}>Dołącz do TNB</Link></Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/** Read-only field for guests: clicking or focusing it opens the join prompt; no text can be typed. */
export function GuestField({ placeholder, onOpen, rows = 3, id }: { placeholder: string; onOpen: () => void; rows?: number; id?: string }) {
  return (
    <Textarea id={id} readOnly rows={rows} placeholder={placeholder} value="" aria-haspopup="dialog"
      onMouseDown={(e) => { e.preventDefault(); onOpen(); }}
      onKeyDown={(e) => { if (e.key !== "Tab") { e.preventDefault(); onOpen(); } }}
      className="cursor-pointer bg-background/60" />
  );
}
