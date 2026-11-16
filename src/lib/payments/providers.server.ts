// Operator adapters: Przelewy24 (REST v1), Tpay (OpenAPI), PayU (REST v2.1).
// Each adapter only talks to its own operator; the shared order logic lives in core.server.ts.
// Secrets come from server env only; non-secret identifiers from payment_providers.
import { createHash } from "crypto";

export type ProviderId = "p24" | "tpay" | "payu";
export type Env = "sandbox" | "live";
export type ProviderRow = { id: ProviderId; enabled: boolean; is_default: boolean; environment: Env; merchant_id: string | null; pos_id: string | null; client_id: string | null };

export type CreateInput = { orderId: string; orderNumber: string; amount: number; currency: string; email: string; name: string; description: string; returnUrl: string; notifyUrl: string; customerIp: string };
export type CreateResult = { ok: true; redirectUrl: string; providerRef: string } | { ok: false; reason: string };

// Normalized, signature-verified notification.
export type Notice = { orderId: string | null; providerRef: string; amount: number; currency: string; outcome: "paid" | "failed" | "pending"; eventId: string };

const sha384 = (s: string) => createHash("sha384").update(s, "utf8").digest("hex");
const md5 = (s: string) => createHash("md5").update(s, "utf8").digest("hex");
const sha256 = (s: string) => createHash("sha256").update(s, "utf8").digest("hex");
const env = (k: string) => process.env[k] || "";
function safeEq(a: string, b: string) {
  if (!a || a.length !== b.length) return false;
  let r = 0; for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}

// Required data per operator: [field, label, secret env name?]
export const REQUIREMENTS: Record<ProviderId, { label: string; fields: { key: "merchant_id" | "pos_id" | "client_id"; label: string }[]; secrets: { name: string; label: string }[]; docs: string; refunds: string }> = {
  p24: {
    label: "Przelewy24",
    fields: [{ key: "merchant_id", label: "ID sprzedawcy (merchantId)" }, { key: "pos_id", label: "ID sklepu (posId) — zwykle równe ID sprzedawcy" }],
    secrets: [{ name: "P24_CRC", label: "Klucz CRC" }, { name: "P24_API_KEY", label: "Klucz do raportów / API (secretId)" }],
    docs: "Panel Przelewy24 → Moje dane → Dane API i konfiguracja modułu",
    refunds: "API zwrotów istnieje, ale na tym etapie zwrot wykonuje się w panelu Przelewy24.",
  },
  tpay: {
    label: "Tpay",
    fields: [{ key: "merchant_id", label: "ID sprzedawcy (merchant id)" }, { key: "client_id", label: "Client ID (Open API)" }],
    secrets: [{ name: "TPAY_CLIENT_SECRET", label: "Client Secret (Open API)" }, { name: "TPAY_SECURITY_CODE", label: "Kod bezpieczeństwa (powiadomienia)" }],
    docs: "Panel Tpay → Integracja → Klucze API oraz Ustawienia powiadomień",
    refunds: "API zwrotów istnieje, ale na tym etapie zwrot wykonuje się w panelu Tpay.",
  },
  payu: {
    label: "PayU",
    fields: [{ key: "pos_id", label: "Id punktu płatności (pos_id)" }, { key: "client_id", label: "OAuth client_id" }],
    secrets: [{ name: "PAYU_CLIENT_SECRET", label: "OAuth client_secret" }, { name: "PAYU_SECOND_KEY", label: "Drugi klucz (MD5)" }],
    docs: "Panel PayU → Płatności elektroniczne → Moje sklepy → Punkty płatności → Klucze konfiguracji",
    refunds: "API zwrotów istnieje, ale na tym etapie zwrot wykonuje się w panelu PayU.",
  },
};

export function configStatus(p: ProviderRow) {
  const r = REQUIREMENTS[p.id];
  const missing = [...r.fields.filter((f) => !p[f.key]).map((f) => f.label), ...r.secrets.filter((s) => !env(s.name)).map((s) => s.label)];
  return { configured: missing.length === 0, missing, secrets: r.secrets.map((s) => ({ name: s.name, label: s.label, set: !!env(s.name) })) };
}

const BASE = {
  p24: { sandbox: "https://sandbox.przelewy24.pl", live: "https://secure.przelewy24.pl" },
  tpay: { sandbox: "https://openapi.sandbox.tpay.com", live: "https://api.tpay.com" },
  payu: { sandbox: "https://secure.snd.payu.com", live: "https://secure.payu.com" },
} as const;

async function timed(url: string, init: RequestInit) {
  return fetch(url, { ...init, signal: AbortSignal.timeout(15000) });
}

// ---------------- Przelewy24 ----------------
const p24Auth = (p: ProviderRow) => "Basic " + Buffer.from(`${p.pos_id}:${env("P24_API_KEY")}`).toString("base64");

export function p24RegisterSign(sessionId: string, merchantId: number, amount: number, currency: string, crc: string) {
  return sha384(JSON.stringify({ sessionId, merchantId, amount, currency, crc }));
}
export function p24NotifySign(b: Record<string, unknown>, crc: string) {
  return sha384(JSON.stringify({ merchantId: b["merchantId"], posId: b["posId"], sessionId: b["sessionId"], amount: b["amount"], originAmount: b["originAmount"], currency: b["currency"], orderId: b["orderId"], methodId: b["methodId"], statement: b["statement"], crc }));
}

