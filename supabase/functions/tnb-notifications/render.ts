// Pure template renderer. Never returns output containing a raw {{marker}}:
// any unresolved or invalid variable makes the render fail instead.
import { AUTO_VARS, VAR_MAP } from "./registry";

export type Vars = Record<string, string | null | undefined>;
export type RenderInput = { subject: string; html: string; text: string };
export type RenderOk = { ok: true; subject: string; html: string; text: string; usesSensitive: boolean };
export type RenderFail = { ok: false; missing: string[] };

const RE = /\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g;
const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

export function usedVars(t: RenderInput): string[] {
  const all = `${t.subject}\n${t.html}\n${t.text}`;
  return Array.from(new Set(Array.from(all.matchAll(RE), (m) => m[1]!)));
}

export function render(t: RenderInput, vars: Vars, required: string[] = []): RenderOk | RenderFail {
  const used = usedVars(t);
  const missing: string[] = [];
  const val: Record<string, string> = {};
  for (const k of new Set([...used, ...required])) {
    const def = VAR_MAP[k];
    const v = (vars[k] ?? "").toString().trim();
    if (!def || !v || (def.url && !/^https?:\/\/[^\s"<>]+$/i.test(v))) { missing.push(k); continue; }
    val[k] = v;
  }
  if (missing.length) return { ok: false, missing: missing.sort() };
  const sub = (s: string, fn: (v: string) => string) => s.replace(RE, (_, k: string) => fn(val[k]!));
  const subject = sub(t.subject, (v) => v).replace(/[\r\n]+/g, " ");
  const html = sub(t.html, esc);
  const text = sub(t.text, (v) => v);
  if (/\{\{/.test(subject + html + text)) return { ok: false, missing: ["unresolved"] };
  return { ok: true, subject, html: layout(html, val["nazwa_platformy"] ?? "Tata Na Baczności"), text, usesSensitive: used.some((k) => VAR_MAP[k]?.sensitive) };
}

export const SENSITIVE_MASK = "https://tatanabacznosci.pl/ukryty-link";
export function maskSensitive(vars: Vars): Vars {
  const out: Vars = {};
  for (const [k, v] of Object.entries(vars)) out[k] = VAR_MAP[k]?.sensitive ? (v ? SENSITIVE_MASK : v) : v;
  return out;
}
export function stripSensitive(vars: Vars): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(vars)) if (v && !VAR_MAP[k]?.sensitive && !AUTO_VARS.includes(k)) out[k] = String(v);
  return out;
}

// Dark TNB card on a white body (white outer background keeps mail clients consistent).
export function layout(inner: string, platform: string) {
  const styled = inner
    .replace(/<h1>/g, '<h1 style="margin:0 0 20px;font-family:Georgia,\'Times New Roman\',serif;font-size:26px;font-weight:600;letter-spacing:1px;text-transform:uppercase;color:#f3ead7;">')
    .replace(/<p>/g, '<p style="margin:0 0 14px;font-size:15px;line-height:1.6;color:#d9d2c3;">')
    .replace(/<a class="btn" /g, '<a style="display:inline-block;margin-top:8px;padding:12px 22px;background:#c9a24a;color:#14110d;text-decoration:none;font-weight:600;letter-spacing:1px;text-transform:uppercase;font-size:13px;" ');
  const p = esc(platform);
  return `<!doctype html><html lang="pl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${p}</title></head>
<body style="margin:0;padding:0;background:#ffffff;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#ffffff;"><tr><td align="center" style="padding:24px 12px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;background:#14110d;border-top:3px solid #c9a24a;font-family:Arial,Helvetica,sans-serif;">
<tr><td style="padding:24px 28px 0;font-family:Georgia,serif;font-size:13px;letter-spacing:3px;text-transform:uppercase;color:#c9a24a;">${p}</td></tr>
<tr><td style="padding:20px 28px 28px;">${styled}</td></tr>
<tr><td style="padding:16px 28px;border-top:1px solid #3a3226;font-size:12px;color:#8f877a;">Wiadomość wysłana automatycznie przez ${p}.</td></tr>
</table></td></tr></table></body></html>`;
}
