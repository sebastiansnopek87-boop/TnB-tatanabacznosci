import { describe, expect, it } from "vitest";
import { createHash } from "node:crypto";
import { p24NotifySign, payuCheckSignature, tpayMd5 } from "../../../supabase/functions/tnb-payments/providers.ts";

const md5 = (value: string) => createHash("md5").update(value).digest("hex");

describe("payment provider webhook signatures", () => {
  it("P24 signature changes when amount is tampered", () => {
    const body = { merchantId: 1, posId: 1, sessionId: "a", amount: 4900, originAmount: 4900, currency: "PLN", orderId: 9, methodId: 1, statement: "x" };
    expect(p24NotifySign(body, "k")).not.toBe(p24NotifySign({ ...body, amount: 100 }, "k"));
    expect(p24NotifySign(body, "k")).toHaveLength(96);
  });
  it("Tpay hashes the documented transaction fields in order", () => {
    const fields = { id: "1010", tr_id: "TR-1", tr_amount: "49.00", tr_crc: "ord" };
    expect(tpayMd5(fields, "sec")).toBe(md5("1010TR-149.00ordsec"));
  });
  it("PayU accepts a valid signature and rejects a forged one", () => {
    const body = '{"order":{"orderId":"X"}}';
    expect(payuCheckSignature(body, `sender=checkout;signature=${md5(body + "k2")};algorithm=MD5;content=DOCUMENT`, "k2")).toBe(true);
    expect(payuCheckSignature(body, `sender=checkout;signature=${md5(body + "zz")};algorithm=MD5`, "k2")).toBe(false);
  });
});
