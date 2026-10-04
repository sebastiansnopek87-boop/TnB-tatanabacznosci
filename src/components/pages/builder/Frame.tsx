import { useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";

// Renders the real page components inside an iframe so phone/tablet widths trigger the same
// responsive rules visitors get. Styles are cloned from the admin document.
const EDIT_CSS = `
[data-el]{cursor:pointer;transition:outline-color .1s}
[data-el]:hover{outline:1px dashed var(--color-gold);outline-offset:3px}
[data-on]{outline:2px solid var(--color-gold)!important;outline-offset:3px}
[data-sec]{position:relative}
[data-sec]:hover>section{outline:1px dashed color-mix(in oklab,var(--color-gold) 50%,transparent);outline-offset:-1px}
[data-sec-on]>section{outline:2px solid var(--color-gold)!important;outline-offset:-2px}
header a,footer a,header button,footer button{cursor:not-allowed}
`;

export function Frame({ width, children, onOverflow }: { width: number | null; children: ReactNode; onOverflow: (idx: number[]) => void }) {
  const ref = useRef<HTMLIFrameElement>(null);
  const [body, setBody] = useState<HTMLElement | null>(null);
  useEffect(() => {
    const doc = ref.current?.contentDocument;
    if (!doc) return;
    doc.open(); doc.write("<!doctype html><html><head><meta name='viewport' content='width=device-width,initial-scale=1'></head><body></body></html>"); doc.close();
    document.querySelectorAll('link[rel="stylesheet"], style').forEach((n) => doc.head.appendChild(n.cloneNode(true)));
    const st = doc.createElement("style"); st.textContent = EDIT_CSS; doc.head.appendChild(st);
    doc.documentElement.className = document.documentElement.className;
    doc.body.className = document.body.className;
    setBody(doc.body);
  }, []);
  useEffect(() => {
    if (!body) return;
    const t = setInterval(() => {
      const bad: number[] = [];
      body.querySelectorAll<HTMLElement>("[data-sec]").forEach((el) => {
        const sec = el.firstElementChild as HTMLElement | null;
        if (sec && sec.scrollWidth > sec.clientWidth + 1) bad.push(Number(el.dataset.sec));
      });
      onOverflow(bad);
    }, 1500);
    return () => clearInterval(t);
  }, [body, onOverflow]);
  return (
    <>
    <iframe ref={ref} title="Podgląd strony w edytorze" className="h-full border-0 bg-background shadow-2xl transition-[width]" style={{ width: width ? `${width}px` : "100%" }} />
    {body && createPortal(children, body)}
    </>
  );
}
