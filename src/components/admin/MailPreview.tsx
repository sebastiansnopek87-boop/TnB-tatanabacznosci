import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

type Mail = { subject: string; html: string; text: string };

// Sandboxed iframe: rendered e-mail HTML never runs scripts in the panel.
export function MailPreview({ mail }: { mail: Mail }) {
  const [view, setView] = useState<"html" | "text">("html");
  const [width, setWidth] = useState<"desktop" | "mobile">("desktop");
  return (
    <div className="space-y-3">
      <p className="text-sm"><span className="text-muted-foreground">Temat:</span> {mail.subject}</p>
      <div className="flex flex-wrap gap-2">
        <Button size="sm" variant={view === "html" ? "default" : "outline"} onClick={() => setView("html")}>HTML</Button>
        <Button size="sm" variant={view === "text" ? "default" : "outline"} onClick={() => setView("text")}>Wersja tekstowa</Button>
        {view === "html" && <>
          <Button size="sm" variant={width === "desktop" ? "default" : "outline"} onClick={() => setWidth("desktop")}>Komputer</Button>
          <Button size="sm" variant={width === "mobile" ? "default" : "outline"} onClick={() => setWidth("mobile")}>Telefon</Button>
        </>}
      </div>
      {view === "html"
        ? <iframe title="Podgląd wiadomości" sandbox="" srcDoc={mail.html} className="h-[480px] max-w-full border border-border/60 bg-white" style={{ width: width === "mobile" ? 375 : "100%" }} />
        : <pre className="max-h-[480px] overflow-auto whitespace-pre-wrap border border-border/60 p-4 text-sm">{mail.text}</pre>}
    </div>
  );
}

export function MailPreviewDialog({ value, onClose, title }: { value: Mail | null; onClose: () => void; title: string }) {
  return (
    <Dialog open={!!value} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-3xl">
        <DialogHeader><DialogTitle>{title}</DialogTitle></DialogHeader>
        {value && <MailPreview mail={value} />}
      </DialogContent>
    </Dialog>
  );
}
