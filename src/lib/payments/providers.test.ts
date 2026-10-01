import { describe, expect, it } from "vitest";
import { createHash } from "crypto";
import { p24NotifySign, payuCheckSignature, tpayMd5 } from "./providers.server";

const md5 = (s: string) => createHash("md5").update(s).digest("hex");

describe("webhook signatures", () => {
  it("P24: sign changes when amount is tampered", () => {
    const b = { merchantId: 1, posId: 1, sessionId: "a", amount: 4900, originAmount: 4900, currency: "PLN", orderId: 9, methodId: 1, statement: "x" };
    expect(p24NotifySign(b, "k")).not.toBe(p24NotifySign({ ...b, amount: 100 }, "k"));
    expect(p24NotifySign(b, "k")).toHaveLength(96);
  });
  it("Tpay: md5 of id+tr_id+tr_amount+tr_crc+code", () => {
    const f = { id: "1010", tr_id: "TR-1", tr_amount: "49.00", tr_crc: "ord" };
    expect(tpayMd5(f, "sec")).toBe(md5("1010TR-149.00ordsec"));
  });
  it("PayU: accepts valid and rejects forged signature", () => {
    const body = '{"order":{"orderId":"X"}}';
    expect(payuCheckSignature(body, `sender=checkout;signature=${md5(body + "k2")};algorithm=MD5;content=DOCUMENT`, "k2")).toBe(true);
    expect(payuCheckSignature(body, `sender=checkout;signature=${md5(body + "zz")};algorithm=MD5`, "k2")).toBe(false);
  });
});