async function p24Create(p: ProviderRow, i: CreateInput): Promise<CreateResult> {
  const merchantId = Number(p.merchant_id);
  const body = {
    merchantId, posId: Number(p.pos_id), sessionId: i.orderId, amount: i.amount, currency: i.currency,
    description: i.description.slice(0, 1024), email: i.email, client: i.name.slice(0, 40), country: "PL", language: "pl",
    urlReturn: i.returnUrl, urlStatus: i.notifyUrl, sign: p24RegisterSign(i.orderId, merchantId, i.amount, i.currency, env("P24_CRC")),
  };
  const r = await timed(`${BASE.p24[p.environment]}/api/v1/transaction/register`, { method: "POST", headers: { Authorization: p24Auth(p), "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const j = await r.json().catch(() => null) as { data?: { token?: string }; error?: string } | null;
  if (!r.ok || !j?.data?.token) return { ok: false, reason: `p24_register_${r.status}` };
  return { ok: true, redirectUrl: `${BASE.p24[p.environment]}/trnRequest/${j.data.token}`, providerRef: i.orderId };
}

// Verifies notification signature, then confirms the transaction with /verify (required by P24).
async function p24Notice(p: ProviderRow, raw: string): Promise<Notice | null> {
  let b: Record<string, unknown>;
  try { b = JSON.parse(raw); } catch { return null; }
  if (!safeEq(String(b["sign"] ?? ""), p24NotifySign(b, env("P24_CRC")))) return null;
  if (String(b["merchantId"]) !== String(p.merchant_id) || String(b["posId"]) !== String(p.pos_id)) return null;
  const sessionId = String(b["sessionId"]); const orderId = Number(b["orderId"]); const amount = Number(b["amount"]); const currency = String(b["currency"]);
  const vr = await timed(`${BASE.p24[p.environment]}/api/v1/transaction/verify`, {
    method: "PUT", headers: { Authorization: p24Auth(p), "Content-Type": "application/json" },
    body: JSON.stringify({ merchantId: Number(p.merchant_id), posId: Number(p.pos_id), sessionId, amount, currency, orderId, sign: sha384(JSON.stringify({ sessionId, orderId, amount, currency, crc: env("P24_CRC") })) }),
  });
  const vj = await vr.json().catch(() => null) as { data?: { status?: string } } | null;
  const ok = vr.ok && vj?.data?.status === "success";
  return { orderId: sessionId, providerRef: sessionId, amount, currency, outcome: ok ? "paid" : "pending", eventId: `p24:${orderId}:${ok ? "verified" : "unverified"}` };
}

async function p24Test(p: ProviderRow) {
  const r = await timed(`${BASE.p24[p.environment]}/api/v1/testAccess`, { headers: { Authorization: p24Auth(p) } });
  return { ok: r.ok, detail: r.ok ? "Połączenie i dane dostępowe poprawne." : `Operator odrzucił dane (HTTP ${r.status}).` };
}

// ---------------- Tpay ----------------
async function tpayToken(p: ProviderRow) {
  const r = await timed(`${BASE.tpay[p.environment]}/oauth/auth`, { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ client_id: p.client_id ?? "", client_secret: env("TPAY_CLIENT_SECRET") }) });
  const j = await r.json().catch(() => null) as { access_token?: string } | null;
  return j?.access_token ?? null;
}

export function tpayMd5(f: Record<string, string>, code: string) {
  return md5(`${f["id"] ?? ""}${f["tr_id"] ?? ""}${f["tr_amount"] ?? ""}${f["tr_crc"] ?? ""}${code}`);
}

async function tpayCreate(p: ProviderRow, i: CreateInput): Promise<CreateResult> {
  const t = await tpayToken(p); if (!t) return { ok: false, reason: "tpay_auth" };
  const r = await timed(`${BASE.tpay[p.environment]}/transactions`, {
    method: "POST", headers: { Authorization: `Bearer ${t}`, "Content-Type": "application/json" },
    body: JSON.stringify({ amount: i.amount / 100, description: i.description.slice(0, 128), hiddenDescription: i.orderId, lang: "pl", payer: { email: i.email, name: i.name }, callbacks: { payerUrls: { success: i.returnUrl, error: i.returnUrl }, notification: { url: i.notifyUrl } } }),
  });
  const j = await r.json().catch(() => null) as { transactionPaymentUrl?: string; title?: string; transactionId?: string } | null;
  if (!r.ok || !j?.transactionPaymentUrl) return { ok: false, reason: `tpay_create_${r.status}` };
  return { ok: true, redirectUrl: j.transactionPaymentUrl, providerRef: j.title ?? j.transactionId ?? i.orderId };
}

async function tpayNotice(p: ProviderRow, raw: string): Promise<Notice | null> {
  const f = Object.fromEntries(new URLSearchParams(raw)) as Record<string, string>;
  if (!safeEq(String(f["md5sum"] ?? "").toLowerCase(), tpayMd5(f, env("TPAY_SECURITY_CODE")))) return null;
  if (String(f["id"]) !== String(p.merchant_id)) return null;
  const st = String(f["tr_status"]).toUpperCase();
  const paidAmt = Math.round(Number(f["tr_paid"] ?? f["tr_amount"]) * 100);
  return { orderId: f["tr_crc"] || null, providerRef: String(f["tr_id"]), amount: paidAmt, currency: "PLN", outcome: st === "TRUE" && f["tr_error"] === "none" ? "paid" : st === "FALSE" ? "failed" : "pending", eventId: `tpay:${f["tr_id"]}:${st}` };
}

async function tpayTest(p: ProviderRow) {
  const t = await tpayToken(p);
  return { ok: !!t, detail: t ? "Autoryzacja Open API poprawna." : "Operator odrzucił Client ID / Client Secret." };
}

// ---------------- PayU ----------------
async function payuToken(p: ProviderRow) {
  const r = await timed(`${BASE.payu[p.environment]}/pl/standard/user/oauth/authorize`, { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ grant_type: "client_credentials", client_id: p.client_id ?? "", client_secret: env("PAYU_CLIENT_SECRET") }) });
  const j = await r.json().catch(() => null) as { access_token?: string } | null;
  return j?.access_token ?? null;
}

