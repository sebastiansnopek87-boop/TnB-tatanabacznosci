import { useEffect, useRef, useState } from "react";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { TextStyle, FontFamily, FontSize, Color } from "@tiptap/extension-text-style";
import TextAlign from "@tiptap/extension-text-align";
import Highlight from "@tiptap/extension-highlight";
import Subscript from "@tiptap/extension-subscript";
import Superscript from "@tiptap/extension-superscript";
import { AlignLeft, AlignCenter, AlignRight, AlignJustify, Bold, Italic, Underline, Strikethrough, List, ListOrdered, Undo2, Redo2, RemoveFormatting, Link2, Subscript as SubIcon, Superscript as SuperIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { TEXT_FONTS, TEXT_COLORS, plainDoc, richPlainText, type RichNode, type TextFormat } from "@/lib/rich-text";

export function TextEditor({ value, format, label, onChange }: { value: string; format?: TextFormat; label: string; onChange: (plain: string, format?: TextFormat) => void }) {
  const latest = useRef({ onChange, format });
  latest.current = { onChange, format };
  const [, redraw] = useState(0);
  const [link, setLink] = useState("");
  const editor = useEditor({
    immediatelyRender: false,
    extensions: [StarterKit.configure({ heading: { levels: [1, 2, 3] }, link: { openOnClick: false } }), TextStyle, FontFamily, FontSize, Color, TextAlign.configure({ types: ["heading", "paragraph"] }), Highlight.configure({ multicolor: true }), Subscript, Superscript],
    content: format?.doc ?? plainDoc(value),
    editorProps: { attributes: { role: "textbox", "aria-label": label, "aria-multiline": "true", class: "cms-rich-text min-h-36 max-h-80 overflow-y-auto p-3 text-sm outline-none" } },
    onUpdate: ({ editor: e }) => { const doc = e.getJSON() as RichNode; latest.current.onChange(richPlainText(doc), { ...latest.current.format, doc }); },
    onTransaction: () => redraw(n => n + 1),
  });
  useEffect(() => {
    if (!editor) return;
    const doc = format?.doc ?? plainDoc(value);
    if (JSON.stringify(editor.getJSON()) !== JSON.stringify(doc)) editor.commands.setContent(doc, { emitUpdate: false });
  }, [editor, value, format?.doc]);
  if (!editor) return <div className="min-h-36 border border-border" />;
  const tool = (name: string, Icon: typeof Bold, action: () => void, active = false, disabled = false) => <Button key={name} type="button" size="icon" variant={active ? "secondary" : "ghost"} className="h-8 w-8 shrink-0" title={name} aria-label={name} aria-pressed={active} disabled={disabled} onMouseDown={e => e.preventDefault()} onClick={action}><Icon className="h-4 w-4" /></Button>;
  const sel = "h-8 min-w-0 border border-border bg-background px-1 text-xs";
  const setLayout = (patch: Partial<TextFormat>) => onChange(value, { ...format, doc: editor.getJSON() as RichNode, ...patch });
  return <div className="mb-4 min-w-0 space-y-2">
    <p className="text-xs uppercase text-muted-foreground">{label}</p>
    <div className="border border-border bg-background">
      <div role="toolbar" aria-label={`Formatowanie: ${label}`} className="flex flex-wrap items-center gap-1 border-b border-border p-1">
        <select aria-label="Czcionka" className={`${sel} max-w-40`} value={editor.getAttributes("textStyle")['fontFamily'] ?? ""} onChange={e => e.target.value ? editor.chain().focus().setFontFamily(e.target.value).run() : editor.chain().focus().unsetFontFamily().run()}><option value="">Czcionka domyślna</option>{TEXT_FONTS.map(f => <option key={f}>{f}</option>)}</select>
        <select aria-label="Rozmiar czcionki" className={sel} value={editor.getAttributes("textStyle")['fontSize'] ?? ""} onChange={e => e.target.value ? editor.chain().focus().setFontSize(e.target.value).run() : editor.chain().focus().unsetFontSize().run()}><option value="">Rozmiar</option>{[8,10,12,14,16,18,20,24,28,32,36,40,48,56,64,72,96].map(n => <option key={n} value={`${n}px`}>{n} px</option>)}</select>
        <select aria-label="Styl akapitu" className={sel} value={editor.isActive("heading") ? editor.getAttributes("heading")['level'] : 0} onChange={e => { const n = Number(e.target.value); if (n === 1 || n === 2 || n === 3) editor.chain().focus().setHeading({ level: n }).run(); else editor.chain().focus().setParagraph().run(); }}><option value={0}>Akapit</option><option value={1}>Nagłówek 1</option><option value={2}>Nagłówek 2</option><option value={3}>Nagłówek 3</option></select>
        {tool("Pogrubienie", Bold, () => editor.chain().focus().toggleBold().run(), editor.isActive("bold"))}
        {tool("Kursywa", Italic, () => editor.chain().focus().toggleItalic().run(), editor.isActive("italic"))}
        {tool("Podkreślenie", Underline, () => editor.chain().focus().toggleUnderline().run(), editor.isActive("underline"))}
        {tool("Przekreślenie", Strikethrough, () => editor.chain().focus().toggleStrike().run(), editor.isActive("strike"))}
        {tool("Indeks dolny", SubIcon, () => editor.chain().focus().toggleSubscript().run(), editor.isActive("subscript"))}
        {tool("Indeks górny", SuperIcon, () => editor.chain().focus().toggleSuperscript().run(), editor.isActive("superscript"))}
        {([['left', AlignLeft, 'Do lewej'], ['center', AlignCenter, 'Wyśrodkuj'], ['right', AlignRight, 'Do prawej'], ['justify', AlignJustify, 'Wyjustuj']] as const).map(([align, Icon, name]) => tool(name, Icon, () => editor.chain().focus().setTextAlign(align).run(), editor.isActive({ textAlign: align })))}
        {tool("Lista punktowana", List, () => editor.chain().focus().toggleBulletList().run(), editor.isActive("bulletList"))}
        {tool("Lista numerowana", ListOrdered, () => editor.chain().focus().toggleOrderedList().run(), editor.isActive("orderedList"))}
        {tool("Cofnij formatowanie", Undo2, () => editor.chain().focus().undo().run(), false, !editor.can().undo())}
        {tool("Ponów formatowanie", Redo2, () => editor.chain().focus().redo().run(), false, !editor.can().redo())}
        {tool("Wyczyść formatowanie", RemoveFormatting, () => { editor.chain().focus().clearNodes().unsetAllMarks().unsetTextAlign().run(); onChange(richPlainText(editor.getJSON() as RichNode)); })}
      </div>
      <div className="flex flex-wrap gap-2 border-b border-border p-2">
        <div className="flex items-center gap-1" aria-label="Kolor tekstu">{Object.entries(TEXT_COLORS).map(([name, color]) => <Button key={name} size="icon" variant="outline" className="h-6 w-6" title={`Kolor: ${name}`} aria-label={`Kolor: ${name}`} onMouseDown={e => e.preventDefault()} onClick={() => editor.chain().focus().setColor(color).run()}><span className="h-3 w-3 rounded-full border border-border" style={{ backgroundColor: color }} /></Button>)}</div>
        <Button size="sm" variant={editor.isActive("highlight") ? "secondary" : "outline"} onClick={() => editor.chain().focus().toggleHighlight({ color: TEXT_COLORS.zloto }).run()}>Zakreślacz</Button>
        <Input aria-label="Adres odnośnika" placeholder="https://…" className="h-8 min-w-0 flex-1" value={link} onChange={e => setLink(e.target.value)} />
        {tool("Wstaw odnośnik", Link2, () => { if (/^(https:\/\/|\/(?!\/)|mailto:)/.test(link)) editor.chain().focus().extendMarkRange("link").setLink({ href: link }).run(); else if (!link) editor.chain().focus().unsetLink().run(); })}
      </div>
      <EditorContent editor={editor} />
    </div>
    <details className="border border-border p-2"><summary className="cursor-pointer text-xs">Położenie i odstępy</summary><div className="mt-3 grid grid-cols-2 gap-2">
      <label className="text-xs">Położenie bloku<select aria-label="Położenie bloku" className={`${sel} mt-1 w-full`} value={format?.position ?? "left"} onChange={e => setLayout({ position: e.target.value as TextFormat['position'] })}><option value="left">Po lewej</option><option value="center">Na środku</option><option value="right">Po prawej</option></select></label>
      {([['width', 'Szerokość (%)', 25, 100, 100], ['indent', 'Wcięcie (px)', 0, 120, 0], ['spaceBefore', 'Odstęp przed (px)', 0, 160, 0], ['spaceAfter', 'Odstęp po (px)', 0, 160, 0], ['lineHeight', 'Interlinia', 1, 3, 1.5]] as const).map(([key, name, min, max, def]) => <label key={key} className="text-xs">{name}<Input aria-label={name} className="mt-1 h-8" type="number" min={min} max={max} step={key === "lineHeight" ? 0.1 : 1} value={format?.[key] ?? def} onChange={e => { const n = Number(e.target.value); if (Number.isFinite(n)) setLayout({ [key]: Math.max(min, Math.min(max, n)) }); }} /></label>)}
    </div></details>
  </div>;
}