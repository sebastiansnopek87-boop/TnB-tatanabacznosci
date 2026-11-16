import { createHash } from "crypto";

export const sha384 = (value: string) => createHash("sha384").update(value, "utf8").digest("hex");
export const md5 = (value: string) => createHash("md5").update(value, "utf8").digest("hex");
export const sha256 = (value: string) => createHash("sha256").update(value, "utf8").digest("hex");

/** Constant-time comparison for equal-length hexadecimal signatures. */
export function safeEq(a: string, b: string): boolean {
  if (!a || a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i++) result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return result === 0;
}

export function p24RegisterSign(sessionId: string, merchantId: number, amount: number, currency: string, crc: string) {
  return sha384(JSON.stringify({ sessionId, merchantId, amount, currency, crc }));
}

export function p24NotifySign(body: Record<string, unknown>, crc: string) {
  return sha384(JSON.stringify({
    merchantId: body["merchantId"], posId: body["posId"], sessionId: body["sessionId"],
    amount: body["amount"], originAmount: body["originAmount"], currency: body["currency"],
    orderId: body["orderId"], methodId: body["methodId"], statement: body["statement"], crc,
  }));
}

export function tpayMd5(fields: Record<string, string>, code: string) {
  return md5(`${fields["id"] ?? ""}${fields["tr_id"] ?? ""}${fields["tr_amount"] ?? ""}${fields["tr_crc"] ?? ""}${code}`);
}

export function payuCheckSignature(raw: string, header: string, secondKey: string) {
  const parts = Object.fromEntries(header.split(";").map((item) => item.split("=").map((value) => value.trim()) as [string, string]));
  const algorithm = (parts["algorithm"] ?? "MD5").toUpperCase();
  const expected = algorithm === "SHA-256" || algorithm === "SHA256"
    ? sha256(raw + secondKey)
    : algorithm === "MD5" ? md5(raw + secondKey) : "";
  return !!expected && safeEq(String(parts["signature"] ?? "").toLowerCase(), expected);
}