export function payuCheckSignature(raw: string, header: string, secondKey: string) {
  const parts = Object.fromEntries(header.split(";").map((x) => x.split("=").map((s) => s.trim()) as [string, string]));
  const alg = (parts["algorithm"] ?? "MD5").toUpperCase();
  const expected = alg === "SHA-256" || alg === "SHA256" ? sha256(raw + secondKey) : alg === "MD5" ? md5(raw + secondKey) : "";
  return !!expected && safeEq(String(parts["signature"] ?? "").toLowerCase(), expected);
}

async function payuCreate(p: ProviderRow, i: CreateInput): Promise<CreateResult> {
  const t = await payuToken(p); if (!t) return { ok: false, reason: "payu_auth" };
  const [firstName, ...rest] = i.name.trim().split(/\s+/);
  const r = await timed(`${BASE.payu[p.environment]}/api/v2_1/orders`, {
    method: "POST", redirect: "manual", headers: { Authorization: `Bearer ${t}`, "Content-Type": "application/json" },
    body: JSON.stringify({ notifyUrl: i.notifyUrl, continueUrl: i.returnUrl, customerIp: i.customerIp || "127.0.0.1", merchantPosId: p.pos_id, description: i.description.slice(0, 4000), currencyCode: i.currency, totalAmount: String(i.amount), extOrderId: i.orderId, buyer: { email: i.email, firstName, lastName: rest.join(" ") || firstName, language: "pl" }, products: [{ name: i.description.slice(0, 255), unitPrice: String(i.amount), quantity: "1" }] }),
  });
  const j = await r.json().catch(() => null) as { status?: { statusCode?: string }; redirectUri?: string; orderId?: string } | null;
  if (j?.status?.statusCode !== "SUCCESS" || !j.redirectUri || !j.orderId) return { ok: false, reason: `payu_create_${r.status}` };
  return { ok: true, redirectUrl: j.redirectUri, providerRef: j.orderId };
}

async function payuNotice(_p: ProviderRow, raw: string, headers: Headers): Promise<Notice | null> {
  const h = headers.get("openpayu-signature") ?? headers.get("x-openpayu-signature") ?? "";
  if (!payuCheckSignature(raw, h, env("PAYU_SECOND_KEY"))) return null;
  let b: { order?: { orderId?: string; extOrderId?: string; totalAmount?: string; currencyCode?: string; status?: string } };
  try { b = JSON.parse(raw); } catch { return null; }
  const o = b.order; if (!o?.orderId) return null;
  const st = String(o.status);
  return { orderId: o.extOrderId ?? null, providerRef: o.orderId, amount: Number(o.totalAmount), currency: String(o.currencyCode), outcome: st === "COMPLETED" ? "paid" : st === "CANCELED" ? "failed" : "pending", eventId: `payu:${o.orderId}:${st}` };
}

async function payuTest(p: ProviderRow) {
  const t = await payuToken(p);
  return { ok: !!t, detail: t ? "Autoryzacja OAuth poprawna." : "Operator odrzucił client_id / client_secret." };
}

export const ADAPTERS: Record<ProviderId, {
  create: (p: ProviderRow, i: CreateInput) => Promise<CreateResult>;
  notice: (p: ProviderRow, raw: string, h: Headers) => Promise<Notice | null>;
  test: (p: ProviderRow) => Promise<{ ok: boolean; detail: string }>;
  ack: () => Response;
}> = {
  p24: { create: p24Create, notice: (p, r) => p24Notice(p, r), test: p24Test, ack: () => new Response("OK") },
  tpay: { create: tpayCreate, notice: (p, r) => tpayNotice(p, r), test: tpayTest, ack: () => new Response("TRUE") },
  payu: { create: payuCreate, notice: payuNotice, test: payuTest, ack: () => new Response("OK") },
};
